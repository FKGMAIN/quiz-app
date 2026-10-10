# Use official Node.js runtime (Debian slim includes glibc required by sqlite3 prebuilt binaries)
FROM node:20-bookworm-slim

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    DB_TYPE=sqlite \
    SQLITE_DB_PATH=/app/data/soccer_puzzle.db

# Set working directory
WORKDIR /app

# Install dependencies first for efficient layer caching
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application source code and bundled SQLite database
COPY . .

# Create volume mount point for SQLite database persistence and adjust ownership
RUN mkdir -p /app/data && chown -R node:node /app

# Ensure entrypoint script is executable
RUN chmod +x /app/docker-entrypoint.sh

# Expose web application port
EXPOSE 3000

# Mount persistent data directory
VOLUME ["/app/data"]

# Switch to non-root user
USER node

# Healthcheck to verify the server and SQLite database are responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/api/categories', (res) => res.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"

# Entrypoint initializes SQLite DB file if missing in volume
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Start the application
CMD ["node", "server.js"]
