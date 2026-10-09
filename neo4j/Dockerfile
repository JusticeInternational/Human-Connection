FROM neo4j:3.5.14-enterprise
LABEL Description="Neo4J database of the Social Network Human-Connection.org with preinstalled database constraints and indices" Vendor="Human Connection gGmbH" Version="0.0.1" Maintainer="Human Connection gGmbH (developer@human-connection.org)"

ARG BUILD_COMMIT
ENV BUILD_COMMIT=$BUILD_COMMIT

COPY plugins/apoc-3.5.0.4-all.jar plugins/
