# Use Bun image (pinned to specific version for consistency)
FROM oven/bun:1.3.2 as base
WORKDIR /app

# Install dependencies
FROM base AS install
RUN mkdir -p /temp/dev
# Copy root package.json and lockfile for monorepo workspace resolution
# Lockfile helps bunx resolve packages correctly (same as app service)
COPY package.json bun.lock* /temp/dev/
# Copy all workspace package.json files (required for proper workspace resolution)
COPY services/me/package.json /temp/dev/services/me/
COPY libs/hominio-brand/package.json /temp/dev/libs/hominio-brand/
COPY libs/hominio-data/package.json /temp/dev/libs/hominio-data/
# Install dependencies with workspace resolution
RUN cd /temp/dev && bun install --ignore-scripts
# Copy workspace source files after install (to preserve workspace structure)
COPY libs/hominio-brand/ /temp/dev/libs/hominio-brand/
COPY libs/hominio-data/ /temp/dev/libs/hominio-data/

# Build the app
FROM base AS build
# Copy root package.json (required for workspace resolution)
# Note: bun.lockb is not needed in build stage - dependencies are already installed
COPY --from=install /temp/dev/package.json /app/package.json
# Copy node_modules from install stage (hoisted to root /app/node_modules)
COPY --from=install /temp/dev/node_modules /app/node_modules
# Copy workspace package.json files (required for Bun workspace resolution)
# Create directories first to ensure proper structure
RUN mkdir -p /app/libs/hominio-brand /app/libs/hominio-data
COPY --from=install /temp/dev/libs/hominio-brand/package.json /app/libs/hominio-brand/package.json
COPY --from=install /temp/dev/libs/hominio-data/package.json /app/libs/hominio-data/package.json
# Copy workspace structure (libs to /app/libs) - must match workspace config
COPY --from=install /temp/dev/libs /app/libs
# Copy me service files to root (same as wallet service pattern)
# This ensures vite.config.ts can resolve vite from /app/node_modules
COPY services/me/ /app/
# Copy sync-assets script to scripts folder
COPY scripts/sync-assets.js /app/scripts/sync-assets.js

# Sync brand assets to static folder before build
RUN node scripts/sync-assets.js

# Build the app (same simple pattern as wallet service)
# Run build from root (same as wallet: cd /app && bun run build)
# Set NODE_ENV for vite config path resolution
ENV NODE_ENV=production
RUN cd /app && bun run build:docker

# Production image
FROM base AS release
WORKDIR /app
COPY --from=install /temp/dev/node_modules /app/node_modules
COPY --from=build /app/build build
COPY --from=build /app/package.json .
# Copy libs for runtime (needed for @hominio/brand, @hominio/data)
COPY --from=build /app/libs /app/libs

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Expose port
EXPOSE 3000

# Start the app using Bun (adapter-node creates build/index.js)
CMD ["bun", "build/index.js"]

