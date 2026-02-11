# Dockerfile for sync service
# NOTE: Kernel bundle must be built locally before Docker build:
#   bun run bundles:build
# This Dockerfile should be run from monorepo root with:
#   docker build -f services/sync/Dockerfile -t sync .

FROM oven/bun:1-slim

WORKDIR /app

# Copy sync service source
COPY services/sync/ ./

# Copy pre-built kernel bundle (built locally via bun run bundles:build)
# The bundle exports everything from @MaiaOS/kernel
COPY libs/maia-kernel/dist/ ./node_modules/@MaiaOS/kernel/dist/
COPY libs/maia-kernel/package.json ./node_modules/@MaiaOS/kernel/package.json
# Update package.json exports to use bundle instead of src (src has workspace deps that don't exist in Docker)
RUN echo '{ \
  "name": "@MaiaOS/kernel", \
  "version": "0.1.23", \
  "type": "module", \
  "main": "./dist/maia-kernel.es.js", \
  "exports": { \
    ".": "./dist/maia-kernel.es.js", \
    "./bundle": { \
      "import": "./dist/maia-kernel.es.js", \
      "require": "./dist/maia-kernel.umd.js" \
    } \
  } \
}' > ./node_modules/@MaiaOS/kernel/package.json

# Copy @MaiaOS/sync library (required for createSyncServer - import resolves to node_modules)
COPY libs/maia-sync/ ./node_modules/@MaiaOS/sync/

# Overwrite maia-sync package.json - remove workspace:* so Bun doesn't resolve to libs/maia-sync paths
# Use file: reference for kernel (sibling in node_modules/@MaiaOS/)
RUN echo '{ \
  "name": "@MaiaOS/sync", \
  "version": "0.1.23", \
  "type": "module", \
  "main": "src/index.js", \
  "exports": {".": "./src/index.js"}, \
  "dependencies": { \
    "cojson": "0.20.7", \
    "cojson-transport-ws": "0.20.7", \
    "@MaiaOS/kernel": "file:../kernel" \
  } \
}' > ./node_modules/@MaiaOS/sync/package.json

# Create package.json with all required dependencies
RUN echo '{ \
  "name": "sync", \
  "type": "module", \
  "dependencies": { \
    "cojson": "0.20.7", \
    "cojson-transport-ws": "0.20.7", \
    "@electric-sql/pglite": "latest", \
    "cojson-storage-indexeddb": "0.20.7" \
  } \
}' > package.json

# Install root dependencies
RUN bun install

# Install @MaiaOS/sync deps in place - Bun resolves cojson-transport-ws from package's node_modules
RUN cd node_modules/@MaiaOS/sync && bun install --production

# Expose port
EXPOSE 4203

# Start server
CMD ["bun", "run", "src/index.js"]
