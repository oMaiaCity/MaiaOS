# Dockerfile for maia-city static site
# Build runs inside Docker - VITE_PEER_MOAI from fly.toml [build.args]
# Run from monorepo root: fly deploy --dockerfile services/maia/Dockerfile --config services/maia/fly.toml

# Build stage
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy monorepo (package.json, workspaces)
COPY package.json bun.lock* ./
COPY libs ./libs
COPY services/maia ./services/maia
COPY services/moai ./services/moai

# VITE_PEER_MOAI must be set BEFORE bundles:build - kernel bundle contains sync logic and inlines this
ARG VITE_PEER_MOAI=moai.next.maia.city
ENV VITE_PEER_MOAI=$VITE_PEER_MOAI
ARG VITE_PEER_MAIA=next.maia.city
ENV VITE_PEER_MAIA=$VITE_PEER_MAIA

# Build kernel + vibes bundles (kernel needs VITE_PEER_MOAI for sync domain)
# HUSKY=0 skips prepare script (git hooks not needed in Docker)
ENV HUSKY=0
RUN bun install
RUN bun run bundles:build

# Build maia frontend - explicit vars override any .env that might leak into context
RUN cd services/maia && \
  NODE_ENV=production \
  VITE_SEED_VIBES=all \
  VITE_PEER_MOAI=${VITE_PEER_MOAI:-moai.next.maia.city} \
  VITE_PEER_MAIA=${VITE_PEER_MAIA:-next.maia.city} \
  bunx vite build --mode production

# Runtime stage
FROM oven/bun:1-slim
WORKDIR /app

COPY --from=builder /app/services/maia/dist ./dist
COPY --from=builder /app/services/maia/server.js ./
COPY --from=builder /app/services/maia/package.json ./

EXPOSE 8080
CMD ["bun", "run", "server.js"]
