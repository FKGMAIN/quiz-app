#!/bin/sh
set -e

export DB_TYPE="${DB_TYPE:-sqlite}"
export SQLITE_DB_PATH="${SQLITE_DB_PATH:-/app/data/soccer_puzzle.db}"

# If using SQLite, ensure directory exists and initialize DB if needed
if [ "$DB_TYPE" = "sqlite" ]; then
  DB_DIR="$(dirname "$SQLITE_DB_PATH")"
  mkdir -p "$DB_DIR" 2>/dev/null || true

  # If persistent target DB file does not exist, copy bundled template
  if [ ! -f "$SQLITE_DB_PATH" ] && [ -f "/app/soccer_puzzle.db" ]; then
    echo "[Pitch Legends] Initializing SQLite database at $SQLITE_DB_PATH from bundled template..."
    cp /app/soccer_puzzle.db "$SQLITE_DB_PATH" 2>/dev/null || true
  fi
fi

exec "$@"
