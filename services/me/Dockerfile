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
# Force fresh install by removing lockfiles to avoid resolution issues
RUN rm -f bun.lock*
RUN cd /temp/dev && bun install --ignore-scripts

# Copy workspace source files after install (to preserve workspace structure)
COPY libs/hominio-brand/ /temp/dev/libs/hominio-brand/
COPY libs/hominio-data/ /temp/dev/libs/hominio-data/

# Build the app
FROM base AS build
# Copy node_modules from install stage (hoisted to root /app/node_modules)
COPY --from=install /temp/dev/node_modules /app/node_modules
# Copy workspace structure (libs to /app/libs)
COPY --from=install /temp/dev/libs /app/libs
# Copy me service files preserving directory structure (same as app service)
# This ensures relative paths (../../libs) work identically to local dev
COPY services/me/ /app/services/me/
# Copy sync-assets script to scripts folder
COPY scripts/sync-assets.js /app/scripts/sync-assets.js

# Sync brand assets to static folder before build
# Run from root /app so script finds paths as expected (libs/... -> services/me/...)
RUN node scripts/sync-assets.js

# Switch to service directory for build (same as app service)
WORKDIR /app/services/me

# Debug: List package content to verify build artifacts
RUN echo "Checking vite-plugin-svelte content:" && ls -R /app/node_modules/@sveltejs/vite-plugin-svelte/

# Link node_modules to service directory to ensure resolution works
# This fixes "Cannot find module" error when running svelte-kit sync
RUN ln -s /app/node_modules /app/services/me/node_modules

# Run svelte-kit sync before build to generate .svelte-kit directory
# This is required because tsconfig.json extends ./.svelte-kit/tsconfig.json
# Use bunx to run svelte-kit sync (Bun's equivalent of npx)
RUN bunx svelte-kit sync
RUN bun run build

# Production image
FROM base AS release
WORKDIR /app/services/me
COPY --from=install /temp/dev/node_modules /app/node_modules
COPY --from=build /app/services/me/build build
COPY --from=build /app/services/me/package.json .
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

