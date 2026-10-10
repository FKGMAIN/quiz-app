// Database access for SQLite (node:sqlite, no native build) and PostgreSQL.
// Nitro auto-imports every export from server/utils, so handlers just call `await useDb()`.
//
//  - Timestamps are stored as ISO-8601 strings in TEXT columns so both engines compare them the same way.
//  - Write SQL with `?` placeholders; they are rewritten to $1, $2 ... for PostgreSQL.
//  - Use `db.tx(async tx => { ... })` for anything that reads then writes. Do not call `tx` inside `tx`.

export type Row = Record<string, any>

export interface Db {
  type: 'sqlite' | 'postgres'
  /** ' FOR UPDATE' on PostgreSQL, '' on SQLite (which serialises writers already). */
  forUpdate: string
  query(sql: string, params?: any[]): Promise<Row[]>
  get(sql: string, params?: any[]): Promise<Row | null>
  run(sql: string, params?: any[]): Promise<{ changes: number }>
  exec(sql: string): Promise<void>
  tx<T>(fn: (tx: Db) => Promise<T>): Promise<T>
  close(): Promise<void>
}

const norm = (params: any[] = []) =>
  params.map(p => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p))

/** Rewrites `?` placeholders to `$n` for PostgreSQL. */
export function toPg(sql: string): string {
  let i = 0
  return sql.replace(/\?/g, () => `$${++i}`)
}

export const num = (v: any): number => Number(v ?? 0)

class SqliteDb implements Db {
  type = 'sqlite' as const
  forUpdate = ''
  private lock: Promise<unknown> = Promise.resolve()
  private h: any
  constructor(h: any) {
    this.h = h
  }

  async query(sql: string, params: any[] = []) {
    return this.h.prepare(sql).all(...norm(params)).map((r: Row) => ({ ...r }))
  }
  async get(sql: string, params: any[] = []) {
    const r = this.h.prepare(sql).get(...norm(params))
    return r ? { ...r } : null
  }
  async run(sql: string, params: any[] = []) {
    const r = this.h.prepare(sql).run(...norm(params))
    return { changes: Number(r.changes) }
  }
  async exec(sql: string) {
    this.h.exec(sql)
  }
  // One writer at a time. The callback only awaits already-resolved promises, so no other request can
  // run statements in the middle of the transaction.
  tx<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    const job = async () => {
      this.h.exec('BEGIN IMMEDIATE')
      try {
        const out = await fn(this)
        this.h.exec('COMMIT')
        return out
      } catch (e) {
        try { this.h.exec('ROLLBACK') } catch { /* already rolled back */ }
        throw e
      }
    }
    const p = this.lock.then(job, job)
    this.lock = p.catch(() => {})
    return p
  }
  async close() {
    this.h.close()
  }
}

class PgDb implements Db {
  type = 'postgres' as const
  forUpdate = ' FOR UPDATE'
  // `ex` is either the Pool or a single client checked out for a transaction.
  private ex: any
  private pool: any
  constructor(ex: any, pool: any) {
    this.ex = ex
    this.pool = pool
  }

  async query(sql: string, params: any[] = []) {
    return (await this.ex.query(toPg(sql), norm(params))).rows
  }
  async get(sql: string, params: any[] = []) {
    return (await this.query(sql, params))[0] ?? null
  }
  async run(sql: string, params: any[] = []) {
    const r = await this.ex.query(toPg(sql), norm(params))
    return { changes: r.rowCount ?? 0 }
  }
  async exec(sql: string) {
    await this.ex.query(sql)
  }
  async tx<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const out = await fn(new PgDb(client, this.pool))
      await client.query('COMMIT')
      return out
    } catch (e) {
      try { await client.query('ROLLBACK') } catch { /* connection already gone */ }
      throw e
    } finally {
      client.release()
    }
  }
  async close() {
    await this.pool.end()
  }
}

export async function openDb(): Promise<Db> {
  const type = (process.env.DB_TYPE || (process.env.DATABASE_URL ? 'postgres' : 'sqlite')).toLowerCase()
  if (type === 'postgres') {
    const { default: pg } = await import('pg')
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pitch_legends',
      // Set PGSSL=require for hosted databases that need TLS.
      ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' } : false
    })
    return new PgDb(pool, pool)
  }
  const { mkdirSync } = await import('node:fs')
  const { dirname, resolve } = await import('node:path')
  const sqliteModule = "node:sqlite" // variable specifier keeps the bundler from trying to resolve it
  const { DatabaseSync } = await import(/* @vite-ignore */ sqliteModule)
  const file = resolve(process.env.SQLITE_DB_PATH || './data/soccer_puzzle.db')
  mkdirSync(dirname(file), { recursive: true })
  const h = new DatabaseSync(file)
  h.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;')
  return new SqliteDb(h)
}

let instance: Promise<Db> | null = null

/** Shared connection. The first call also runs migrations and seeds the puzzle bank. */
export function useDb(): Promise<Db> {
  if (!instance) {
    instance = (async () => {
      const db = await openDb()
      await runMigrations(db)
      await seedFromAssets(db)
      console.log(`[db] ready (${db.type})`)
      return db
    })()
    instance.catch(() => { instance = null })
  }
  return instance
}
