import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { api, post, get, freshDbPath } from './harness.mjs'

// A copy of the Express-era database (set LEGACY_DB, or drop it at legacy/express-app/soccer_puzzle.db).
const LEGACY = process.env.LEGACY_DB || join(import.meta.dirname, '../legacy/express-app/soccer_puzzle.db')
const hasLegacy = existsSync(LEGACY)

freshDbPath(hasLegacy ? LEGACY : undefined)   // migrate a copy of the real data when we have it, else a fresh install
const db = await useDb()

let n = 0
const newPhone = () => `+23480${String(++n).padStart(8, '0')}`
const answerOf = async (playId) => (await db.get('SELECT answer FROM plays WHERE id = ?', [playId])).answer.split('')
const start = async (phone) => post(api.session, { phone_number: phone })
/** Answer the word on screen correctly. */
const solve = async (phone) => {
  const p = await get(api.next, { phone_number: phone })
  return post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'submit', letters: await answerOf(p.play_id) })
}
/** Solve `k` words in a row; returns the last response. */
const solveN = async (phone, k) => { let r; for (let i = 0; i < k; i++) r = await solve(phone); return r }
const setRule = async (key, value) => { await db.run('UPDATE game_rules SET value = ? WHERE key = ?', [JSON.stringify(value), key]); clearRulesCache() }

test('migrates the Express database without losing anything', { skip: !hasLegacy }, async () => {
  const old = new DatabaseSync(LEGACY, { readOnly: true })
  const one = (h, sql) => Number(h.prepare(sql).get().n)
  const c = async (sql) => Number((await db.get(sql)).n)
  assert.equal(await c('SELECT COUNT(*) n FROM puzzles'), one(old, 'SELECT COUNT(*) n FROM puzzles'))
  assert.equal(await c('SELECT COUNT(*) n FROM users'), one(old, 'SELECT COUNT(*) n FROM users'))
  const answers = one(old, 'SELECT COUNT(*) n FROM user_answers a JOIN puzzles p ON p.id = a.puzzle_id')
  const served = one(old, 'SELECT COUNT(*) n FROM user_served a JOIN puzzles p ON p.id = a.puzzle_id')
  assert.equal(await c('SELECT COUNT(*) n FROM plays WHERE result IS NOT NULL AND session_id IS NULL'), answers)
  assert.equal(await c('SELECT COUNT(*) n FROM plays WHERE result IS NULL AND session_id IS NULL'), served)
  assert.equal(await c("SELECT COUNT(*) n FROM sessions WHERE id LIKE 'legacy-%'"), one(old, 'SELECT COUNT(*) n FROM play_history'))
  old.close()
})

test('migrations ran and the default rules are in the database', async () => {
  assert.equal(Number((await db.get('SELECT COUNT(*) n FROM schema_migrations')).n), 5)
  const keys = (await db.query('SELECT key FROM game_rules')).map(r => r.key).sort()
  assert.deepEqual(keys, Object.keys(DEFAULT_RULES).sort())
  const cols = (await db.query('PRAGMA table_info(puzzles)')).map(c => c.name)
  assert.deepEqual(cols.sort(), ['category', 'difficulty', 'domain', 'id', 'word', 'word_key'])
})

test('sign in: a session starts at streak 1 with the rules attached', async () => {
  const s = await post(api.session, { phone_number: '0801 234 5678' })
  assert.equal(s.phone_number, '08012345678')
  assert.deepEqual(
    { streak: s.session.streak_no, q: s.session.in_streak, per: s.session.questions_per_streak, ent: s.session.entitled_streaks, max: s.session.max_streaks },
    { streak: 1, q: 0, per: 5, ent: 2, max: 3 })
  await assert.rejects(post(api.session, { phone_number: '123' }), { statusCode: 400 })
})

test('refresh returns the same word and never sends the answer', async () => {
  const phone = newPhone(); await start(phone)
  const a = await get(api.next, { phone_number: phone })
  const b = await get(api.next, { phone_number: phone })
  assert.equal(a.play_id, b.play_id); assert.equal(b.resumed, true)
  assert.ok(!('word' in a) && !('answer' in a))
  assert.equal(a.pattern.split('').filter(c => c === '_').length, a.gaps)
})

test('a streak is 5 correct answers; the next streak starts on its own and is harder', async () => {
  const phone = newPhone(); await start(phone)
  let r
  for (let i = 1; i <= 4; i++) { r = await solve(phone); assert.equal(r.flow, null); assert.equal(r.session.in_streak, i) }
  r = await solve(phone)
  assert.equal(r.flow, 'next'); assert.equal(r.streak_completed, 1)
  assert.deepEqual({ streak: r.session.streak_no, q: r.session.in_streak, won: r.session.streaks_won }, { streak: 2, q: 0, won: 1 })
  const p = await get(api.next, { phone_number: phone })
  assert.ok(p.difficulty >= 2, 'streak 2 starts at difficulty 2 or more')
  await assert.rejects(post(api.cont, { phone_number: phone, choice: 'stop' }), { statusCode: 409 })   // cannot bank mid-entitlement
})

test('after the 2 entitled streaks the player decides: bank points, or play on', async () => {
  const phone = newPhone(); await start(phone)
  const r = await solveN(phone, 10)
  assert.equal(r.flow, 'decision'); assert.equal(r.session.phase, 'between')
  assert.equal(r.session.decision.next_streak, 3); assert.ok(r.session.decision.banked_points > 0)
  const refreshed = await get(api.next, { phone_number: phone })                    // survives a refresh
  assert.equal(refreshed.between, true)
  const b = await post(api.cont, { phone_number: phone, choice: 'stop' })
  assert.equal(b.ended, true); assert.equal(b.summary.outcome, 'banked'); assert.equal(b.summary.streaks, 2)
  assert.equal(b.summary.points, r.session.points)
  const st = await post(api.session, { phone_number: phone })
  assert.equal(st.session.streaks_won, 0); assert.equal(st.wins, 0)                 // a banked session is not a win
})

test('winning all 3 streaks unlocks a compulsory 4th; winning it completes the session', async () => {
  const phone = newPhone(); await start(phone)
  await solveN(phone, 10)
  const c = await post(api.cont, { phone_number: phone, choice: 'continue' })
  assert.equal(c.session.streak_no, 3)
  const r3 = await solveN(phone, 5)
  assert.equal(r3.flow, 'final')
  assert.deepEqual({ no: r3.session.streak_no, compulsory: r3.session.compulsory }, { no: 4, compulsory: true })
  assert.ok(r3.session.penalty_if_failed > 0)
  const r4 = await solveN(phone, 5)
  assert.equal(r4.flow, 'finished'); assert.equal(r4.won, true); assert.equal(r4.session_ended, true)
  assert.equal(r4.summary.streaks, 4); assert.equal(r4.wins, 1)
})

test('later streaks pay more', () => {
  const rules = DEFAULT_RULES
  const pts = (streakNo) => scoreWord({ position: 0, streakNo, difficulty: 2, seconds: 10, hintUsed: false }, rules)
  assert.ok(pts(1) < pts(2) && pts(2) < pts(3) && pts(3) < pts(4))
  assert.ok(streakValue(rules, 4) > streakValue(rules, 3))
})

test('a miss in a normal streak ends the session and keeps the points already earned', async () => {
  const phone = newPhone(); await start(phone)
  const before = await solveN(phone, 2)
  const p = await get(api.next, { phone_number: phone })
  const r = await post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'skip' })
  assert.equal(r.session_ended, true); assert.equal(r.summary.outcome, 'skipped')
  assert.equal(r.penalty, 0); assert.equal(r.summary.points, before.session.points)
})

test('failing the compulsory streak removes the points a won one is worth (never below 0)', async () => {
  const phone = newPhone(); await start(phone)
  await solveN(phone, 10)
  await post(api.cont, { phone_number: phone, choice: 'continue' })
  const r3 = await solveN(phone, 5)
  const banked = r3.session.points
  const value = streakValue(DEFAULT_RULES, 4)
  const warned = r3.session.penalty_if_failed
  assert.equal(warned, Math.min(value, banked))
  const one = await solve(phone)                                                     // one compulsory answer first
  const p = await get(api.next, { phone_number: phone })
  const r = await post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'timeout' })
  const expected = Math.min(value, banked + one.points_awarded)
  assert.equal(r.penalty, expected)
  assert.equal(r.summary.points, Math.max(0, banked + one.points_awarded - expected))
  assert.equal(r.summary.outcome, 'timeout'); assert.equal(r.wins, 0)
  const ev = await db.get("SELECT SUM(points) p FROM point_events WHERE phone_number = ? AND kind = 'penalty'", [phone])
  assert.equal(Number(ev.p), -expected)
})

test('daily leaderboard ranks by points, breaks ties by streaks, and is per day', async () => {
  const a = newPhone(), b = newPhone(), c = newPhone()
  for (const ph of [a, b, c]) await start(ph)
  await solveN(a, 10)                          // two streaks
  await solveN(b, 5)                           // one streak
  await solveN(c, 2)                           // partial streak
  const board = await get(api.board, { phone_number: b })
  const order = board.entries.map(e => e.player)
  const rank = (ph) => board.entries.findIndex(e => e.player === maskPhone(ph))
  assert.ok(rank(a) < rank(b) && rank(b) < rank(c), `unexpected order ${order}`)
  assert.equal(board.you.player, maskPhone(b)); assert.ok(board.you.you)
  assert.ok(!JSON.stringify(board).includes(b), 'full phone numbers are never exposed')
  assert.ok(board.resets_at && new Date(board.resets_at) > new Date())

  // an event from another day does not count today
  const lb = DEFAULT_RULES.leaderboard
  const yesterday = dayKey(new Date(Date.now() - 86_400_000), lb.timezone, lb.reset_hour)
  const ghost = newPhone()
  await db.run("INSERT INTO point_events (phone_number, kind, points, day, created_at) VALUES (?, 'word', 999999, ?, ?)", [ghost, yesterday, new Date().toISOString()])
  const today = await get(api.board, {})
  assert.ok(!today.entries.some(e => e.player === maskPhone(ghost)))
  const past = await get(api.board, { day: yesterday })
  assert.equal(past.entries[0].player, maskPhone(ghost)); assert.equal(past.resets_at, null)

  // tie on points: more streaks first
  const t1 = newPhone(), t2 = newPhone()
  const now = new Date().toISOString(), day = dayKey(new Date(), lb.timezone, lb.reset_hour)
  await db.run("INSERT INTO point_events (phone_number, kind, points, day, created_at) VALUES (?, 'word', 500000, ?, ?)", [t1, day, now])
  await db.run("INSERT INTO point_events (phone_number, kind, points, day, created_at) VALUES (?, 'word', 500000, ?, ?)", [t2, day, now])
  await db.run("INSERT INTO point_events (phone_number, kind, points, day, created_at) VALUES (?, 'streak_won', 0, ?, ?)", [t2, day, now])
  const tie = await get(api.board, {})
  assert.ok(tie.entries.findIndex(e => e.player === maskPhone(t2)) < tie.entries.findIndex(e => e.player === maskPhone(t1)))
})

test('day boundaries follow the configured time zone', () => {
  assert.equal(dayKey(new Date('2026-10-10T22:59:00Z'), 'Africa/Lagos', 0), '2026-10-10')   // 23:59 Lagos
  assert.equal(dayKey(new Date('2026-10-10T23:00:00Z'), 'Africa/Lagos', 0), '2026-10-11')   // 00:00 Lagos
  assert.equal(nextReset(new Date('2026-10-10T20:00:00Z'), 'Africa/Lagos', 0).toISOString(), '2026-10-10T23:00:00.000Z')
  assert.equal(dayKey(new Date('2026-10-10T23:00:00Z'), 'UTC', 0), '2026-10-10')
  assert.equal(nextReset(new Date('2026-10-10T20:00:00Z'), 'UTC', 6).toISOString(), '2026-10-11T06:00:00.000Z')
})

test('rules are read from the database and bad values fall back safely', async () => {
  await setRule('questions_per_streak', 2)
  await setRule('leaderboard', { ...DEFAULT_RULES.leaderboard, size: 1, streak_bonus_pct: 50 })
  const phone = newPhone(); await start(phone)
  const r = await solveN(phone, 2)
  assert.equal(r.streak_completed, 1)                                                // 2-question streaks now
  const board = await get(api.board, {})
  assert.equal(board.entries.length, 1)
  await db.run("UPDATE game_rules SET value = 'not json' WHERE key = 'max_streaks'"); clearRulesCache()
  assert.equal((await getRules(db)).max_streaks, DEFAULT_RULES.max_streaks)
  await db.run("UPDATE game_rules SET value = '99999' WHERE key = 'max_streaks'"); clearRulesCache()
  assert.equal((await getRules(db)).max_streaks, 10)                                 // clamped
  await setRule('max_streaks', DEFAULT_RULES.max_streaks)
  await setRule('questions_per_streak', DEFAULT_RULES.questions_per_streak)
  await setRule('leaderboard', DEFAULT_RULES.leaderboard)
})

test('wrong answer: second try allowed, then the session ends; the word is revealed only then', async () => {
  const phone = newPhone(); await start(phone)
  const p = await get(api.next, { phone_number: phone })
  const bad = Array(p.gaps).fill('Q')
  const r1 = await post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'submit', letters: bad })
  assert.deepEqual({ c: r1.correct, f: r1.finished, left: r1.attempts_left }, { c: false, f: false, left: 1 })
  assert.ok(!('word' in r1))
  const r2 = await post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'submit', letters: bad })
  assert.equal(r2.finished, true); assert.equal(r2.summary.outcome, 'missed'); assert.ok(r2.word.length > 2)
})

test('cheating attempts are rejected', async () => {
  const phone = newPhone(); await start(phone)
  const p = await get(api.next, { phone_number: phone })
  await assert.rejects(post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'submit', letters: Array(p.gaps + 1).fill('A') }), { statusCode: 400 })
  await assert.rejects(post(api.answer, { phone_number: '+2348000000099', play_id: p.play_id, action: 'skip' }), { statusCode: 404 })
  await assert.rejects(post(api.answer, { phone_number: phone, play_id: 999999, action: 'skip' }), { statusCode: 404 })
  await assert.rejects(post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'win' }), { statusCode: 400 })
  await assert.rejects(post(api.cont, { phone_number: phone, choice: 'continue' }), { statusCode: 409 })
  const ans = await answerOf(p.play_id)
  await post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'submit', letters: ans })
  await assert.rejects(post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'submit', letters: ans }), { statusCode: 409 })
})

test('hint: one per word, supplied by the server, survives a refresh', async () => {
  const phone = newPhone(); await start(phone)
  const p = await get(api.next, { phone_number: phone })
  const ans = await answerOf(p.play_id)
  const h1 = await post(api.hint, { phone_number: phone, play_id: p.play_id, gap: 0 })
  assert.equal(h1.letter, ans[0])
  const h2 = await post(api.hint, { phone_number: phone, play_id: p.play_id, gap: p.gaps - 1 })
  assert.equal(h2.gap, 0); assert.equal(h2.already, true)
  assert.deepEqual((await get(api.next, { phone_number: phone })).hint, { gap: 0, letter: ans[0] })
  assert.equal((await post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'submit', letters: ans })).hint_used, true)
})

test('30-day cooldown and 24h expiry', async () => {
  const phone = newPhone(); await start(phone)
  const seen = new Set()
  for (let i = 0; i < 12; i++) {
    const p = await get(api.next, { phone_number: phone })
    const w = (await db.get('SELECT word_key FROM plays WHERE id = ?', [p.play_id])).word_key
    assert.ok(!seen.has(w), 'word repeated within cooldown'); seen.add(w)
    await post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'skip' })
  }
  await solve(phone)
  const q = await get(api.next, { phone_number: phone })
  await db.run("UPDATE sessions SET expires_at = ? WHERE phone_number = ? AND status = 'active'", [new Date(Date.now() - 1000).toISOString(), phone])
  await assert.rejects(post(api.answer, { phone_number: phone, play_id: q.play_id, action: 'skip' }), { statusCode: 410 })
  assert.equal((await post(api.session, { phone_number: phone })).session.streak_no, 1)
  assert.ok((await get(api.history, { phone_number: phone })).sessions.some(x => x.outcome === 'expired'))
})

test('double submit is safe: only one of several concurrent correct answers scores', async () => {
  const phone = newPhone(); await start(phone)
  const p = await get(api.next, { phone_number: phone })
  const ans = await answerOf(p.play_id)
  const res = await Promise.allSettled([1, 2, 3].map(() => post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'submit', letters: ans })))
  assert.equal(res.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal((await post(api.session, { phone_number: phone })).session.in_streak, 1)
})

test('history shows streaks per session', async () => {
  const phone = newPhone(); await start(phone)
  await solveN(phone, 10)
  await post(api.cont, { phone_number: phone, choice: 'stop' })
  const h = await get(api.history, { phone_number: phone })
  assert.deepEqual({ o: h.sessions[0].outcome, s: h.sessions[0].streaks }, { o: 'banked', s: 2 })
  assert.equal(h.totals.best_streaks, 2)
})

test('fresh install seeds the bank from JSON and is idempotent', async () => {
  freshDbPath()
  const d2 = await openDb()
  await runMigrations(d2)
  const raw = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../server/database/seed/puzzles.json', import.meta.url), 'utf8'))
  assert.equal(await seedPuzzles(d2, raw), 10342)
  assert.equal(await seedPuzzles(d2, raw), 0)
  assert.deepEqual(await runMigrations(d2), [])
  await d2.close()
})

test('share recap: only finished sessions, grid without words, public page escapes and hides the answer', async () => {
  const phone = newPhone(); const s = await start(phone)
  const id = s.session.id
  await assert.rejects(() => get(api.share, {}, { id }), /not found/i)          // still active
  await solveN(phone, 7)
  const p = await get(api.next, { phone_number: phone })
  const word = (await answerOf(p.play_id)).join('')
  await post(api.answer, { phone_number: phone, play_id: p.play_id, action: 'skip' })
  const r = await get(api.share, {}, { id })
  assert.equal(r.streaks.length, 2)
  assert.equal(r.streaks[0].cells.join(), 'ok,ok,ok,ok,ok')
  assert.equal(r.streaks[1].cells.join(), 'ok,ok,miss')
  assert.equal(r.streaks_won, 1)
  assert.ok(r.points > 0 && r.rank >= 1)
  assert.match(r.player, /•••/)                                                // phone is masked
  assert.ok(!r.share_text.includes(word) && !JSON.stringify(r).includes(phone))
  assert.match(r.share_text, /🟩🟩🟩🟩🟩/)
  const html = await api.sharePage({ params: { id }, headers: {} })
  assert.match(html, /Pitch Legends/); assert.ok(!html.includes(phone))
  await assert.rejects(() => api.sharePage({ params: { id: 'nope' } }), /not found/i)
})
