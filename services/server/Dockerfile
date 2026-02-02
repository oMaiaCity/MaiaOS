# Dockerfile for server service
# NOTE: This Dockerfile should be run from monorepo root with:
# docker build -f services/server/Dockerfile -t server .
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy root package.json and lockfile
COPY package.json bun.lock ./

# Copy workspace package.json files needed
COPY libs/maia-sync/package.json libs/maia-sync/
COPY services/server/package.json services/server/

# Install dependencies (from root)
RUN bun install

# Copy source files
COPY libs/maia-sync/ libs/maia-sync/
COPY services/server/ services/server/

# Production stage
FROM oven/bun:1-slim

WORKDIR /app

# Copy built files
COPY --from=builder /app/services/server/ ./
COPY --from=builder /app/libs/maia-sync/ ./node_modules/@MaiaOS/sync/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lock ./

# Expose port
EXPOSE 4203

# Start server
CMD ["bun", "run", "src/index.ts"]
