// Database Abstraction Layer supporting SQLite or PostgreSQL
const path = require('path');

const DB_TYPE = (process.env.DB_TYPE || (process.env.DATABASE_URL ? 'postgres' : 'sqlite')).toLowerCase();

let dbInstance = null;

class DatabaseAdapter {
  constructor() {
    this.type = DB_TYPE;
    this.client = null;
  }

  async init() {
    if (this.type === 'postgres') {
      const { Pool } = require('pg');
      const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/soccer_puzzle';
      this.client = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      console.log('Connected to PostgreSQL database');
    } else {
      const sqlite3 = require('sqlite3').verbose();
      const dbPath = path.join(__dirname, 'soccer_puzzle.db');
      this.client = await new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
          if (err) reject(err);
          else resolve(db);
        });
      });
      console.log(`Connected to SQLite database at ${dbPath}`);
    }

    await this.createSchema();
    await this.migrate();
  }

  async createSchema() {
    if (this.type === 'postgres') {
      await this.query(`
        CREATE TABLE IF NOT EXISTS users (
          phone_number VARCHAR(32) PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          score INTEGER DEFAULT 0,
          streak INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS puzzles (
          id SERIAL PRIMARY KEY,
          word VARCHAR(64) NOT NULL,
          category VARCHAR(64) NOT NULL,
          clue TEXT NOT NULL,
          masked_pattern VARCHAR(64) NOT NULL,
          missing_letters VARCHAR(64) NOT NULL,
          distractors VARCHAR(64) NOT NULL,
          year VARCHAR(16),
          team VARCHAR(64),
          difficulty INTEGER DEFAULT 2
        );

        CREATE TABLE IF NOT EXISTS user_answers (
          id SERIAL PRIMARY KEY,
          phone_number VARCHAR(32) NOT NULL,
          puzzle_id INTEGER NOT NULL,
          is_correct BOOLEAN DEFAULT TRUE,
          answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_user_answers_phone_time ON user_answers(phone_number, answered_at);

        CREATE TABLE IF NOT EXISTS user_served (
          id SERIAL PRIMARY KEY,
          phone_number VARCHAR(32) NOT NULL,
          puzzle_id INTEGER NOT NULL,
          served_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_user_served_phone_time ON user_served(phone_number, served_at);
      `);
    } else {
      // SQLite Schema
      await this.exec(`
        CREATE TABLE IF NOT EXISTS users (
          phone_number TEXT PRIMARY KEY,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          score INTEGER DEFAULT 0,
          streak INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS puzzles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word TEXT NOT NULL,
          category TEXT NOT NULL,
          clue TEXT NOT NULL,
          masked_pattern TEXT NOT NULL,
          missing_letters TEXT NOT NULL,
          distractors TEXT NOT NULL,
          year TEXT,
          team TEXT,
          difficulty INTEGER DEFAULT 2
        );

        CREATE TABLE IF NOT EXISTS user_answers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone_number TEXT NOT NULL,
          puzzle_id INTEGER NOT NULL,
          is_correct INTEGER DEFAULT 1,
          answered_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_user_answers_phone_time ON user_answers(phone_number, answered_at);

        CREATE TABLE IF NOT EXISTS user_served (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone_number TEXT NOT NULL,
          puzzle_id INTEGER NOT NULL,
          served_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_user_served_phone_time ON user_served(phone_number, served_at);
      `);
    }
  }


  // Additive, idempotent column migrations.
  async migrate() {
    const FOOTBALL = ['African Cup of Nations','Champions League Miracles','Clubs & Derbies','Europa League & UEFA Cup','European Championships','Football Legends Archive','Historic Stadiums','Legendary Players','Tactics & Football Lore','Tactics & Iconic Plays','Trophies & Awards','Underdogs & Fairytales','World Cup Epics','World Cup Legends'];
    const adds = [
      ['puzzles', 'domain', "TEXT DEFAULT 'football'"],
      ['puzzles', 'tuned', 'INTEGER DEFAULT 0'],
      ['users', 'wins', 'INTEGER DEFAULT 0'],
      ['users', 'session_started_at', 'TEXT'],
      ['users', 'session_points', 'INTEGER DEFAULT 0'],
      ['users', 'session_words', 'INTEGER DEFAULT 0']
    ];
    for (const [t, c, def] of adds) {
      if (this.type === 'postgres') await this.exec(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS ${c} ${def}`);
      else { try { await this.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); } catch (e) { if (!/duplicate column/i.test(e.message)) throw e; } }
    }
    await this.run(`UPDATE puzzles SET domain = 'entertainment' WHERE (domain IS NULL OR domain = 'football') AND category NOT IN (${FOOTBALL.map(() => '?').join(',')})`, FOOTBALL);
    const pk = this.type === 'postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    await this.exec(`CREATE TABLE IF NOT EXISTS play_history (
      id ${pk},
      phone_number TEXT NOT NULL,
      started_at TEXT,
      ended_at TEXT NOT NULL,
      outcome TEXT NOT NULL,
      streak INTEGER DEFAULT 0,
      points INTEGER DEFAULT 0,
      words INTEGER DEFAULT 0
    )`);
    await this.exec('CREATE INDEX IF NOT EXISTS idx_play_history_phone ON play_history(phone_number, ended_at)');
    await this.exec('CREATE INDEX IF NOT EXISTS idx_puzzles_domain_diff ON puzzles(domain, difficulty)');
  }

  async begin() { if (this.type !== 'postgres') await this.exec('BEGIN'); }
  async commit() { if (this.type !== 'postgres') await this.exec('COMMIT'); }
  async rollback() { if (this.type !== 'postgres') { try { await this.exec('ROLLBACK'); } catch (e) {} } }

  // Unified query method
  async query(sql, params = []) {
    if (this.type === 'postgres') {
      // Convert ? placeholders to $1, $2 for Postgres
      let paramIdx = 1;
      const pgSql = sql.replace(/\?/g, () => `$${paramIdx++}`);
      const res = await this.client.query(pgSql, params);
      return res.rows;
    } else {
      return new Promise((resolve, reject) => {
        this.client.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    }
  }

  async get(sql, params = []) {
    const rows = await this.query(sql, params);
    return rows[0] || null;
  }

  async run(sql, params = []) {
    if (this.type === 'postgres') {
      let paramIdx = 1;
      const pgSql = sql.replace(/\?/g, () => `$${paramIdx++}`);
      const res = await this.client.query(pgSql, params);
      return { rowCount: res.rowCount };
    } else {
      return new Promise((resolve, reject) => {
        this.client.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    }
  }

  async exec(sql) {
    if (this.type === 'postgres') {
      return await this.client.query(sql);
    } else {
      return new Promise((resolve, reject) => {
        this.client.exec(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  // SQL fragment: puzzle ids this player has been served or has answered within the last 30 days.
  recentIdsSql() {
    const cutoff = this.type === 'postgres' ? "NOW() - INTERVAL '30 days'" : "datetime('now', '-30 days')";
    return `
      SELECT puzzle_id FROM user_served WHERE phone_number = ? AND served_at > ${cutoff}
      UNION
      SELECT puzzle_id FROM user_answers WHERE phone_number = ? AND answered_at > ${cutoff}`;
  }

  // Next puzzle for a player at a target difficulty (1..4).
  //  - anything served OR answered in the last 30 days is excluded (covers the current session too),
  //  - words are excluded by text, so a word living in two categories can't come back either,
  //  - no fallback: when everything is on cooldown we return null.
  // Difficulty: try the target level, then the nearest levels (d-1, d+1, d-2, ...).
  // Mix: domain (football / entertainment) 50-50 among domains that have eligible words,
  // then a category uniformly, then a random word.
  async getNextPuzzleForPhone(phoneNumber, opts = {}) {
    if (typeof opts === 'string' || opts === null) opts = { category: opts };
    const { category = null } = opts;
    const target = Math.max(1, Math.min(4, parseInt(opts.difficulty, 10) || 2));
    const eligible = `
      FROM puzzles p
      WHERE p.word NOT IN (
        SELECT p2.word FROM puzzles p2 WHERE p2.id IN (${this.recentIdsSql()})
      )`;
    const base = [phoneNumber, phoneNumber];
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    const order = [target];
    for (let k = 1; k < 4; k++) { if (target - k >= 1) order.push(target - k); if (target + k <= 4) order.push(target + k); }

    let puzzle = null;
    for (const d of order) {
      const lvl = `${eligible} AND p.difficulty = ?`;
      let domain;
      if (category) domain = null;
      else {
        const doms = await this.query(`SELECT p.domain AS domain ${lvl} GROUP BY p.domain`, [...base, d]);
        if (!doms.length) continue;
        domain = pick(doms).domain;
      }
      let cat = category;
      if (!cat) {
        const cats = await this.query(`SELECT p.category AS category ${lvl} AND p.domain = ? GROUP BY p.category`, [...base, d, domain]);
        if (!cats.length) continue;
        cat = pick(cats).category;
      }
      puzzle = await this.get(`SELECT p.* ${lvl} AND p.category = ? ORDER BY RANDOM() LIMIT 1`, [...base, d, cat]);
      if (puzzle) break;
    }
    if (!puzzle) return null;

    await this.run('INSERT INTO user_served (phone_number, puzzle_id) VALUES (?, ?)', [phoneNumber, puzzle.id]);
    return puzzle;
  }

  // Distinct words played (served or answered) in the last 30 days.
  async countRecentWords(phoneNumber) {
    const row = await this.get(
      `SELECT COUNT(DISTINCT p.word) AS n FROM puzzles p WHERE p.id IN (${this.recentIdsSql()})`,
      [phoneNumber, phoneNumber]
    );
    return parseInt((row && (row.n ?? row.N)) || 0, 10);
  }
}

async function getDatabase() {
  if (!dbInstance) {
    dbInstance = new DatabaseAdapter();
    await dbInstance.init();
  }
  return dbInstance;
}

module.exports = { getDatabase, DB_TYPE };
