# Pitch Legends

Fill the gaps in football and entertainment names.

## How a session works

- A **streak** is 5 correct answers in a row. A miss, skip or timeout ends the session; points already earned stay.
- Everyone gets **2 streaks**. After the second the player can **bank** their points or **play on** to a third (max 3).
- Winning all 3 unlocks a **compulsory 4th streak**. Fail it and the session loses what a fully won 4th streak is worth (the total never drops below 0).
- Later streaks pay a higher points multiplier (x1, x1.5, x2, x3 by default) and are harder.
- A session expires 24 hours after it starts. A word does not come back for 30 days after you last played it.
- The **daily leaderboard** ranks players by points earned that day; ties go to more streaks, then who got there first. It resets at midnight Africa/Lagos time.

## Rules live in the database

Every number above is a row in the `game_rules` table (JSON in `value`), read at most every 15 seconds. Change them with SQL, no deploy:

```sql
UPDATE game_rules SET value = '[1,2,3,5]' WHERE key = 'streak_point_multipliers';
UPDATE game_rules SET value = '{"timezone":"Africa/Lagos","reset_hour":0,"size":100,"streak_bonus_pct":10,"min_points":1,"tie_breakers":["streaks_won","earliest_score"]}' WHERE key = 'leaderboard';
```

Keys: `questions_per_streak`, `entitled_streaks`, `max_streaks`, `compulsory_streak`, `streak_point_multipliers`, `question_multiplier_step`, `difficulty_ramp`, `difficulty_floor_by_streak`, `compulsory_penalty`, `leaderboard` (timezone, reset_hour, size, streak_bonus_pct, min_points, tie_breakers). Invalid values fall back to the defaults in `server/utils/rules.ts`, which also documents each key. `streak_bonus_pct` adds that percent to a player's leaderboard score for every streak they won that day (0 = rank by points only).

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
server/api/             HTTP routes: session, session/continue, puzzle/next|answer|hint, leaderboard, history, health
server/utils/           game engine, rules (from the DB), scoring, masks, time zones, db adapter, migrations, seeding
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

Tables: `users`, `puzzles`, `sessions` (one row per session, with its streak state), `plays` (one row per word served, which also drives the 30-day cooldown), `point_events` (every point gained or lost, stamped with its leaderboard day), `game_rules`, `schema_migrations`.
Migrations in `server/utils/migrate.ts` run on startup. Opening a database made by the Express version upgrades it in place and imports its history (the old tables are left untouched).

Add words by editing `server/database/seed/puzzles.json` and restarting; seeding only adds missing words and never deletes.

## Configuration

See `.env.example`. `SQLITE_DB_PATH` (default `./data/soccer_puzzle.db`), or `DATABASE_URL` for PostgreSQL.
