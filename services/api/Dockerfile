# Use Bun image (pinned to specific version for consistency)
FROM oven/bun:1.3.2 as base
WORKDIR /app

# Install dependencies
FROM base AS install
RUN mkdir -p /temp/dev
# Copy root package.json and lockfile for monorepo workspace resolution
COPY package.json bun.lock* /temp/dev/
# Copy workspace package.json files and source
COPY services/api/package.json /temp/dev/services/api/
COPY libs/hominio-zero/ /temp/dev/libs/hominio-zero/
COPY libs/hominio-caps/ /temp/dev/libs/hominio-caps/
RUN cd /temp/dev && bun install --frozen-lockfile --ignore-scripts

# Build the app
FROM base AS build
# Copy node_modules from install stage
COPY --from=install /temp/dev/node_modules /app/node_modules
# Copy workspace structure (libs)
COPY --from=install /temp/dev/libs /app/libs
# Copy API service files
COPY services/api/ .

# Production image
FROM base AS release
COPY --from=install /temp/dev/node_modules node_modules
COPY --from=build /app/libs libs
COPY --from=build /app/src src
COPY --from=build /app/package.json .

# Set environment
ENV NODE_ENV=production
ENV PORT=4204
ENV HOST=0.0.0.0

# Expose port
EXPOSE 4204

# Run the server
CMD ["bun", "run", "src/index.ts"]

