#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
backend_dir="$repo_root/backend"
host="${LIGHTSAIL_HOST:-}"
user="${LIGHTSAIL_USER:-}"
key="${LIGHTSAIL_SSH_KEY:-}"
expected_fingerprint="${LIGHTSAIL_HOST_FINGERPRINT:-}"
project_dir="${LIGHTSAIL_PROJECT_DIR:-}"
endpoint="https://sol.humantics.ai/graphql"
build_commit="$(git -C "$repo_root" rev-parse --short HEAD)"
release_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
remote_release="$project_dir/releases/$release_id"
remote_archive="$remote_release/backend.tar.gz"
aws_profile="${AWS_PROFILE:-}"
aws_region="${AWS_REGION:-}"
lightsail_instance="${LIGHTSAIL_INSTANCE:-}"
allowlist_file="$script_dir/allowed-ips.txt"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    printf 'Required environment variable is not set: %s\n' "$name" >&2
    exit 1
  fi
}

aws_lightsail() {
  aws --profile "$aws_profile" --region "$aws_region" lightsail "$@"
}

list_backend_allowlist() {
  aws_lightsail get-instance-port-states \
    --instance-name "$lightsail_instance" \
    --query 'portStates[?fromPort==`4000` && toPort==`4000` && protocol==`tcp`].{state:state,cidrs:cidrs,ipv6Cidrs:ipv6Cidrs}' \
    --output json
}

backend_cidrs() {
  local address_family="$1"
  aws_lightsail get-instance-port-states \
    --instance-name "$lightsail_instance" \
    --query "portStates[?fromPort==\`4000\` && toPort==\`4000\` && protocol==\`tcp\`].${address_family}[]" \
    --output text | tr '\t' '\n'
}

configured_backend_cidrs() {
  python3 - "$allowlist_file" <<'PYTHON'
import ipaddress
import sys

path = sys.argv[1]
addresses = []
seen = set()

try:
    with open(path, encoding="utf-8") as allowlist:
        for line_number, line in enumerate(allowlist, start=1):
            value = line.split("#", 1)[0].strip()
            if not value:
                continue
            try:
                address = ipaddress.ip_address(value)
            except ValueError:
                sys.exit(f"{path}:{line_number}: invalid IP address: {value}")
            if address.version != 4:
                sys.exit(f"{path}:{line_number}: only IPv4 addresses are supported")
            normalized = str(address)
            if normalized not in seen:
                addresses.append(normalized)
                seen.add(normalized)
except OSError as error:
    sys.exit(f"Cannot read allowlist file {path}: {error}")

if not addresses:
    sys.exit(f"{path}: add at least one IPv4 address before syncing")

for address in addresses:
    print(f"{address}/32")
PYTHON
}

open_backend_cidr() {
  local cidr="$1"
  local port_info
  printf -v port_info \
    '{"fromPort":4000,"toPort":4000,"protocol":"tcp","cidrs":["%s"]}' \
    "$cidr"
  aws_lightsail open-instance-public-ports \
    --instance-name "$lightsail_instance" \
    --port-info "$port_info" \
    --query 'operation.status' \
    --output text >/dev/null
}

close_backend_cidr() {
  local cidr="$1"
  local address_family="${2:-cidrs}"
  local port_info
  if [[ "$address_family" == ipv6Cidrs ]]; then
    printf -v port_info \
      '{"fromPort":4000,"toPort":4000,"protocol":"tcp","ipv6Cidrs":["%s"]}' \
      "$cidr"
  else
    printf -v port_info \
      '{"fromPort":4000,"toPort":4000,"protocol":"tcp","cidrs":["%s"]}' \
      "$cidr"
  fi
  aws_lightsail close-instance-public-ports \
    --instance-name "$lightsail_instance" \
    --port-info "$port_info" \
    --query 'operation.status' \
    --output text >/dev/null
}

manage_allowlist() {
  local action="${1:-}"
  local desired_cidrs current_cidrs address

  case "$action" in
    list)
      [[ $# -eq 1 ]] || {
        printf 'Usage: %s allowlist list\n' "$0" >&2
        return 2
      }
      printf 'Configured backend IPv4 addresses (%s):\n' "$allowlist_file"
      configured_backend_cidrs | sed 's#/32$##'
      printf '\nLightsail TCP 4000 firewall rule:\n'
      list_backend_allowlist
      ;;
    sync)
      [[ $# -eq 1 ]] || {
        printf 'Usage: %s allowlist sync\n' "$0" >&2
        return 2
      }
      printf 'Port 4000 is no longer published; this command will not modify Lightsail firewall rules.\n' >&2
      printf 'Remove any existing TCP 4000 rules with Lightsail after confirming access is no longer needed.\n' >&2
      return 2
      ;;
    *)
      printf 'Usage: %s allowlist {list|sync}\n' "$0" >&2
      return 2
      ;;
  esac
}

if [[ "${1:-}" == allowlist ]]; then
  require_env AWS_PROFILE
  require_env AWS_REGION
  require_env LIGHTSAIL_INSTANCE
  for command in aws python3 tr grep sed; do
    command -v "$command" >/dev/null 2>&1 || {
      printf 'Required command not found: %s\n' "$command" >&2
      exit 1
    }
  done
  shift
  manage_allowlist "$@"
  exit $?
fi

require_env LIGHTSAIL_HOST
require_env LIGHTSAIL_USER
require_env LIGHTSAIL_SSH_KEY
require_env LIGHTSAIL_HOST_FINGERPRINT
require_env LIGHTSAIL_PROJECT_DIR
if [[ ! "$project_dir" =~ ^/[A-Za-z0-9._/-]+$ || "$project_dir" == */../* || "$project_dir" == */.. || "$project_dir" == / ]]; then
  printf 'LIGHTSAIL_PROJECT_DIR must be a non-root absolute path without spaces or shell-special characters.\n' >&2
  exit 1
fi

for command in git tar ssh scp ssh-keyscan ssh-keygen curl; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Required command not found: %s\n' "$command" >&2
    exit 1
  }
done

if [[ ! -d "$backend_dir" ]]; then
  printf 'Backend source directory not found: %s\n' "$backend_dir" >&2
  exit 1
fi

if [[ ! -r "$key" ]]; then
  printf 'SSH key is not readable: %s\n' "$key" >&2
  exit 1
fi

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/hc-lightsail-release.XXXXXX")"
known_hosts="$temp_dir/known_hosts"
archive="$temp_dir/backend.tar.gz"
chmod 700 "$temp_dir"
trap 'rm -rf "$temp_dir"' EXIT

ssh-keyscan -T 10 -t ed25519 "$host" 2>/dev/null > "$known_hosts"
actual_fingerprint="$(ssh-keygen -lf "$known_hosts" -E sha256 | awk 'NR == 1 { print $2 }')"
if [[ "$actual_fingerprint" != "$expected_fingerprint" ]]; then
  printf 'SSH host key mismatch for %s.\nExpected: %s\nReceived: %s\n' \
    "$host" "$expected_fingerprint" "$actual_fingerprint" >&2
  exit 1
fi

ssh_options=(
  -i "$key"
  -o IdentitiesOnly=yes
  -o BatchMode=yes
  -o StrictHostKeyChecking=yes
  -o "UserKnownHostsFile=$known_hosts"
)
target="$user@$host"

printf 'Checking the existing test stack on %s...\n' "$host"
ssh "${ssh_options[@]}" "$target" bash -s -- "$remote_release" "$project_dir" <<'REMOTE'
set -euo pipefail
release_dir="$1"
project_dir="$2"

test -r "$project_dir/deployment/lightsail-test/.env"
test "$(sudo -n docker inspect --format '{{.State.Running}}' hc-test_backend_1)" = true
test "$(sudo -n docker inspect --format '{{.State.Running}}' hc-test-neo4j)" = true
mkdir -p "$release_dir"
REMOTE

printf 'Packaging current backend working tree...\n'
COPYFILE_DISABLE=1 tar -czf "$archive" \
  --exclude='backend/.env' \
  --exclude='backend/node_modules' \
  --exclude='backend/public/uploads' \
  --exclude='backend/._*' \
  --exclude='*/._*' \
  --exclude='.DS_Store' \
  --exclude='*/.DS_Store' \
  -C "$repo_root" backend
chmod 600 "$archive"

scp "${ssh_options[@]}" "$archive" "$target:$remote_archive"

printf 'Building and deploying release %s...\n' "$release_id"
ssh "${ssh_options[@]}" "$target" bash -s -- "$release_id" "$remote_release" "$remote_archive" "$build_commit" "$project_dir" <<'REMOTE'
set -Eeuo pipefail

release_id="$1"
release_dir="$2"
archive="$3"
build_commit="$4"
project_dir="$5"
environment_file="$project_dir/deployment/lightsail-test/.env"
container="hc-test_backend_1"
network="hc-test_hc-test"
image="humanconnection/nitro-backend:release-$release_id"
rollback_tag="hc-test-backend:rollback-$release_id"
previous_image="$(sudo -n docker inspect --format '{{.Image}}' "$container")"
replaced=0

exec 9>"$project_dir/.release.lock"
if ! flock -n 9; then
  printf 'Another release is already in progress.\n' >&2
  exit 1
fi

rollback() {
  status=$?
  if [[ "$replaced" == 1 ]]; then
    printf 'Release failed; restoring the previous backend image...\n' >&2
    sudo -n docker rm -f "$container" >/dev/null 2>&1 || true
    run_backend "$previous_image" || {
      printf 'Automatic rollback failed. Previous image: %s\n' "$rollback_tag" >&2
      exit 1
    }
  fi
  exit "$status"
}

run_backend() {
  sudo -n docker run --detach \
    --name "$container" \
    --restart unless-stopped \
    --network "$network" \
    --network-alias backend \
    --volume hc-test_uploads:/nitro-backend/public/uploads \
    --env VIRTUAL_HOST=sol.humantics.ai \
    --env VIRTUAL_PORT=4000 \
    --env LETSENCRYPT_HOST=sol.humantics.ai \
    --env LETSENCRYPT_EMAIL=tech@corechs.com \
    --env-file "$environment_file" \
    --env NODE_ENV=production \
    --env PORT=4000 \
    --env NEO4J_URI=bolt://neo4j:7687 \
    --env NEO4J_USERNAME=neo4j \
    --env PUBLIC_REGISTRATION=false \
    --memory 1g \
    --cpus 0.5 \
    --log-opt max-size=10m \
    --log-opt max-file=3 \
    "$1" >/dev/null
  sudo -n docker network connect vikunja_default "$container"
  sudo -n docker restart "$container" >/dev/null
}

smoke_test() {
  local attempt response
  for attempt in $(seq 1 60); do
    if response="$(sudo -n docker exec "$container" node -e '
      const http = require("http");
      const request = http.request({
        host: "127.0.0.1",
        port: 4000,
        path: "/graphql",
        method: "POST",
        headers: { "Content-Type": "application/json" }
      }, response => {
        let body = "";
        response.on("data", chunk => { body += chunk; });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300 ||
              !body.includes("\"data\"") || body.includes("\"errors\"")) {
            process.exitCode = 1;
          } else {
            process.stdout.write(body);
          }
        });
      });
      request.on("error", () => { process.exitCode = 1; });
      request.end(JSON.stringify({ query: "{ Organization(id: \"org0\") { id } }" }));
    ' 2>/dev/null)"; then
      if [[ "$response" == *'"data"'* && "$response" != *'"errors"'* ]]; then
        return 0
      fi
    fi
    sleep 2
  done
  return 1
}

trap rollback EXIT

mkdir -p "$release_dir/backend"
tar -xzf "$archive" -C "$release_dir"
rm -f "$archive"

sudo -n docker build \
  --target production \
  --build-arg "BUILD_COMMIT=$build_commit" \
  --tag "$image" \
  "$release_dir/backend"
sudo -n docker tag "$previous_image" "$rollback_tag"
sudo -n docker stop "$container" >/dev/null
sudo -n docker rm "$container" >/dev/null
replaced=1
run_backend "$image"
smoke_test

sudo -n docker tag "$image" humanconnection/nitro-backend:lightsail-test
replaced=0
trap - EXIT

printf 'Release %s is live and the GraphQL/Neo4j smoke test passed.\n' "$release_id"
printf 'Previous image retained as %s\n' "$rollback_tag"
REMOTE

printf 'Checking the public GraphQL endpoint...\n'
response="$(curl --fail --silent --show-error --max-time 20 \
  -H 'Content-Type: application/json' \
  --data-binary '{"query":"{ Organization(id: \"org0\") { id } }"}' \
  "$endpoint")"
if [[ "$response" != *'"data"'* || "$response" == *'"errors"'* ]]; then
  printf 'Public GraphQL smoke test failed: %s\n' "$response" >&2
  exit 1
fi

printf 'Deployment complete: %s\n' "$endpoint"
