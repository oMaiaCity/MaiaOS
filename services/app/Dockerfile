# Use Bun image (pinned to specific version for consistency)
FROM oven/bun:1.3.2 as base
WORKDIR /app

# Install dependencies
FROM base AS install
RUN mkdir -p /temp/dev
# Copy root package.json and lockfile for monorepo workspace resolution
COPY package.json bun.lock* /temp/dev/
# Copy workspace package.json files and source
COPY services/app/package.json /temp/dev/services/app/
COPY libs/hominio-vibes/ /temp/dev/libs/hominio-vibes/
COPY libs/hominio-voice/ /temp/dev/libs/hominio-voice/
COPY libs/hominio-brand/ /temp/dev/libs/hominio-brand/
RUN cd /temp/dev && bun install --ignore-scripts

# Build the app
FROM base AS build
# Copy node_modules from install stage (hoisted to root /app/node_modules)
COPY --from=install /temp/dev/node_modules /app/node_modules
# Copy workspace structure (libs to /app/libs)
COPY --from=install /temp/dev/libs /app/libs
# Copy app service files preserving directory structure
# This ensures relative paths (../../libs) work identically to local dev
COPY services/app/ /app/services/app/
# Copy sync-assets script to scripts folder
COPY scripts/sync-assets.js /app/scripts/sync-assets.js

# Sync brand assets to static folder before build
# Run from root /app so script finds paths as expected (libs/... -> services/app/...)
RUN node scripts/sync-assets.js

# Switch to service directory for build
WORKDIR /app/services/app

# Run svelte-kit sync before build to generate .svelte-kit directory
# This is required because jsconfig.json extends ./.svelte-kit/tsconfig.json
# Use bunx to run svelte-kit sync (Bun's equivalent of npx)
# Fail hard if sync fails - stale cache can cause hard-to-debug runtime errors
RUN bunx svelte-kit sync
RUN bun run build

# Production image
FROM base AS release
WORKDIR /app/services/app
COPY --from=install /temp/dev/node_modules /app/node_modules
COPY --from=build /app/services/app/build build
COPY --from=build /app/services/app/package.json .
# Copy libs for runtime
COPY --from=build /app/libs /app/libs

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Expose port
EXPOSE 3000

# Start the app using Bun (adapter-node creates build/index.js)
CMD ["bun", "build/index.js"]
