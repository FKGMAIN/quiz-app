# Pitch Legends

Fill the gaps in football and entertainment names. Four correct in a row wins a run; every run expires after 24 hours; a word does not come back for 30 days after you last played it.

Nuxt 4 (Vue 3, SPA mode) with Nitro server routes. SQLite by default (Node's built-in `node:sqlite`, no native build) or PostgreSQL.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # server logic, against throwaway databases
npm run build && npm run preview
```

Needs Node 22.13 or newer. Docker: `docker compose up --build`.

## Layout

```
app/                    Vue client (pages, components, composables)
server/api/             HTTP routes: session, puzzle/next|answer|hint, history, health
server/utils/           game rules, scoring, masks, db adapter, migrations, seeding
server/database/seed/   puzzles.json, the word bank: [word, category, domain, difficulty]
test/                   node:test suite; runs the real server code under plain Node
legacy/                 the previous Express app, kept for reference
```

## How the server keeps it honest

- The browser never receives the answer. `GET /api/puzzle/next` returns the masked word and the letter tiles.
- `POST /api/puzzle/answer` takes the letters the player placed and the server decides if they are right, measures the time, and awards points.
- The word on screen is stored per run, so a refresh returns the same word and the same clock.
- A hint (`POST /api/puzzle/hint`) is one per word and the letter comes from the server.
- Answers run in a transaction and a finished word cannot be answered twice.

## Data

Tables: `users`, `puzzles`, `sessions` (one row per run), `plays` (one row per word served, which also drives the 30-day cooldown), `schema_migrations`.
Migrations in `server/utils/migrate.ts` run on startup. Opening a database made by the Express version upgrades it in place and imports its history (the old tables are left untouched).

Add words by editing `server/database/seed/puzzles.json` and restarting; seeding only adds missing words and never deletes.

## Configuration

See `.env.example`. `SQLITE_DB_PATH` (default `./data/soccer_puzzle.db`), or `DATABASE_URL` for PostgreSQL.
