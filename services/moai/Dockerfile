# Dockerfile for unified sync service (WebSocket + agent API + LLM)
# Build from monorepo root: docker build -f services/sync/Dockerfile -t sync .

FROM oven/bun:1-slim

WORKDIR /app

# Copy workspace files
COPY package.json bun.lockb ./
COPY services/moai ./services/moai
COPY libs ./libs

# Install dependencies (resolves workspace:* from root)
RUN bun install --frozen-lockfile

# Moai runs on 4201
EXPOSE 4201

# Env: ACCOUNT_MODE, AGENT_ID, AGENT_SECRET, AGENT_STORAGE, DB_PATH, RED_PILL_API_KEY
# Secrets: fly secrets set AGENT_ID=... AGENT_SECRET=...
CMD ["bun", "run", "--cwd", "services/moai", "start"]
