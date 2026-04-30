# Built on Fly.io remote builders only (bun run deploy:aven). Not used with local docker.

FROM oven/bun:1-slim
WORKDIR /app

COPY services/aven/package.docker.json ./package.json
COPY services/aven/package.json ./services/aven/package.json
COPY libs/maia-mail/package.json ./libs/maia-mail/package.json
COPY libs/maia-logs/package.json ./libs/maia-logs/package.json
COPY services/aven/src ./services/aven/src
COPY services/aven/public ./services/aven/public
COPY libs/maia-mail/src ./libs/maia-mail/src
COPY libs/maia-logs/src ./libs/maia-logs/src

ENV HUSKY=0
RUN bun install --production

ENV NODE_ENV=production
ENV PORT=8080
ENV AVEN_HTTP_PORT=8080
ENV AVEN_SMTP_PORT=2525

EXPOSE 8080 2525

CMD ["bun", "run", "services/aven/src/index.js"]
