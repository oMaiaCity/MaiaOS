# Dockerfile for maia-city static site
# NOTE: Full build must be done locally before Docker:
#   bun run bundles:build
#   cd services/maia-city && vite build
# This avoids workspace resolution issues in Docker (deploy script runs build)
# Run from monorepo root: docker build -f services/maia-city/Dockerfile -t maia-city .
FROM oven/bun:1-slim

WORKDIR /app

# Copy pre-built output (deploy script runs vite build locally first)
COPY services/maia-city/dist ./dist
COPY services/maia-city/server.js ./
COPY services/maia-city/package.json ./

# Expose port
EXPOSE 8080

# Start server (server.js uses only Node built-ins + Bun - no deps needed)
CMD ["bun", "run", "server.js"]
