# Dockerfile for maia-city static site
# NOTE: This Dockerfile should be run from monorepo root with:
# docker build -f services/maia-city/Dockerfile -t maia-city .
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy root package.json and lockfile
COPY package.json bun.lock ./

# Copy package.json files for workspace resolution
COPY libs/maia-kernel/package.json libs/maia-kernel/
COPY services/maia-city/package.json services/maia-city/

# Install dependencies (from root)
RUN bun install --frozen-lockfile

# Copy source files needed for build
COPY libs/maia-kernel/ libs/maia-kernel/
COPY services/maia-city/ services/maia-city/

# Build kernel bundle first
RUN cd libs/maia-kernel && bun run build

# Build maia-city frontend
RUN cd services/maia-city && bun run build

# Production stage
FROM oven/bun:1-slim

WORKDIR /app

# Copy built files and server
COPY --from=builder /app/services/maia-city/dist ./dist
COPY --from=builder /app/services/maia-city/server.js ./
COPY --from=builder /app/services/maia-city/package.json ./

# Expose port
EXPOSE 8080

# Start server
CMD ["bun", "run", "server.js"]
