# Dockerfile for Zero sync service
# Use the official Zero Docker image as base
# Docker tag 0.24.3000000000 corresponds to npm package @rocicorp/zero@0.24.x
FROM rocicorp/zero:0.24.3000000000

WORKDIR /app

# Note: zero-schema.ts is no longer copied here as it's now in libs/hominio-zero/src/schema.ts
# The schema is deployed via GitHub Actions workflow using zero-deploy-permissions

# Override ENTRYPOINT to allow CMD override
# The Zero image likely has an ENTRYPOINT that we need to clear
ENTRYPOINT []

# Start zero-cache with required flags
# Map ZERO_POSTGRES_SECRET to ZERO_UPSTREAM_DB (Zero expects ZERO_UPSTREAM_DB)
# Required: --upstream-db (database connection)
# Required: --change-db (change database for replication log - uses same as upstream-db if not specified)
# Required: --replica-file (SQLite replica location in /data mount)
# Required: --auth-secret (for JWT verification - uses ZERO_AUTH_SECRET, set from AUTH_SECRET)
# Required: --admin-password (for admin endpoints - uses ZERO_ADMIN_AUTH, set from AUTH_SECRET)
#   Fallback to ZERO_AUTH_SECRET if ZERO_ADMIN_AUTH not set (both are set to AUTH_SECRET in production)
# Required: --port=4848 (explicitly set port - zero-cache listens on 0.0.0.0 when port is set)
# Required: --get-queries-url (for synced queries)
# Required: --push-url (for custom mutators)
# Cookie forwarding: --get-queries-forward-cookies and --mutate-forward-cookies
# Note: Migrations run via GitHub Actions before deployment
# Note: Schema permissions deployed via zero-deploy-permissions in GitHub Actions
CMD ["sh", "-c", "zero-cache --upstream-db=\"${ZERO_UPSTREAM_DB:-${ZERO_POSTGRES_SECRET}}\" --change-db=\"${ZERO_CHANGE_DB:-${ZERO_UPSTREAM_DB:-${ZERO_POSTGRES_SECRET}}}\" --replica-file=/data/zero-replica.db --auth-secret=\"${ZERO_AUTH_SECRET}\" --admin-password=\"${ZERO_ADMIN_AUTH:-${ZERO_AUTH_SECRET}}\" --port=4848 --get-queries-url=\"${ZERO_GET_QUERIES_URL}\" --push-url=\"${ZERO_PUSH_URL}\" --get-queries-forward-cookies --mutate-forward-cookies"]

