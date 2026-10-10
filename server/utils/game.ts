// Game rules. The server owns everything that matters: which word is on screen, what the answer is,
// how long the player took, the run counter and the points. The browser only sends letters.

export const RUN_LEN = 4                         // four correct in a row wins the run
export const MAX_ATTEMPTS = 2                    // tries per word
export const SESSION_MS = 24 * 60 * 60 * 1000    // a run expires 24h after it starts
export const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000

export function normalizePhone(p: unknown): string | null {
  if (typeof p !== 'string') return null
  const cleaned = p.trim().replace(/[^\d+]/g, '')
  return cleaned.length >= 7 && cleaned.length <= 20 ? cleaned : null
}

export function fail(statusCode: number, message: string, data?: Record<string, unknown>) {
  return createError({ statusCode, statusMessage: message, message, data })
}

const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const OUTCOME_FOR: Record<string, string> = { wrong: 'missed', skipped: 'skipped', timeout: 'timeout' }

export interface SessionRow {
  id: string
  phone_number: string
  status: string
  outcome: string | null
  started_at: string
  expires_at: string
  ended_at: string | null
  correct: number
  points: number
  words: number
}

export const sessionView = (s: Row) => ({
  id: s.id as string,
  correct: num(s.correct),                       // words solved in this run, 0..3 while active
  points: num(s.points),
  words: num(s.words),
  level: clamp(num(s.correct), 0, RUN_LEN - 1) + 1,
  expires_at: s.expires_at as string
})

/** The player's active run, creating one if there is none and closing a stale one. Call inside a tx. */
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

/** The word on screen: resumes the open play after a refresh, otherwise serves a new one. Null when the bank is exhausted. */
export async function nextPlay(db: Db, phone: string, now = new Date()) {
  const { session, expired } = await ensureSession(db, phone, now)
  const open = await db.get('SELECT * FROM plays WHERE session_id = ? AND answered_at IS NULL ORDER BY id DESC LIMIT 1', [session.id])
  if (open) return { play: open, session, expired, resumed: true }

  const cutoff = new Date(now.getTime() - COOLDOWN_MS).toISOString()
  const target = clamp(num(session.correct) + 1, 1, RUN_LEN)
  // Target level first, then the nearest levels outward.
  const order = [target]
  for (let k = 1; k < RUN_LEN; k++) {
    if (target - k >= 1) order.push(target - k)
    if (target + k <= RUN_LEN) order.push(target + k)
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
  if (!puzzle) return { play: null, session, expired, resumed: false }

  const mask = createMask(puzzle.word, num(puzzle.difficulty), Math.floor(Math.random() * 2 ** 31))
  const play = await db.get(
    `INSERT INTO plays (session_id, phone_number, puzzle_id, word_key, difficulty, pattern, answer, tiles, served_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [session.id, phone, puzzle.id, puzzle.word_key, puzzle.difficulty, mask.pattern, mask.answer.join(''), JSON.stringify(mask.tiles), now.toISOString()]
  )
  return { play: play!, session, expired, resumed: false }
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

/** Applies one answer, skip or timeout. Call inside a tx. */
export async function answerPlay(db: Db, phone: string, playId: number, action: Action, letters: unknown, now = new Date()) {
  const play = await db.get(`SELECT * FROM plays WHERE id = ? AND phone_number = ?${db.forUpdate}`, [playId, phone])
  if (!play) throw fail(404, 'Unknown word.')
  if (play.answered_at) throw fail(409, 'This word is already finished.')

  const { session, expired } = await ensureSession(db, phone, now)
  if (play.session_id !== session.id) {
    // The run it belonged to expired while it was open.
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
    const guess = (letters as string[]).join('').toUpperCase()
    if (guess === play.answer) result = 'correct'
    else {
      const attempts = num(play.attempts) + 1
      await db.run('UPDATE plays SET attempts = ? WHERE id = ?', [attempts, play.id])
      if (attempts < MAX_ATTEMPTS) {
        return { correct: false, finished: false, attempts_left: MAX_ATTEMPTS - attempts, session: sessionView(session), session_expired: expired }
      }
    }
  }

  const seconds = Math.max(0, Math.round((now.getTime() - Date.parse(play.served_at)) / 1000))
  const solvedBefore = num(session.correct)
  const points = result === 'correct'
    ? scoreWord({ solvedBefore, difficulty: num(play.difficulty), seconds, hintUsed: play.hint_gap != null })
    : 0
  await db.run('UPDATE plays SET answered_at = ?, result = ?, points = ?, time_spent = ? WHERE id = ?', [now.toISOString(), result, points, seconds, play.id])

  const words = num(session.words) + 1
  const sessionPoints = num(session.points) + points
  const correct = solvedBefore + (result === 'correct' ? 1 : 0)
  const won = result === 'correct' && correct >= RUN_LEN
  const ended = won || result !== 'correct'
  const outcome = won ? 'won' : ended ? OUTCOME_FOR[result] : null

  await db.run(
    'UPDATE sessions SET correct = ?, points = ?, words = ?, status = ?, outcome = ?, ended_at = ? WHERE id = ?',
    [correct, sessionPoints, words, ended ? (won ? 'won' : 'lost') : 'active', outcome, ended ? now.toISOString() : null, session.id]
  )
  const user = await db.get(`SELECT score, wins FROM users WHERE phone_number = ?${db.forUpdate}`, [phone])
  const score = num(user?.score) + points
  const wins = num(user?.wins) + (won ? 1 : 0)
  await db.run('UPDATE users SET score = ?, wins = ?, last_active_at = ? WHERE phone_number = ?', [score, wins, now.toISOString(), phone])

  const puzzle = await db.get('SELECT word FROM puzzles WHERE id = ?', [play.puzzle_id])
  return {
    correct: result === 'correct',
    finished: true,
    word: puzzle?.word as string,                    // revealed now that the word is over
    points_awarded: points,
    time_spent: seconds,
    hint_used: play.hint_gap != null,
    score,
    wins,
    won,
    session_ended: ended,
    outcome,
    // What the player sees when a run ends: the run's totals.
    summary: ended ? { outcome, streak: correct, points: sessionPoints, words } : null,
    session: ended ? null : sessionView({ ...session, correct, points: sessionPoints, words }),
    session_expired: expired
  }
}
