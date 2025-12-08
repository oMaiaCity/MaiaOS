# Use Bun image (pinned to specific version for consistency)
FROM oven/bun:1.3.2 as base
WORKDIR /app

# Install dependencies
FROM base AS install
RUN mkdir -p /temp/dev
# Copy root package.json and lockfile for monorepo workspace resolution
COPY package.json bun.lock* /temp/dev/
# Copy me service package.json
COPY services/me/package.json /temp/dev/services/me/
# Copy full libs BEFORE install (Bun needs full workspace structure, same as wallet service)
COPY libs/hominio-brand/ /temp/dev/libs/hominio-brand/
COPY libs/hominio-data/ /temp/dev/libs/hominio-data/
# Install dependencies with workspace resolution
RUN cd /temp/dev && bun install --ignore-scripts

# Build the app
FROM base AS build
# Copy the entire workspace structure from install stage (preserves workspace)
COPY --from=install /temp/dev /app
# Copy me service source files (overwrite package.json copy from install)
COPY services/me/ /app/services/me/
# Copy sync-assets script to scripts folder
COPY scripts/sync-assets.js /app/scripts/sync-assets.js

# Sync brand assets to static folder before build
RUN node scripts/sync-assets.js

# Run build from monorepo root with filter (preserves workspace context)
WORKDIR /app/services/me
# Generate SvelteKit config before build
RUN bunx svelte-kit sync
RUN bun run build

# Production image
FROM base AS release
COPY --from=install /temp/dev/node_modules node_modules
COPY --from=build /app/services/me/build build
COPY --from=build /app/services/me/package.json .
# Copy libs for runtime (needed for @hominio/brand, @hominio/data)
COPY --from=build /app/libs libs

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Expose port
EXPOSE 3000

# Start the app using Bun (adapter-node creates build/index.js)
CMD ["bun", "build/index.js"]

