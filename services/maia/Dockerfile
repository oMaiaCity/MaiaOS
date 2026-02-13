# Dockerfile for maia-city static site
# Same pattern as moai: build distros, run from built artifacts only. Never from source.
# Run from monorepo root: fly deploy --dockerfile services/maia/Dockerfile --config services/maia/fly.toml

# Build stage
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy monorepo
COPY package.json bun.lock* ./
COPY libs ./libs
COPY services/maia ./services/maia
COPY services/moai ./services/moai

# VITE_PEER_MOAI must be set BEFORE distros:build - client bundle inlines sync domain
ARG VITE_PEER_MOAI=moai.next.maia.city
ENV VITE_PEER_MOAI=$VITE_PEER_MOAI
ARG VITE_PEER_MAIA=next.maia.city
ENV VITE_PEER_MAIA=$VITE_PEER_MAIA

ENV HUSKY=0
RUN bun install
RUN bun run distros:build

# Build maia frontend (uses client + vibes from distros)
RUN cd services/maia && \
  NODE_ENV=production \
  VITE_SEED_VIBES=all \
  VITE_PEER_MOAI=${VITE_PEER_MOAI:-moai.next.maia.city} \
  VITE_PEER_MAIA=${VITE_PEER_MAIA:-next.maia.city} \
  bunx vite build --mode production

# Runtime stage - only built SPA + static server, no source
FROM oven/bun:1-slim
WORKDIR /app

COPY --from=builder /app/services/maia/dist ./dist
COPY --from=builder /app/services/maia/server.js ./
COPY --from=builder /app/services/maia/package.json ./

EXPOSE 8080
CMD ["bun", "server.js"]
