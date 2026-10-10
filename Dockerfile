# ---- build ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build

# ---- run ----
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    NITRO_PORT=3000 \
    SQLITE_DB_PATH=/app/data/soccer_puzzle.db
WORKDIR /app
# Nitro bundles the server and copies the few packages it needs (pg) into .output.
COPY --from=build /app/.output ./.output
RUN mkdir -p /app/data && chown -R node:node /app
VOLUME ["/app/data"]
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
# Migrations run and the puzzle bank is seeded on startup; an existing database is upgraded in place.
CMD ["node", ".output/server/index.mjs"]
