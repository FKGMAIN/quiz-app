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
      `);
    }
  }

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

  // Get next puzzle for phone number excluding answered in past 30 days
  async getNextPuzzleForPhone(phoneNumber, category = null) {
    let sql;
    let params;

    if (this.type === 'postgres') {
      let categoryFilter = category ? `AND category = $2` : '';
      sql = `
        SELECT * FROM puzzles
        WHERE id NOT IN (
          SELECT puzzle_id FROM user_answers
          WHERE phone_number = $1
          AND answered_at > NOW() - INTERVAL '30 days'
        )
        ${category ? `AND category = $2` : ''}
        ORDER BY RANDOM()
        LIMIT 1;
      `;
      params = category ? [phoneNumber, category] : [phoneNumber];
    } else {
      sql = `
        SELECT * FROM puzzles
        WHERE id NOT IN (
          SELECT puzzle_id FROM user_answers
          WHERE phone_number = ?
          AND answered_at > datetime('now', '-30 days')
        )
        ${category ? `AND category = ?` : ''}
        ORDER BY RANDOM()
        LIMIT 1;
      `;
      params = category ? [phoneNumber, category] : [phoneNumber];
    }

    let puzzle = await this.get(sql, params);

    // If all puzzles have been answered within 30 days, fallback to oldest answered
    if (!puzzle) {
      if (this.type === 'postgres') {
        sql = `
          SELECT p.*, MAX(ua.answered_at) as last_answered
          FROM puzzles p
          LEFT JOIN user_answers ua ON p.id = ua.puzzle_id AND ua.phone_number = $1
          ${category ? `WHERE p.category = $2` : ''}
          GROUP BY p.id
          ORDER BY last_answered ASC NULLS FIRST
          LIMIT 1;
        `;
        params = category ? [phoneNumber, category] : [phoneNumber];
      } else {
        sql = `
          SELECT p.*, MAX(ua.answered_at) as last_answered
          FROM puzzles p
          LEFT JOIN user_answers ua ON p.id = ua.puzzle_id AND ua.phone_number = ?
          ${category ? `WHERE p.category = ?` : ''}
          GROUP BY p.id
          ORDER BY last_answered ASC
          LIMIT 1;
        `;
        params = category ? [phoneNumber, category] : [phoneNumber];
      }
      puzzle = await this.get(sql, params);
      if (puzzle) {
        puzzle._recycledAfter30Days = true;
      }
    }

    return puzzle;
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
