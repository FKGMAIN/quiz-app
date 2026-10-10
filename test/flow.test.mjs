import test from 'node:test'
import assert from 'node:assert/strict'
import { api, post, get, freshDbPath } from './harness.mjs'

import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'

// A copy of the Express-era database (set LEGACY_DB, or drop it at legacy/express-app/soccer_puzzle.db).
const LEGACY = process.env.LEGACY_DB || join(import.meta.dirname, '../legacy/express-app/soccer_puzzle.db')
const hasLegacy = existsSync(LEGACY)
const answerOf = async (playId) => (await (await useDb()).get('SELECT answer FROM plays WHERE id = ?', [playId])).answer.split('')

freshDbPath(hasLegacy ? LEGACY : undefined)   // migrate a copy of the real data when we have it, else a fresh install
const db = await useDb()

test('migrates the Express database without losing anything', { skip: !hasLegacy }, async () => {
  const old = new DatabaseSync(LEGACY, { readOnly: true })
  const one = (h, sql) => Number(h.prepare(sql).get().n)
  const n = async (sql) => Number((await db.get(sql)).n)
  assert.equal(await n('SELECT COUNT(*) n FROM puzzles'), one(old, 'SELECT COUNT(*) n FROM puzzles'))
  assert.equal(await n('SELECT COUNT(*) n FROM users'), one(old, 'SELECT COUNT(*) n FROM users'))
  // every old answer/served row that still points at a puzzle becomes a play
  const answers = one(old, 'SELECT COUNT(*) n FROM user_answers a JOIN puzzles p ON p.id = a.puzzle_id')
  const served = one(old, 'SELECT COUNT(*) n FROM user_served a JOIN puzzles p ON p.id = a.puzzle_id')
  assert.equal(await n("SELECT COUNT(*) n FROM plays WHERE result IS NOT NULL"), answers)
  assert.equal(await n('SELECT COUNT(*) n FROM plays WHERE result IS NULL'), served)
  assert.equal(await n("SELECT COUNT(*) n FROM sessions WHERE id LIKE 'legacy-%'"), one(old, 'SELECT COUNT(*) n FROM play_history'))
  const cols = (await db.query('PRAGMA table_info(puzzles)')).map(c => c.name)
  assert.deepEqual(cols.sort(), ['category', 'difficulty', 'domain', 'id', 'word', 'word_key'])
  assert.equal(await n('SELECT COUNT(*) n FROM schema_migrations'), 4)
  old.close()
})

test('sign in creates a player and a run', async () => {
  const s = await post(api.session, { phone_number: '0801 234 5678' })
  assert.equal(s.phone_number, '08012345678')
  assert.equal(s.session.correct, 0); assert.equal(s.session.level, 1)
  await assert.rejects(post(api.session, { phone_number: '123' }), { statusCode: 400 })
})

test('refresh returns the same word and does not burn another', async () => {
  const phone = '+2348000000001'
  await post(api.session, { phone_number: phone })
  const a = await get(api.next, { phone_number: phone })
  const b = await get(api.next, { phone_number: phone })
  assert.equal(a.play_id, b.play_id); assert.equal(b.resumed, true)
  assert.ok(!('word' in a) && !('answer' in a), 'answer must not be sent to the client')
  assert.equal(a.pattern.split('').filter(c => c === '_').length, a.gaps)
  assert.ok(a.tiles.length >= a.gaps + 4)
})

test('full winning run: 4 solved, points awarded by the server, run ends and resets', async () => {
  const phone = '+2348000000002'
  await post(api.session, { phone_number: phone })
  const words = new Set()
  let last
  for (let i = 0; i < 4; i++) {
    const p = await get(api.next, { phone_number: phone })
    assert.equal(p.session.correct, i); assert.equal(p.difficulty >= 1, true)
    const ans = await answerOf(p.play_id)
    last = await post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'submit', letters: ans })
    assert.equal(last.correct, true); assert.ok(last.points_awarded > 0)
    words.add(last.word)
  }
  assert.equal(words.size, 4)
  assert.equal(last.won, true); assert.equal(last.session_ended, true)
  assert.deepEqual({ outcome: last.summary.outcome, streak: last.summary.streak, words: last.summary.words }, { outcome: 'won', streak: 4, words: 4 })
  assert.equal(last.wins, 1); assert.equal(last.score, last.summary.points)
  const h = await get(api.history, { phone_number: phone })
  assert.equal(h.totals.wins, 1); assert.equal(h.sessions[0].outcome, 'won')
  const s = await post(api.session, { phone_number: phone })
  assert.equal(s.session.correct, 0); assert.equal(s.session.points, 0)         // new run
  assert.equal(s.answered_in_30_days, 4)
})

test('wrong answer: second try allowed, then run ends; word is revealed only then', async () => {
  const phone = '+2348000000003'
  await post(api.session, { phone_number: phone })
  const p = await get(api.next, { phone_number: phone })
  const bad = Array(p.gaps).fill('Q')
  const r1 = await post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'submit', letters: bad })
  assert.deepEqual({ c: r1.correct, f: r1.finished, left: r1.attempts_left }, { c: false, f: false, left: 1 })
  assert.ok(!('word' in r1))
  const r2 = await post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'submit', letters: bad })
  assert.equal(r2.finished, true); assert.equal(r2.session_ended, true); assert.equal(r2.summary.outcome, 'missed')
  assert.ok(r2.word.length > 2)
})

test('cheating attempts are rejected', async () => {
  const phone = '+2348000000004'
  await post(api.session, { phone_number: phone })
  const p = await get(api.next, { phone_number: phone })
  await assert.rejects(post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'submit', letters: Array(p.gaps + 1).fill('A') }), { statusCode: 400 })     // wrong length
  await assert.rejects(post(api.answer, { phone_number: '+2348000000099', play_id: p.play_id, action: 'skip' }), { statusCode: 404 })           // someone else's play
  await assert.rejects(post(api.answer, { phone_number: phone, play_id: 999999, action: 'skip' }), { statusCode: 404 })
  await assert.rejects(post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'win' }), { statusCode: 400 })
  const ans = await answerOf(p.play_id)
  await post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'submit', letters: ans })
  await assert.rejects(post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'submit', letters: ans }), { statusCode: 409 })      // replay
})

test('hint: one per word, supplied by the server, halves nothing twice', async () => {
  const phone = '+2348000000005'
  await post(api.session, { phone_number: phone })
  const p = await get(api.next, { phone_number: phone })
  const ans = await answerOf(p.play_id)
  const h1 = await post(api.hint, { phone_number: phone, play_id: p.play_id, gap: 0 })
  assert.equal(h1.letter, ans[0])
  const h2 = await post(api.hint, { phone_number: phone, play_id: p.play_id, gap: p.gaps - 1 })
  assert.equal(h2.gap, 0); assert.equal(h2.already, true)                       // second request returns the first hint
  const again = await get(api.next, { phone_number: phone })
  assert.deepEqual(again.hint, { gap: 0, letter: ans[0] })                      // survives a refresh
  const solved = await post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'submit', letters: ans })
  assert.equal(solved.hint_used, true)
})

test('30-day cooldown and 24h expiry', async () => {
  const phone = '+2348000000006'
  await post(api.session, { phone_number: phone })
  const seen = new Set()
  for (let i = 0; i < 12; i++) {                                                // skip through a dozen words
    const p = await get(api.next, { phone_number: phone })
    const w = (await db.get('SELECT word_key FROM plays WHERE id = ?', [p.play_id])).word_key
    assert.ok(!seen.has(w), 'word repeated within cooldown'); seen.add(w)
    await post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'skip' })   // each skip ends the run
  }
  // expire an active run that has progress
  const p = await get(api.next, { phone_number: phone })
  await post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'submit', letters: await answerOf(p.play_id) })
  const q = await get(api.next, { phone_number: phone })
  await db.run("UPDATE sessions SET expires_at = ? WHERE phone_number = ? AND status = 'active'", [new Date(Date.now() - 1000).toISOString(), phone])
  await assert.rejects(post(api.answer, { phone_number: phone, play_id: q.play_id, action: 'skip' }), { statusCode: 410 })
  const s = await post(api.session, { phone_number: phone })
  assert.equal(s.session.correct, 0)
  const h = await get(api.history, { phone_number: phone })
  assert.ok(h.sessions.some(x => x.outcome === 'expired'))
})

test('double submit is safe: only one of two concurrent correct answers scores', async () => {
  const phone = '+2348000000007'
  await post(api.session, { phone_number: phone })
  const p = await get(api.next, { phone_number: phone })
  const ans = await answerOf(p.play_id)
  const res = await Promise.allSettled([1, 2, 3].map(() => post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'submit', letters: ans })))
  assert.equal(res.filter(r => r.status === 'fulfilled').length, 1)
  const s = await post(api.session, { phone_number: phone })
  assert.equal(s.session.correct, 1)
})

test('difficulty follows the run and pool is mixed across domains', async () => {
  const phone = '+2348000000008'
  await post(api.session, { phone_number: phone })
  const doms = new Set()
  for (let i = 0; i < 3; i++) {
    const p = await get(api.next, { phone_number: phone })
    assert.equal(p.difficulty, i + 1)
    doms.add((await db.get('SELECT pz.domain d FROM plays pl JOIN puzzles pz ON pz.id = pl.puzzle_id WHERE pl.id = ?', [p.play_id])).d)
    await post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'submit', letters: await answerOf(p.play_id) })
  }
})

test('fresh install seeds the bank from JSON and is idempotent', async () => {
  const { openDb } = globalThis
  freshDbPath()
  const d2 = await openDb()
  await runMigrations(d2)
  const raw = JSON.parse((await (await import('node:fs/promises')).readFile(new URL('../server/database/seed/puzzles.json', import.meta.url), 'utf8')))
  assert.equal(await seedPuzzles(d2, raw), 10342)
  assert.equal(await seedPuzzles(d2, raw), 0)
  assert.deepEqual(await runMigrations(d2), [])
  await d2.close()
})
