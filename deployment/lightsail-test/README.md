# Lightsail development/test backend

This isolated Compose project runs the backend with its own Neo4j database. It
does not attach to or modify other Compose projects on the instance.

This deployment is for disposable test data only. The API is exposed over
plain HTTP on port 4000, with no TLS. Do not use real accounts, passwords, or
personal data. Neo4j is not published to the host, registration is disabled,
and the API and database have container resource limits.

The `yarn run db:seed:redsol` seed creates `admin@example.org` with the
password `1234`. Anyone who can reach the public API can use that seeded
account; never use this seed or public HTTP setup for production data.

## Release backend changes

From any directory in this repository, run:

```bash
./deployment/lightsail-test/deploy.sh
```

The script packages the current `backend/` working tree (including uncommitted
changes), builds the production image on the Lightsail VM, replaces only the
test backend container, and checks a GraphQL query that reads from Neo4j. If
the new backend fails that check, the script automatically restores the prior
image. Neo4j, its data, uploads, and the other applications on the VM are not
recreated.

Set the connection settings in the environment before running the script:

```bash
source deployment/lightsail-test/local-env.sh
```

There are no built-in connection defaults. The host-key fingerprint is checked
before SSH or SCP is used. Keep the private key and these deployment settings
private.

This releases backend code only. It does not deploy webapp changes or run
database migrations/seeds. Review and test backend changes locally before
releasing them.

## Manage backend IP access

The source of truth for backend access is [`allowed-ips.txt`](./allowed-ips.txt).
Put one IPv4 address on each line. Blank lines and comments beginning with
`#` are ignored. Addresses are restricted to individual `/32` entries. The allowlist commands
also require `AWS_PROFILE`, `AWS_REGION`, and `LIGHTSAIL_INSTANCE` to be set in
the environment.

```bash
./deployment/lightsail-test/deploy.sh allowlist list
./deployment/lightsail-test/deploy.sh allowlist sync
```

Edit `allowed-ips.txt`, then run `allowlist sync` to make the Lightsail TCP
port 4000 rule match the file. Sync closes unrestricted IPv4/IPv6 access,
removes addresses no longer listed, and adds new addresses. Do not remove all
addresses: the script rejects an empty allowlist to avoid accidentally locking
out everyone. These changes affect only port 4000; SSH, HTTP, and HTTPS
firewall rules are left unchanged. AWS CLI credentials for the selected profile
and region must be valid.

```bash
export AWS_PROFILE="<aws-profile>"
export AWS_REGION="<aws-region>"
export LIGHTSAIL_INSTANCE="<instance-name>"
```

## Configure

Copy `.env.example` to `.env`, replace the database and application secrets
with unique random values, and keep `.env` private. Set `GRAPHQL_URI` and
`CLIENT_URI` to the public test URL. Never commit `.env`.

## Operate the deployed test stack

The VM uses Docker Compose 1.29 with Docker 29. Because that Compose version
cannot recreate the Neo4j container with the current Docker engine, the
deployed Neo4j container is managed directly by Docker. Do not use
`docker-compose up` or `docker-compose down` on the existing stack.

```bash
sudo docker ps --filter name=hc-test
sudo docker logs --tail=50 hc-test_backend_1
sudo docker logs --tail=50 hc-test-neo4j
```

After setting `LIGHTSAIL_HOST`, the GraphQL endpoint is
`http://<LIGHTSAIL_HOST>:4000/graphql`. The Lightsail firewall must allow
inbound TCP port 4000 for public access. Do not expose Neo4j ports 7474 or 7687.

Restart the test containers without deleting their data:

```bash
sudo docker restart hc-test_backend_1 hc-test-neo4j
```

Stop the test containers while preserving their database and uploads:

```bash
sudo docker stop hc-test_backend_1 hc-test-neo4j
```

Their named data volumes remain when stopped. Removing `hc-test_neo4j_data`
or `hc-test_uploads` permanently deletes the test database or uploaded files.
