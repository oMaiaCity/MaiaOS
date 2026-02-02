# Dockerfile for server service
# NOTE: This Dockerfile should be run from monorepo root with:
# docker build -f services/server/Dockerfile -t server .
FROM oven/bun:1-slim

WORKDIR /app

# Copy server source
COPY services/server/ ./

# Copy maia-sync library source directly into server
COPY libs/maia-sync/src/ ./sync/

# Create minimal package.json with cojson dependencies
RUN echo '{"name":"server","type":"module","dependencies":{"cojson":"0.20.7","cojson-transport-ws":"0.20.7"}}' > package.json

# Install dependencies
RUN bun install

# Expose port
EXPOSE 4203

# Start server
CMD ["bun", "run", "src/index.js"]
