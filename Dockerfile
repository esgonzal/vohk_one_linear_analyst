FROM node:22.16.0-bookworm-slim

ENV NODE_ENV=production \
    HOME=/app \
    CODEX_HOME=/app/.codex

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY migrations ./migrations
COPY scripts ./scripts
COPY src ./src
RUN mkdir -p /app/.data /app/.codex && chown -R node:node /app
USER node
EXPOSE 8787
CMD ["sh", "-c", "npm run migrate && npm start"]

