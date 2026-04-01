# Minimal static landing + AASA for maia.city
# From monorepo root: fly deploy --dockerfile services/landing/Dockerfile --config services/landing/fly.toml

FROM oven/bun:1-slim
WORKDIR /app

COPY services/landing/index.html ./
COPY services/landing/server.js ./
COPY services/landing/.well-known ./.well-known

EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080
CMD ["bun", "server.js"]
