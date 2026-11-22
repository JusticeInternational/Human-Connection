# Lightsail development/test backend

This isolated Compose project runs the backend with its own Neo4j database. It
does not attach to or modify other Compose projects on the instance.

This deployment is for disposable test data only. The API is served over
HTTPS at `https://sol.humantics.ai` through the instance's Nginx proxy; port
4000 is not published on the host. Do not use real accounts, passwords, or
personal data. Neo4j is not published to the host, registration is disabled,
and the API and database have container resource limits.

The `yarn run db:seed:redsol` seed requires distinct passwords of at least 8
characters for the seeded administrator and regular user when run in a
development environment. Supply `LIGHTSAIL_SEED_ADMIN_PASSWORD` and
`LIGHTSAIL_SEED_USER_PASSWORD` to the seed process; never reuse these passwords
for real accounts. The production image does not include the seed tooling. If
the seed was already run with its former default credentials, reset or remove
those seeded accounts before any future public exposure; changing the seed
script does not change existing database records.

The API limits HTTP requests to 120 per minute per client address, login
attempts to 10 per 15 minutes per address, JSON and form request bodies to
1 MiB, and GraphQL operations to 12 levels and 500 fields. WebSocket
connections are limited to 20 per minute per client address and use the same
GraphQL operation limits and login throttling. Persisted-query hash-only
requests are disabled so login throttling can inspect each operation. HTTP
headers and request bodies have 15- and 30-second receive timeouts. These
in-memory limits apply per backend process; deployments with multiple backend
instances need a shared rate-limit store.
The backend does not trust forwarded client-IP headers; if a trusted reverse
proxy is introduced later, configure its exact addresses before enabling proxy
trust or relying on address-based limits.

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

## Network access

External API traffic should go through the Nginx proxy on ports 80/443. The
backend listens on port 4000 inside Docker only. Remove any existing Lightsail
TCP 4000 firewall rules; do not use the former allowlist sync command, which
is disabled to prevent reopening the port.

```bash
./deployment/lightsail-test/deploy.sh allowlist list
```

The list command reports any legacy TCP 4000 firewall entries and requires
valid AWS CLI credentials for the selected profile and region.

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

The GraphQL endpoint is `https://sol.humantics.ai/graphql`. Do not expose
Neo4j ports 7474 or 7687.

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
