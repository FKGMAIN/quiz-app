# ---- build ----
# Debian (glibc) here and in the runtime image, so any native binary Nitro traces into .output
# matches the platform it runs on. (Alpine/musl would not.)
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Reproducible install from the lockfile. If the lockfile was generated on macOS and lacks the Linux
# optional bindings (npm bug #4828), fall back to a fresh resolve instead of failing the build.
# To pin properly, regenerate it once:  npm install --package-lock-only --os=linux --cpu=x64 --libc=glibc
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY . .
RUN npm run build
RUN mkdir -p /app/data

# ---- run ----
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
     PORT=3000 \
     NITRO_PORT=3000 \
     SQLITE_DB_PATH=/app/data/soccer_puzzle.db
WORKDIR /app
# Nitro bundles the server and copies the few packages it needs (pg) into .output.
COPY --from=build --chown=65532:65532 /app/.output ./.output
# Owned by the nonroot user so SQLite can write; a bind-mounted host folder must be writable by uid 65532.
COPY --from=build --chown=65532:65532 /app/data ./data
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
     CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
# Migrations run and the puzzle bank is seeded on startup; an existing database is upgraded in place.
CMD [".output/server/index.mjs"]
