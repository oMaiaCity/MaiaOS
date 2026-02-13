# Dockerfile for moai sync service (WebSocket + agent API + LLM)
# Same pattern as maia: build distros, run from built artifacts only. Never from source.
# Run from monorepo root: fly deploy --dockerfile services/moai/Dockerfile --config services/moai/fly.toml

# Build stage
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy monorepo
COPY package.json bun.lock* ./
COPY libs ./libs
COPY services/maia ./services/maia
COPY services/moai ./services/moai

ENV HUSKY=0
RUN bun install
RUN bun run distros:build

# Runtime stage - only built artifacts, no source, no node_modules
FROM oven/bun:1-slim
WORKDIR /app

COPY --from=builder /app/libs/maia-distros/output/moai-server.es.js ./
COPY --from=builder /app/libs/maia-distros/output/pglite.wasm ./

EXPOSE 4201

# Env: PEER_MODE, PEER_STORAGE (from fly.toml). Secrets: PEER_ID, PEER_SECRET, PEER_DB_URL
CMD ["bun", "moai-server.es.js"]
