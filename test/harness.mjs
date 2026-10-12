// Runs the real server code (utils + API handlers) under plain Node, with h3/Nitro globals stubbed.
// Usage: node --experimental-strip-types test/harness.mjs
import { readFileSync, copyFileSync, mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const utilsDir = join(root, 'server/utils')

// ---- stubs for Nitro/h3 auto-imports ----
globalThis.createError = (o) => Object.assign(new Error(o.message), o)
globalThis.defineEventHandler = (fn) => fn
globalThis.defineNitroPlugin = (fn) => fn
globalThis.readBody = async (e) => e.body
globalThis.getQuery = (e) => e.query || {}
globalThis.getRouterParam = (e, k) => e.params?.[k]
globalThis.setResponseHeader = () => {}
globalThis.getRequestURL = () => ({ origin: 'https://play.example' })
globalThis.useStorage = () => ({ getItem: async () => readFileSync(join(root, 'server/database/seed/puzzles.json'), 'utf8') })

// ---- auto-imported utils become globals, like Nitro does ----
for (const f of ['db', 'mask', 'time', 'rules', 'scoring', 'seed', 'migrate', 'game', 'shareHtml']) {
  Object.assign(globalThis, await import(pathToFileURL(join(utilsDir, `${f}.ts`)).href))
}

const handler = async (rel) => (await import(pathToFileURL(join(root, 'server/api', rel)).href)).default
export const api = {
  session: await handler('session.post.ts'),
  cont: await handler('session/continue.post.ts'),
  board: await handler('leaderboard.get.ts'),
  share: await handler('share/[id].get.ts'),
  sharePage: (await import(pathToFileURL(join(root, 'server/routes/s/[id].get.ts')).href)).default,
  next: await handler('puzzle/next.get.ts'),
  answer: await handler('puzzle/answer.post.ts'),
  hint: await handler('puzzle/hint.post.ts'),
  history: await handler('history.get.ts'),
  health: await handler('health.get.ts')
}
export const post = (fn, body) => fn({ body })
export const get = (fn, query, params) => fn({ query, params })

export function freshDbPath(from) {
  const dir = mkdtempSync(join(tmpdir(), 'pl-'))
  const file = join(dir, 'test.db')
  if (from && existsSync(from)) copyFileSync(from, file)
  process.env.SQLITE_DB_PATH = file
  return file
}
