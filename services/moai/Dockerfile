# Dockerfile for unified sync service (WebSocket + agent API + LLM)
# Build from monorepo root: docker build -f services/sync/Dockerfile -t sync .

FROM oven/bun:1-slim

WORKDIR /app

# Copy workspace files (all workspaces required by root package.json)
COPY package.json bun.lock* ./
COPY libs ./libs
COPY services/maia ./services/maia
COPY services/moai ./services/moai

# Install dependencies (resolves workspace:* from root)
# HUSKY=0 skips prepare script (git hooks not needed in Docker)
ENV HUSKY=0
RUN bun install

# Moai runs on 4201
EXPOSE 4201

# Env: PEER_MODE, PEER_STORAGE (from fly.toml). Secrets: PEER_ID, PEER_SECRET, PEER_DB_URL
CMD ["bun", "run", "--cwd", "services/moai", "start"]
