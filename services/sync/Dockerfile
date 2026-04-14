# Dockerfile for sync service (WebSocket + agent API + LLM)
# Same pattern as app: build distros, run from built artifacts only. Never from source.
# Run from monorepo root: fly deploy --dockerfile services/sync/Dockerfile --config services/sync/fly.toml

# Build stage
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy monorepo
COPY package.json bun.lock* ./
COPY jsconfig.json ./
COPY libs ./libs
COPY services/app ./services/app
COPY services/sync ./services/sync
COPY scripts ./scripts

ENV HUSKY=0
RUN bun install
RUN bun run universe:registry
RUN bun run distros:build

# Runtime stage - single sync-server.mjs bundle + vendored pglite.wasm (no node_modules)
FROM oven/bun:1-slim
WORKDIR /app

COPY --from=builder /app/libs/maia-distros/output/sync-server.mjs ./
COPY --from=builder /app/libs/maia-distros/output/pglite.wasm ./

EXPOSE 4201

# Env: PEER_SYNC_STORAGE (from fly.toml). Secrets: AVEN_MAIA_ACCOUNT, AVEN_MAIA_SECRET, PEER_SYNC_DB_URL
CMD ["bun", "run", "sync-server.mjs"]
