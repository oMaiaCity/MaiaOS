# Dockerfile for maia-city static site
# NOTE: Bundles must be built locally before Docker build:
#   bun run bundles:build
# This Dockerfile should be run from monorepo root with:
#   docker build -f services/maia-city/Dockerfile -t maia-city .
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy root package.json and lockfile
COPY package.json bun.lock ./

# Copy maia-city package.json
COPY services/maia-city/package.json services/maia-city/

# Create minimal workspace package.json files for Bun to resolve workspace dependencies
# These will be replaced with node_modules versions after install
RUN mkdir -p libs/maia-kernel libs/maia-vibes && \
  echo '{"name":"@MaiaOS/kernel","version":"0.1.23","type":"module"}' > libs/maia-kernel/package.json && \
  echo '{"name":"@MaiaOS/vibes","version":"0.1.23","type":"module"}' > libs/maia-vibes/package.json

# Install dependencies (Bun will resolve workspace deps from libs/ directories)
RUN bun install

# Copy pre-built bundles (built locally via bun run bundles:build)
# Kernel bundle - copy to node_modules and update package.json
COPY libs/maia-kernel/dist/ ./node_modules/@MaiaOS/kernel/dist/
RUN mkdir -p ./node_modules/@MaiaOS/kernel && echo '{ \
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

# Vibes bundle - copy to node_modules and update package.json
COPY libs/maia-vibes/dist/ ./node_modules/@MaiaOS/vibes/dist/
RUN mkdir -p ./node_modules/@MaiaOS/vibes && echo '{ \
  "name": "@MaiaOS/vibes", \
  "version": "0.1.23", \
  "type": "module", \
  "main": "./dist/maia-vibes.es.js", \
  "exports": { \
    ".": "./dist/maia-vibes.es.js", \
    "./bundle": { \
      "import": "./dist/maia-vibes.es.js", \
      "require": "./dist/maia-vibes.umd.js" \
    } \
  } \
}' > ./node_modules/@MaiaOS/vibes/package.json

# Copy maia-city source and build it (uses both kernel and vibes bundles)
# NOTE: Only pre-bundled kernel and vibes are needed - no source files required
COPY services/maia-city/ services/maia-city/

# Accept build arg for Vite env vars (for vibe seeding config)
# VITE_SEED_VIBES can be: "all" = seed all vibes (default), or "todos,maia" = specific vibes
# Set via: flyctl secrets set VITE_SEED_VIBES="all" --app next-maia-city
# Then pass via: --build-arg VITE_SEED_VIBES=all (deploy script handles this)
ARG VITE_SEED_VIBES=all
ENV VITE_SEED_VIBES=${VITE_SEED_VIBES}

# Build with Vite directly (bundles already pre-built, skip bundles:build step)
# Set NODE_ENV=production explicitly so Vite uses production mode
# Vite automatically reads VITE_* env vars from process.env and bakes them into the bundle
# Use bunx to ensure vite is available
# Explicitly pass VITE_SEED_VIBES to ensure it's available during build
RUN cd services/maia-city && NODE_ENV=production VITE_SEED_VIBES=${VITE_SEED_VIBES} bunx vite build --mode production 2>&1 || (echo "Vite build failed with exit code $?" && cat /tmp/flyctl-deploy.log 2>/dev/null || true && exit 1)

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
