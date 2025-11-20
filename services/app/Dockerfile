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
COPY libs/hominio-auth/ /temp/dev/libs/hominio-auth/
COPY libs/hominio-zero/ /temp/dev/libs/hominio-zero/
COPY libs/hominio-caps/ /temp/dev/libs/hominio-caps/
RUN cd /temp/dev && bun install --frozen-lockfile --ignore-scripts

# Build the app
FROM base AS build
# Copy node_modules from install stage
COPY --from=install /temp/dev/node_modules /app/node_modules
# Copy workspace structure (libs for @hominio/auth)
COPY --from=install /temp/dev/libs /app/libs
# Copy app service files
COPY services/app/ .
RUN cd /app && bun run build

# Production image
FROM base AS release
COPY --from=install /temp/dev/node_modules node_modules
COPY --from=build /app/build build
COPY --from=build /app/package.json .
# Copy libs for runtime (needed for @hominio/auth)
COPY --from=build /app/libs libs

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Expose port
EXPOSE 3000

# Start the app using Bun (adapter-node creates build/index.js)
CMD ["bun", "build/index.js"]
