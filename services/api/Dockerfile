FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
# Copy package.json and lockfile
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Expose port
EXPOSE 4204

# Run the server
CMD ["bun", "run", "src/index.ts"]

