// Game rules engine. The server owns everything that matters: which word is on screen, what the answer
// is, how long the player took, the streak counters and the points. The browser only sends letters.
//
// A session (expires 24h after it starts) is a series of streaks. A streak is `questions_per_streak`
// correct answers in a row; any miss, skip or timeout ends the session.
//   - Every player gets `entitled_streaks` streaks.
//   - After that they may bank their points, or play on up to `max_streaks`.
//   - Winning all `max_streaks` unlocks one more, compulsory streak that must be won:
//     failing it removes what a fully won compulsory streak is worth.
// All numbers come from the game_rules table (see rules.ts).

export const MAX_ATTEMPTS = 2                    // tries per word
export const SESSION_MS = 24 * 60 * 60 * 1000   // a session expires 24h after it starts
export const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000
export const RUN_LEN = 4                         // length of the old four-in-a-row run; only used to carry in-progress runs over

export function normalizePhone(p: unknown): string | null {
  if (typeof p !== 'string') return null
  const cleaned = p.trim().replace(/[^\d+]/g, '')
  return cleaned.length >= 7 && cleaned.length <= 20 ? cleaned : null
}

export function fail(statusCode: number, message: string, data?: Record<string, unknown>) {
  return createError({ statusCode, statusMessage: message, message, data })
}

export function maskPhone(p: string): string {
  return p.length > 8 ? `${p.slice(0, 4)} ••• ${p.slice(-3)}` : `${p.slice(0, 2)} •••`
}

const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const OUTCOME_FOR: Record<string, string> = { wrong: 'missed', skipped: 'skipped', timeout: 'timeout' }

/** What the client may know about a session. */
export function sessionView(s: Row, rules: Rules) {
  const streakNo = num(s.streak_no)
  const between = s.phase === 'between'
  const nextNo = streakNo + 1
  const nextIsCompulsory = isCompulsory(rules, nextNo)
  const compulsory = isCompulsory(rules, streakNo)
  return {
    id: s.id as string,
    status: s.status as string,
    phase: s.phase as 'playing' | 'between',
    streak_no: streakNo,
    in_streak: num(s.in_streak),
    streaks_won: num(s.streaks_won),
    questions_per_streak: rules.questions_per_streak,
    entitled_streaks: rules.entitled_streaks,
    max_streaks: rules.max_streaks,
    compulsory,                                              // the streak on screen must be won
    multiplier: streakMultiplier(rules, between ? nextNo : streakNo),
    correct: num(s.correct),
    points: num(s.points),
    words: num(s.words),
    expires_at: s.expires_at as string,
    // Shown while the player decides after the entitled streaks.
    decision: between ? { next_streak: nextNo, multiplier: streakMultiplier(rules, nextNo), banked_points: num(s.points) } : null,
    // Shown before and during the compulsory streak.
    penalty_if_failed: compulsory || (between && nextIsCompulsory) ? penaltyFor(rules, compulsory ? streakNo : nextNo, num(s.points)) : null
  }
}

function penaltyFor(rules: Rules, streakNo: number, sessionPoints: number): number {
  const full = streakValue(rules, streakNo)
  return rules.compulsory_penalty.floor_at_zero ? Math.min(full, Math.max(0, sessionPoints)) : full
}

async function addEvent(db: Db, rules: Rules, phone: string, sessionId: string, kind: string, points: number, streakNo: number, now: Date) {
  const lb = rules.leaderboard
  await db.run(
    'INSERT INTO point_events (phone_number, session_id, kind, points, streak_no, day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [phone, sessionId, kind, points, streakNo, dayKey(now, lb.timezone, lb.reset_hour), now.toISOString()]
  )
}

/** The player's active session, creating one if there is none and closing a stale one. Call inside a tx. */
export async function ensureSession(db: Db, phone: string, now = new Date()): Promise<{ session: Row; expired: boolean }> {
  let session = await db.get(`SELECT * FROM sessions WHERE phone_number = ? AND status = 'active'${db.forUpdate}`, [phone])
  let expired = false
  if (session && now.getTime() >= Date.parse(session.expires_at)) {
    expired = num(session.words) > 0
    await db.run("UPDATE sessions SET status = 'expired', outcome = 'expired', ended_at = ? WHERE id = ?", [session.expires_at, session.id])
    session = null
  }
  if (!session) {
    await db.run(
      "INSERT INTO sessions (id, phone_number, status, started_at, expires_at) VALUES (?, ?, 'active', ?, ?) ON CONFLICT DO NOTHING",
      [crypto.randomUUID(), phone, now.toISOString(), new Date(now.getTime() + SESSION_MS).toISOString()]
    )
    session = await db.get("SELECT * FROM sessions WHERE phone_number = ? AND status = 'active'", [phone])
  }
  return { session: session!, expired }
}

export function playView(play: Row, now = new Date()) {
  const answer: string = play.answer
  return {
    play_id: num(play.id),
    pattern: play.pattern as string,                  // e.g. "TIT_NIC STAR_"
    gaps: answer.length,
    tiles: JSON.parse(play.tiles) as string[],
    difficulty: num(play.difficulty),
    attempts_left: MAX_ATTEMPTS - num(play.attempts),
    hint: play.hint_gap == null ? null : { gap: num(play.hint_gap), letter: answer[num(play.hint_gap)] },
    elapsed_ms: Math.max(0, now.getTime() - Date.parse(play.served_at))
  }
}

/**
 * The word on screen: resumes the open play after a refresh, otherwise serves a new one.
 * `play` is null when the player is between streaks (choosing) or the bank is exhausted.
 */
export async function nextPlay(db: Db, phone: string, now = new Date()) {
  const rules = await getRules(db)
  const { session, expired } = await ensureSession(db, phone, now)
  if (session.phase === 'between') return { play: null, between: true, session, rules, expired, resumed: false }

  const open = await db.get('SELECT * FROM plays WHERE session_id = ? AND answered_at IS NULL ORDER BY id DESC LIMIT 1', [session.id])
  if (open) return { play: open, between: false, session, rules, expired, resumed: true }

  const streakNo = num(session.streak_no)
  const position = num(session.in_streak)
  const cutoff = new Date(now.getTime() - COOLDOWN_MS).toISOString()
  const target = difficultyFor(rules, streakNo, position)
  // Target level first, then the nearest levels outward.
  const order = [target]
  for (let k = 1; k < 4; k++) {
    if (target - k >= 1) order.push(target - k)
    if (target + k <= 4) order.push(target + k)
  }
  const eligible = `FROM puzzles p WHERE p.difficulty = ? AND p.domain = ?
    AND NOT EXISTS (SELECT 1 FROM plays x WHERE x.phone_number = ? AND x.word_key = p.word_key AND x.served_at > ?)`

  let puzzle: Row | null = null
  for (const d of order) {
    // Football and entertainment alternate at random; fall through to the other when one is used up.
    const domains = Math.random() < 0.5 ? ['football', 'entertainment'] : ['entertainment', 'football']
    for (const dom of domains) {
      const args = [d, dom, phone, cutoff]
      const cats = await db.query(`SELECT p.category AS category ${eligible} GROUP BY p.category`, args)
      if (!cats.length) continue
      puzzle = await db.get(`SELECT p.id, p.word, p.word_key, p.difficulty ${eligible} AND p.category = ? ORDER BY RANDOM() LIMIT 1`, [...args, pick(cats).category])
      if (puzzle) break
    }
    if (puzzle) break
  }
  if (!puzzle) return { play: null, between: false, session, rules, expired, resumed: false }

  const mask = createMask(puzzle.word, num(puzzle.difficulty), Math.floor(Math.random() * 2 ** 31))
  const play = await db.get(
    `INSERT INTO plays (session_id, phone_number, puzzle_id, word_key, difficulty, pattern, answer, tiles, served_at, streak_no, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [session.id, phone, puzzle.id, puzzle.word_key, puzzle.difficulty, mask.pattern, mask.answer.join(''), JSON.stringify(mask.tiles), now.toISOString(), streakNo, position]
  )
  return { play: play!, between: false, session, rules, expired, resumed: false }
}

/** Reveals one letter, once per word. The player picks the gap; the server supplies the letter. */
export async function giveHint(db: Db, phone: string, playId: number, gap: number) {
  const play = await db.get(`SELECT * FROM plays WHERE id = ? AND phone_number = ?${db.forUpdate}`, [playId, phone])
  if (!play) throw fail(404, 'Unknown word.')
  if (play.answered_at) throw fail(409, 'This word is already finished.')
  if (play.hint_gap != null) return { gap: num(play.hint_gap), letter: play.answer[num(play.hint_gap)] as string, already: true }
  if (!Number.isInteger(gap) || gap < 0 || gap >= play.answer.length) throw fail(400, 'Pick one of the empty gaps.')
  await db.run('UPDATE plays SET hint_gap = ? WHERE id = ?', [gap, playId])
  return { gap, letter: play.answer[gap] as string, already: false }
}

export type Action = 'submit' | 'skip' | 'timeout'

/** Where the session goes after a streak is completed. */
type Flow = 'next' | 'decision' | 'final' | 'finished'

/** Applies one answer, skip or timeout. Call inside a tx. */
export async function answerPlay(db: Db, phone: string, playId: number, action: Action, letters: unknown, now = new Date()) {
  const play = await db.get(`SELECT * FROM plays WHERE id = ? AND phone_number = ?${db.forUpdate}`, [playId, phone])
  if (!play) throw fail(404, 'Unknown word.')
  if (play.answered_at) throw fail(409, 'This word is already finished.')

  const rules = await getRules(db)
  const { session, expired } = await ensureSession(db, phone, now)
  if (play.session_id !== session.id) {
    // The session it belonged to expired while it was open.
    await db.run("UPDATE plays SET answered_at = ?, result = 'expired' WHERE id = ?", [now.toISOString(), play.id])
    throw fail(410, 'Your last session expired after 24 hours, so we started a fresh one.', { session_expired: true })
  }

  let result: 'correct' | 'wrong' | 'skipped' | 'timeout' = 'wrong'
  if (action === 'skip') result = 'skipped'
  else if (action === 'timeout') result = 'timeout'
  else {
    if (!Array.isArray(letters) || letters.length !== play.answer.length || letters.some(l => typeof l !== 'string')) {
      throw fail(400, 'Fill every gap before checking.')
    }
    if ((letters as string[]).join('').toUpperCase() === play.answer) result = 'correct'
    else {
      const attempts = num(play.attempts) + 1
      await db.run('UPDATE plays SET attempts = ? WHERE id = ?', [attempts, play.id])
      if (attempts < MAX_ATTEMPTS) {
        return { correct: false, finished: false, attempts_left: MAX_ATTEMPTS - attempts, session: sessionView(session, rules), session_expired: expired }
      }
    }
  }

  const seconds = Math.max(0, Math.round((now.getTime() - Date.parse(play.served_at)) / 1000))
  const streakNo = num(session.streak_no)
  const position = num(session.in_streak)
  const points = result === 'correct'
    ? scoreWord({ position, streakNo, difficulty: num(play.difficulty), seconds, hintUsed: play.hint_gap != null }, rules)
    : 0
  await db.run('UPDATE plays SET answered_at = ?, result = ?, points = ?, time_spent = ? WHERE id = ?', [now.toISOString(), result, points, seconds, play.id])

  // ---- advance the session ----
  const s = {
    streak_no: streakNo, in_streak: position, streaks_won: num(session.streaks_won), phase: 'playing' as 'playing' | 'between',
    correct: num(session.correct), points: num(session.points), words: num(session.words) + 1, penalty: num(session.penalty)
  }
  let status = 'active'
  let outcome: string | null = null
  let flow: Flow | null = null
  let penalty = 0
  let streakCompleted: number | null = null

  if (result === 'correct') {
    s.correct++
    s.points += points
    s.in_streak++
    await addEvent(db, rules, phone, session.id, 'word', points, streakNo, now)
    if (s.in_streak >= rules.questions_per_streak) {
      s.streaks_won++
      streakCompleted = streakNo
      await addEvent(db, rules, phone, session.id, 'streak_won', 0, streakNo, now)
      const wasCompulsory = isCompulsory(rules, streakNo)
      const wasLastNormal = streakNo >= rules.max_streaks
      if (wasCompulsory || (wasLastNormal && !rules.compulsory_streak)) {
        status = 'won'; outcome = 'won'; flow = 'finished'
      } else if (wasLastNormal) {
        s.streak_no++; s.in_streak = 0; flow = 'final'           // compulsory streak starts automatically
      } else if (streakNo >= rules.entitled_streaks) {
        s.phase = 'between'; flow = 'decision'                   // bank or play on
      } else {
        s.streak_no++; s.in_streak = 0; flow = 'next'
      }
    }
  } else {
    status = 'lost'
    outcome = OUTCOME_FOR[result]
    if (isCompulsory(rules, streakNo)) {
      penalty = penaltyFor(rules, streakNo, s.points)
      s.points = Math.max(0, s.points - penalty)
      s.penalty = penalty
      if (penalty) await addEvent(db, rules, phone, session.id, 'penalty', -penalty, streakNo, now)
    }
  }

  const ended = status !== 'active'
  await db.run(
    `UPDATE sessions SET streak_no = ?, in_streak = ?, streaks_won = ?, phase = ?, correct = ?, points = ?, words = ?, penalty = ?,
       status = ?, outcome = ?, ended_at = ? WHERE id = ?`,
    [s.streak_no, s.in_streak, s.streaks_won, s.phase, s.correct, s.points, s.words, s.penalty, status, outcome, ended ? now.toISOString() : null, session.id]
  )

  const user = await db.get(`SELECT score, wins FROM users WHERE phone_number = ?${db.forUpdate}`, [phone])
  const score = Math.max(0, num(user?.score) + points - penalty)
  const wins = num(user?.wins) + (outcome === 'won' ? 1 : 0)
  await db.run('UPDATE users SET score = ?, wins = ?, last_active_at = ? WHERE phone_number = ?', [score, wins, now.toISOString(), phone])

  const puzzle = await db.get('SELECT word FROM puzzles WHERE id = ?', [play.puzzle_id])
  const view = sessionView({ ...session, ...s, status, outcome }, rules)
  return {
    correct: result === 'correct',
    finished: true,
    word: puzzle?.word as string,                    // revealed now that the word is over
    points_awarded: points,
    penalty,
    time_spent: seconds,
    hint_used: play.hint_gap != null,
    score,
    wins,
    won: outcome === 'won',
    session_ended: ended,
    outcome,
    streak_completed: streakCompleted,
    flow,
    summary: ended ? sessionSummary({ ...session, ...s, status, outcome }) : null,
    session: view,
    session_expired: expired
  }
}

export const sessionSummary = (s: Row) => ({
  outcome: s.outcome as string,
  streaks: num(s.streaks_won),
  correct: num(s.correct),
  points: num(s.points),
  words: num(s.words),
  penalty: num(s.penalty)
})

/** Between streaks: keep going or bank the points. */
export async function chooseNext(db: Db, phone: string, choice: unknown, now = new Date()) {
  const rules = await getRules(db)
  const { session } = await ensureSession(db, phone, now)
  if (session.phase !== 'between') throw fail(409, 'There is no decision to make right now.')
  if (choice === 'stop') {
    await db.run("UPDATE sessions SET status = 'banked', outcome = 'banked', phase = 'playing', ended_at = ? WHERE id = ?", [now.toISOString(), session.id])
    const ended = { ...session, status: 'banked', outcome: 'banked', phase: 'playing' }
    return { ended: true, session: sessionView(ended, rules), summary: sessionSummary(ended) }
  }
  if (choice !== 'continue') throw fail(400, 'choice must be continue or stop.')
  const streakNo = num(session.streak_no) + 1
  await db.run("UPDATE sessions SET streak_no = ?, in_streak = 0, phase = 'playing' WHERE id = ?", [streakNo, session.id])
  return { ended: false, session: sessionView({ ...session, streak_no: streakNo, in_streak: 0, phase: 'playing' }, rules), summary: null }
}

export interface BoardEntry { phone_number: string; points: number; streaks: number; score: number; last_at: string }

/** Daily leaderboard for one board day. Points can be negative (penalties) but a total never ranks below 0. */
export async function leaderboard(db: Db, rules: Rules, day: string): Promise<BoardEntry[]> {
  const lb = rules.leaderboard
  const rows = await db.query(
    `SELECT phone_number, SUM(points) AS pts, SUM(CASE WHEN kind = 'streak_won' THEN 1 ELSE 0 END) AS streaks, MAX(created_at) AS last_at
     FROM point_events WHERE day = ? GROUP BY phone_number`,
    [day]
  )
  const entries: BoardEntry[] = rows.map(r => {
    const points = Math.max(0, num(r.pts))
    const streaks = num(r.streaks)
    return { phone_number: r.phone_number, points, streaks, score: points * (1 + (lb.streak_bonus_pct / 100) * streaks), last_at: r.last_at }
  }).filter(e => e.points >= lb.min_points)
  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    for (const t of lb.tie_breakers) {
      if (t === 'streaks_won' && b.streaks !== a.streaks) return b.streaks - a.streaks
      if (t === 'earliest_score' && a.last_at !== b.last_at) return a.last_at < b.last_at ? -1 : 1
    }
    return a.phone_number < b.phone_number ? -1 : 1
  })
  return entries
}

// ---------------------------------------------------------------------------------------------
// Shareable recap of a finished session. Shows how the session went (a grid of results per streak,
// points, rank) but never the words, so sharing it does not spoil anything.
// ---------------------------------------------------------------------------------------------

export interface RecapStreak { no: number; compulsory: boolean; multiplier: number; cells: Array<'ok' | 'hint' | 'miss'>; complete: boolean; points: number }

const OUTCOME_TEXT: Record<string, string> = {
  won: 'Won every streak', banked: 'Banked their points', missed: 'Missed a word', skipped: 'Skipped a word', timeout: "Ran out of time", expired: 'Session expired'
}
const SQUARE = { ok: '🟩', hint: '🟨', miss: '🟥' } as const

export async function sessionRecap(db: Db, rules: Rules, id: string) {
  const s = await db.get("SELECT * FROM sessions WHERE id = ? AND status <> 'active'", [id])
  if (!s) return null
  const plays = await db.query(
    `SELECT streak_no, position, result, hint_gap, points FROM plays
     WHERE session_id = ? AND answered_at IS NOT NULL AND result IN ('correct', 'wrong', 'skipped', 'timeout') ORDER BY id`,
    [id]
  )
  const byStreak = new Map<number, RecapStreak>()
  for (const p of plays) {
    const no = num(p.streak_no) || 1
    let st = byStreak.get(no)
    if (!st) {
      st = { no, compulsory: isCompulsory(rules, no), multiplier: streakMultiplier(rules, no), cells: [], complete: false, points: 0 }
      byStreak.set(no, st)
    }
    st.cells.push(p.result === 'correct' ? (p.hint_gap != null ? 'hint' : 'ok') : 'miss')
    st.points += num(p.points)
  }
  const streaks = [...byStreak.values()].sort((a, b) => a.no - b.no)
  for (const st of streaks) st.complete = st.cells.filter(c => c !== 'miss').length >= rules.questions_per_streak

  // Where the session's points landed on that day's leaderboard.
  const lb = rules.leaderboard
  const endedAt = new Date(s.ended_at || s.started_at)
  const day = dayKey(endedAt, lb.timezone, lb.reset_hour)
  const board = await leaderboard(db, rules, day)
  const idx = board.findIndex(e => e.phone_number === s.phone_number)

  const recap = {
    id: s.id as string,
    player: maskPhone(s.phone_number),
    status: s.status as string,
    outcome: (s.outcome || s.status) as string,
    outcome_text: OUTCOME_TEXT[s.outcome as string] || 'Session over',
    started_at: s.started_at as string,
    ended_at: (s.ended_at || s.started_at) as string,
    day,
    points: num(s.points),
    penalty: num(s.penalty),
    streaks_won: num(s.streaks_won),
    words: num(s.words),
    correct: num(s.correct),
    streaks,
    rank: idx >= 0 ? idx + 1 : null,
    players: board.length,
    share_text: ''
  }
  recap.share_text = recapText(recap, endedAt, lb.timezone)
  return recap
}

type Recap = Awaited<ReturnType<typeof sessionRecap>> & {}

/** Wordle-style text: a result grid per streak, no words. */
export function recapText(r: Pick<Recap, 'points' | 'streaks_won' | 'streaks' | 'rank' | 'players' | 'outcome' | 'penalty'>, at: Date, timeZone: string): string {
  const date = new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short' }).format(at)
  const lines = [`Pitch Legends · ${date}`, `${r.streaks_won} ${r.streaks_won === 1 ? 'streak' : 'streaks'} · ${r.points.toLocaleString('en-US')} pts`]
  for (const st of r.streaks) lines.push(`${st.compulsory ? 'Final ' : `${st.no}. `}${st.cells.map(c => SQUARE[c]).join('')}`)
  if (r.penalty) lines.push(`Final streak lost: -${r.penalty.toLocaleString('en-US')} pts`)
  if (r.rank) lines.push(`#${r.rank} of ${r.players} on today's board`)
  return lines.join('\n')
}
