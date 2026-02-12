# Dockerfile for unified sync service (WebSocket + agent API + LLM)
# Build from monorepo root: docker build -f services/sync/Dockerfile -t sync .

FROM oven/bun:1-slim

WORKDIR /app

# Copy workspace files
COPY package.json bun.lock ./
COPY services/moai ./services/moai
COPY libs ./libs

# Install dependencies (resolves workspace:* from root)
RUN bun install

# Moai runs on 4201
EXPOSE 4201

# Env: PEER_MODE, PEER_STORAGE (from fly.toml). Secrets: PEER_ID, PEER_SECRET, PEER_DB_URL
CMD ["bun", "run", "--cwd", "services/moai", "start"]
