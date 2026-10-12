// Versioned, forward-only migrations. Each runs once, in a transaction, and is recorded in
// schema_migrations. Works on a brand new database and on the one the old Express app created.

interface Migration {
  version: number
  name: string
  up(db: Db): Promise<void>
}

const pkSql = (db: Db) => (db.type === 'postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT')

async function tableExists(db: Db, name: string): Promise<boolean> {
  if (db.type === 'postgres') return !!(await db.get('SELECT to_regclass(?) AS t', [name]))?.t
  return !!(await db.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [name]))
}

async function columnsOf(db: Db, table: string): Promise<string[]> {
  if (db.type === 'postgres') {
    return (await db.query('SELECT column_name AS name FROM information_schema.columns WHERE table_name = ?', [table])).map(r => r.name)
  }
  return (await db.query(`PRAGMA table_info(${table})`)).map(r => r.name)
}

async function addColumn(db: Db, table: string, column: string, def: string) {
  if (!(await columnsOf(db, table)).includes(column)) await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`)
}

const isoFromLegacy = (db: Db, col: string) =>
  db.type === 'postgres' ? `to_char(${col}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')` : `strftime('%Y-%m-%dT%H:%M:%SZ', ${col})`

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'baseline users and puzzles',
    async up(db) {
      await db.exec(`CREATE TABLE IF NOT EXISTS users (
        phone_number TEXT PRIMARY KEY,
        created_at TEXT,
        last_active_at TEXT,
        score INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0
      )`)
      await db.exec(`CREATE TABLE IF NOT EXISTS puzzles (
        id ${pkSql(db)},
        word TEXT NOT NULL,
        word_key TEXT,
        category TEXT NOT NULL,
        domain TEXT NOT NULL DEFAULT 'entertainment',
        difficulty INTEGER NOT NULL DEFAULT 2
      )`)
      // Databases created by the old app are missing word_key; the rest already exist there.
      await addColumn(db, 'puzzles', 'word_key', 'TEXT')
      await addColumn(db, 'puzzles', 'domain', "TEXT NOT NULL DEFAULT 'entertainment'")
      await addColumn(db, 'puzzles', 'difficulty', 'INTEGER NOT NULL DEFAULT 2')
      await addColumn(db, 'users', 'wins', 'INTEGER DEFAULT 0')
      for (const r of await db.query('SELECT id, word FROM puzzles WHERE word_key IS NULL')) {
        await db.run('UPDATE puzzles SET word_key = ? WHERE id = ?', [wordKey(r.word), r.id])
      }
      await db.exec('DELETE FROM puzzles WHERE id NOT IN (SELECT MIN(id) FROM puzzles GROUP BY word_key)')
      await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_puzzles_word_key ON puzzles(word_key)')
      await db.exec('CREATE INDEX IF NOT EXISTS ix_puzzles_pick ON puzzles(difficulty, domain, category)')
    }
  },
  {
    version: 2,
    name: 'sessions and plays',
    async up(db) {
      await db.exec(`CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        phone_number TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        outcome TEXT,
        started_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        ended_at TEXT,
        correct INTEGER NOT NULL DEFAULT 0,
        points INTEGER NOT NULL DEFAULT 0,
        words INTEGER NOT NULL DEFAULT 0
      )`)
      await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS ux_sessions_active ON sessions(phone_number) WHERE status = 'active'")
      await db.exec('CREATE INDEX IF NOT EXISTS ix_sessions_phone ON sessions(phone_number, ended_at)')
      await db.exec(`CREATE TABLE IF NOT EXISTS plays (
        id ${pkSql(db)},
        session_id TEXT,
        phone_number TEXT NOT NULL,
        puzzle_id INTEGER NOT NULL,
        word_key TEXT NOT NULL,
        difficulty INTEGER,
        pattern TEXT,
        answer TEXT,
        tiles TEXT,
        served_at TEXT NOT NULL,
        answered_at TEXT,
        result TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        hint_gap INTEGER,
        points INTEGER NOT NULL DEFAULT 0,
        time_spent INTEGER
      )`)
      await db.exec('CREATE INDEX IF NOT EXISTS ix_plays_cooldown ON plays(phone_number, word_key, served_at)')
      await db.exec('CREATE INDEX IF NOT EXISTS ix_plays_session ON plays(session_id, answered_at)')
    }
  },
  {
    version: 3,
    name: 'import play data from the Express app',
    async up(db) {
      // Cooldown history: every word a number was served or answered becomes a play row.
      if (await tableExists(db, 'user_answers')) {
        await db.exec(`INSERT INTO plays (phone_number, puzzle_id, word_key, served_at, answered_at, result)
          SELECT a.phone_number, a.puzzle_id, p.word_key, ${isoFromLegacy(db, 'a.answered_at')}, ${isoFromLegacy(db, 'a.answered_at')},
                 CASE WHEN a.is_correct THEN 'correct' ELSE 'wrong' END
          FROM user_answers a JOIN puzzles p ON p.id = a.puzzle_id`)
      }
      if (await tableExists(db, 'user_served')) {
        await db.exec(`INSERT INTO plays (phone_number, puzzle_id, word_key, served_at)
          SELECT s.phone_number, s.puzzle_id, p.word_key, ${isoFromLegacy(db, 's.served_at')}
          FROM user_served s JOIN puzzles p ON p.id = s.puzzle_id`)
      }
      // Finished sessions.
      if (await tableExists(db, 'play_history')) {
        await db.exec(`INSERT INTO sessions (id, phone_number, status, outcome, started_at, expires_at, ended_at, correct, points, words)
          SELECT 'legacy-' || CAST(h.id AS TEXT), h.phone_number,
                 CASE h.outcome WHEN 'won' THEN 'won' WHEN 'expired' THEN 'expired' ELSE 'lost' END,
                 h.outcome, COALESCE(h.started_at, h.ended_at), h.ended_at, h.ended_at, h.streak, h.points, h.words
          FROM play_history h`)
      }
      // A run in progress carries over so nobody loses a streak in the cut-over.
      const cols = await columnsOf(db, 'users')
      if (cols.includes('session_started_at')) {
        const rows = await db.query('SELECT phone_number, streak, session_started_at, session_points, session_words FROM users WHERE session_started_at IS NOT NULL')
        for (const u of rows) {
          const started = new Date(u.session_started_at)
          if (isNaN(started.getTime()) || Date.now() - started.getTime() >= SESSION_MS) continue
          await db.run(
            "INSERT INTO sessions (id, phone_number, status, started_at, expires_at, correct, points, words) VALUES (?, ?, 'active', ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
            [crypto.randomUUID(), u.phone_number, started.toISOString(), new Date(started.getTime() + SESSION_MS).toISOString(),
              Math.max(0, Math.min(RUN_LEN - 1, num(u.streak) - 1)), num(u.session_points), num(u.session_words)]
          )
        }
      }
    }
  },
  {
    version: 4,
    name: 'drop clue-era puzzle columns',
    async up(db) {
      // The game shows only the masked word now; masks are generated per play.
      const have = await columnsOf(db, 'puzzles')
      for (const c of ['clue', 'masked_pattern', 'missing_letters', 'distractors', 'year', 'team', 'tuned']) {
        if (have.includes(c)) await db.exec(`ALTER TABLE puzzles DROP COLUMN ${c}`)
      }
    }
  },
  {
    version: 5,
    name: 'streaks, rules and daily leaderboard',
    async up(db) {
      // Streak state lives on the session so a refresh resumes exactly where the player was.
      await addColumn(db, 'sessions', 'streak_no', 'INTEGER NOT NULL DEFAULT 1')
      await addColumn(db, 'sessions', 'in_streak', 'INTEGER NOT NULL DEFAULT 0')
      await addColumn(db, 'sessions', 'streaks_won', 'INTEGER NOT NULL DEFAULT 0')
      await addColumn(db, 'sessions', 'phase', "TEXT NOT NULL DEFAULT 'playing'")   // 'playing' | 'between' (choosing to continue or bank)
      await addColumn(db, 'sessions', 'penalty', 'INTEGER NOT NULL DEFAULT 0')
      await addColumn(db, 'plays', 'streak_no', 'INTEGER')
      await addColumn(db, 'plays', 'position', 'INTEGER')
      // Old runs were four-in-a-row; a win counts as one streak. A run in progress keeps its progress.
      await db.exec("UPDATE sessions SET streaks_won = CASE WHEN outcome = 'won' THEN 1 ELSE 0 END WHERE id LIKE 'legacy-%'")
      await db.exec("UPDATE sessions SET in_streak = correct WHERE status = 'active' AND correct < 5")

      await db.exec(`CREATE TABLE IF NOT EXISTS game_rules (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TEXT
      )`)
      for (const [key, value] of Object.entries(DEFAULT_RULES)) {
        await db.run(
          'INSERT INTO game_rules (key, value, description, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (key) DO NOTHING',
          [key, JSON.stringify(value), (RULE_DESCRIPTIONS as Record<string, string>)[key], new Date().toISOString()]
        )
      }

      // Every point gained or lost, stamped with its leaderboard day, so the board is a simple sum.
      await db.exec(`CREATE TABLE IF NOT EXISTS point_events (
        id ${pkSql(db)},
        phone_number TEXT NOT NULL,
        session_id TEXT,
        kind TEXT NOT NULL,
        points INTEGER NOT NULL DEFAULT 0,
        streak_no INTEGER,
        day TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`)
      await db.exec('CREATE INDEX IF NOT EXISTS ix_point_events_day ON point_events(day, phone_number)')
    }
  }
]

export async function runMigrations(db: Db): Promise<number[]> {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)')
  const done = new Set((await db.query('SELECT version FROM schema_migrations')).map(r => num(r.version)))
  const applied: number[] = []
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue
    await db.tx(async tx => {
      await m.up(tx)
      await tx.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', [m.version, m.name, new Date().toISOString()])
    })
    console.log(`[db] migration ${m.version}: ${m.name}`)
    applied.push(m.version)
  }
  return applied
}
