# Dockerfile for maia-city static site
# Same pattern as sync: build distros, run from built artifacts only. Never from source.
# Run from monorepo root: fly deploy --dockerfile services/app/Dockerfile --config services/app/fly.toml

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

# VITE_PEER_SYNC_HOST must be set BEFORE distros:build - client bundle inlines sync domain
ARG VITE_PEER_SYNC_HOST=sync.next.maia.city
ENV VITE_PEER_SYNC_HOST=$VITE_PEER_SYNC_HOST

ENV HUSKY=0
RUN bun install
# GIT_SHA must change per commit so remote BuildKit cannot reuse a stale distros bundle layer
ARG GIT_SHA=unknown
RUN echo "GIT_SHA=${GIT_SHA}" && bun run universe:registry && bun run distros:build

# Generate favicons (sync-assets runs inside build.js, outputs to dist/brand)
RUN bun scripts/generate-favicons.js

# Build app frontend (runs sync-assets → dist/brand, then bundles)
# serverOwnsVibes is standard default (not configurable): minimal human account + symlink via /syncRegistry
RUN cd services/app && \
  NODE_ENV=production \
  VITE_PEER_SYNC_HOST=${VITE_PEER_SYNC_HOST:-sync.next.maia.city} \
  bun build.js

# Runtime stage - only built SPA + static server, no source
FROM oven/bun:1-slim
WORKDIR /app

COPY --from=builder /app/services/app/dist ./dist
COPY --from=builder /app/services/app/server.js ./
COPY --from=builder /app/services/app/package.json ./

EXPOSE 8080
CMD ["bun", "server.js"]
