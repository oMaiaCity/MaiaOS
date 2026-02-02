# Dockerfile for maia-city static site
# NOTE: This Dockerfile should be run from monorepo root with:
# docker build -f services/maia-city/Dockerfile -t maia-city .
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy root package.json and lockfile
COPY package.json bun.lock ./

# Copy only workspace package.json files needed for builds
# Kernel bundle: @MaiaOS/db, @MaiaOS/self, @MaiaOS/script, @MaiaOS/schemata
# Vibes bundle: @MaiaOS/vibes (depends on kernel bundle)
# Transitive dependencies: @MaiaOS/operations, @MaiaOS/tools
COPY libs/maia-kernel/package.json libs/maia-kernel/
COPY libs/maia-db/package.json libs/maia-db/
COPY libs/maia-self/package.json libs/maia-self/
COPY libs/maia-script/package.json libs/maia-script/
COPY libs/maia-schemata/package.json libs/maia-schemata/
COPY libs/maia-operations/package.json libs/maia-operations/
COPY libs/maia-tools/package.json libs/maia-tools/
COPY libs/maia-vibes/package.json libs/maia-vibes/
COPY services/maia-city/package.json services/maia-city/

# Install dependencies (from root)
# Note: Using bun install without --frozen-lockfile since dependencies may have been updated
RUN bun install

# Copy source files needed for both kernel and vibes builds
COPY libs/maia-kernel/ libs/maia-kernel/
COPY libs/maia-db/ libs/maia-db/
COPY libs/maia-self/ libs/maia-self/
COPY libs/maia-script/ libs/maia-script/
COPY libs/maia-schemata/ libs/maia-schemata/
COPY libs/maia-operations/ libs/maia-operations/
COPY libs/maia-tools/ libs/maia-tools/
COPY libs/maia-vibes/ libs/maia-vibes/

# Build both bundles (kernel first, then vibes which depends on kernel)
RUN bun run bundles:build

# Copy maia-city source and build it (uses both kernel and vibes bundles)
COPY services/maia-city/ services/maia-city/
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
