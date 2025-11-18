# Dockerfile for Zero sync service
# Use the official Zero Docker image as base
# Docker tag 0.24.3000000000 corresponds to npm package @rocicorp/zero@0.24.x
FROM rocicorp/zero:0.24.3000000000

WORKDIR /app

# Copy zero-schema.ts (required for zero-deploy-permissions)
COPY zero-schema.ts ./

# Override ENTRYPOINT to allow CMD override
# The Zero image likely has an ENTRYPOINT that we need to clear
ENTRYPOINT []

# Start zero-cache with required flags
# Map ZERO_POSTGRES_SECRET to ZERO_UPSTREAM_DB (Zero expects ZERO_UPSTREAM_DB)
# Required: --upstream-db (database connection)
# Required: --change-db (change database for replication log - uses same as upstream-db if not specified)
# Required: --replica-file (SQLite replica location in /data mount)
# Required: --auth-secret (for JWT verification)
# Required: --get-queries-url (for synced queries)
# Required: --push-url (for custom mutators)
# Cookie forwarding: --get-queries-forward-cookies and --mutate-forward-cookies
# Note: Migrations run via GitHub Actions before deployment
# Note: Schema permissions deployed via zero-deploy-permissions in GitHub Actions
CMD ["sh", "-c", "zero-cache --upstream-db=\"${ZERO_UPSTREAM_DB:-${ZERO_POSTGRES_SECRET}}\" --change-db=\"${ZERO_CHANGE_DB:-${ZERO_UPSTREAM_DB:-${ZERO_POSTGRES_SECRET}}}\" --replica-file=/data/zero-replica.db --auth-secret=\"${ZERO_AUTH_SECRET}\" --get-queries-url=\"${ZERO_GET_QUERIES_URL}\" --push-url=\"${ZERO_PUSH_URL}\" --get-queries-forward-cookies --mutate-forward-cookies"]

