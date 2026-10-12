# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build
RUN mkdir -p /app/data

# ---- run ----
FROM gcr.io/distroless/nodejs22-debian13:nonroot
ENV NODE_ENV=production \
    PORT=3000 \
    NITRO_PORT=3000 \
    SQLITE_DB_PATH=/app/data/soccer_puzzle.db
WORKDIR /app
# Nitro bundles the server and copies the few packages it needs (pg) into .output.
COPY --from=build --chown=65532:65532 /app/.output ./.output
COPY --from=build --chown=65532:65532 /app/data ./data
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
# Migrations run and the puzzle bank is seeded on startup; an existing database is upgraded in place.
CMD [".output/server/index.mjs"]
