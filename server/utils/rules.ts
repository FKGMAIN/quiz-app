// Game and leaderboard rules. They live in the `game_rules` table (one row per key, JSON value) so they
// can be tuned with plain SQL, no deploy needed. Missing or invalid values fall back to the defaults.
// Example:  UPDATE game_rules SET value = '[1,2,3,5]' WHERE key = 'streak_point_multipliers';
// Changes are picked up within RULES_TTL_MS.

export interface LeaderboardRules {
  /** IANA time zone the leaderboard day is cut in. */
  timezone: string
  /** Hour of day (0-23, local time) at which the board resets. 0 = midnight. */
  reset_hour: number
  /** Rows shown. */
  size: number
  /** Extra ranking weight per streak won that day: score = points * (1 + pct/100 * streaks). 0 = rank by points only. */
  streak_bonus_pct: number
  /** Players below this many points are not listed. */
  min_points: number
  /** Applied in order when scores are equal: 'streaks_won' (more first), 'earliest_score' (reached it first). */
  tie_breakers: string[]
}

export interface Rules {
  questions_per_streak: number
  /** Streaks every player gets in a normal session. */
  entitled_streaks: number
  /** Most streaks in a session before the compulsory one. */
  max_streaks: number
  /** Winning all max_streaks unlocks one more streak that must be won. */
  compulsory_streak: boolean
  /** Points multiplier by streak number (index 0 = streak 1). The compulsory streak uses the next entry. */
  streak_point_multipliers: number[]
  /** Added to the multiplier for each question already solved in the streak. */
  question_multiplier_step: number
  /** Difficulty (1-4) by question position in a streak. */
  difficulty_ramp: number[]
  /** Minimum difficulty by streak number, so later streaks are harder. */
  difficulty_floor_by_streak: number[]
  /** Failing the compulsory streak removes what a fully won one is worth. */
  compulsory_penalty: { nominal_seconds: number; floor_at_zero: boolean }
  leaderboard: LeaderboardRules
}

export const DEFAULT_RULES: Rules = {
  questions_per_streak: 5,
  entitled_streaks: 2,
  max_streaks: 3,
  compulsory_streak: true,
  streak_point_multipliers: [1, 1.5, 2, 3],
  question_multiplier_step: 0.2,
  difficulty_ramp: [1, 2, 3, 3, 4],
  difficulty_floor_by_streak: [1, 2, 3, 4],
  compulsory_penalty: { nominal_seconds: 20, floor_at_zero: true },
  leaderboard: {
    timezone: 'Africa/Lagos',
    reset_hour: 0,
    size: 50,
    streak_bonus_pct: 0,
    min_points: 1,
    tie_breakers: ['streaks_won', 'earliest_score']
  }
}

export const RULE_DESCRIPTIONS: Record<keyof Rules, string> = {
  questions_per_streak: 'Correct answers in a row that make one streak.',
  entitled_streaks: 'Streaks every player gets in a normal session (must be <= max_streaks).',
  max_streaks: 'Most streaks in a session before the compulsory streak.',
  compulsory_streak: 'true: winning all max_streaks unlocks one more streak that must be won.',
  streak_point_multipliers: 'Points multiplier by streak number (first entry = streak 1). The compulsory streak uses entry max_streaks + 1.',
  question_multiplier_step: 'Added to the multiplier for each question already solved in the streak.',
  difficulty_ramp: 'Difficulty 1-4 by question position within a streak.',
  difficulty_floor_by_streak: 'Minimum difficulty (1-4) by streak number.',
  compulsory_penalty: 'Penalty for failing the compulsory streak = value of a fully won one, assuming nominal_seconds per question. floor_at_zero keeps the session total >= 0.',
  leaderboard: 'Daily leaderboard: timezone, reset_hour, size, streak_bonus_pct, min_points, tie_breakers.'
}

// Preserve in the Nitro bundle so migrations running in server/utils can access descriptions without tree-shaking.
if (typeof globalThis !== 'undefined') {
  ;(globalThis as any).RULE_DESCRIPTIONS = RULE_DESCRIPTIONS
}

const RULES_TTL_MS = 15_000
let cache: { at: number; rules: Rules } | null = null

export function clearRulesCache() {
  cache = null
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const clampInt = (v: unknown, lo: number, hi: number, d: number) => (isNum(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d)
const numArray = (v: unknown, d: number[], lo: number, hi: number) =>
  Array.isArray(v) && v.length && v.every(isNum) ? v.map((n) => Math.max(lo, Math.min(hi, n))) : d

function validTimezone(tz: unknown): string {
  try {
    if (typeof tz === 'string') { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); return tz }
  } catch { /* fall through */ }
  return DEFAULT_RULES.leaderboard.timezone
}

/** Makes any parsed JSON safe to use: wrong types fall back, numbers are clamped. */
export function sanitizeRules(raw: Partial<Record<keyof Rules, any>>): Rules {
  const D = DEFAULT_RULES
  const max = clampInt(raw.max_streaks, 1, 10, D.max_streaks)
  const lb = raw.leaderboard && typeof raw.leaderboard === 'object' ? raw.leaderboard : {}
  const pen = raw.compulsory_penalty && typeof raw.compulsory_penalty === 'object' ? raw.compulsory_penalty : {}
  return {
    questions_per_streak: clampInt(raw.questions_per_streak, 1, 20, D.questions_per_streak),
    max_streaks: max,
    entitled_streaks: Math.min(max, clampInt(raw.entitled_streaks, 1, 10, D.entitled_streaks)),
    compulsory_streak: typeof raw.compulsory_streak === 'boolean' ? raw.compulsory_streak : D.compulsory_streak,
    streak_point_multipliers: numArray(raw.streak_point_multipliers, D.streak_point_multipliers, 0, 100),
    question_multiplier_step: isNum(raw.question_multiplier_step) ? Math.max(0, Math.min(5, raw.question_multiplier_step)) : D.question_multiplier_step,
    difficulty_ramp: numArray(raw.difficulty_ramp, D.difficulty_ramp, 1, 4).map(Math.round),
    difficulty_floor_by_streak: numArray(raw.difficulty_floor_by_streak, D.difficulty_floor_by_streak, 1, 4).map(Math.round),
    compulsory_penalty: {
      nominal_seconds: isNum(pen.nominal_seconds) ? Math.max(0, Math.min(600, pen.nominal_seconds)) : D.compulsory_penalty.nominal_seconds,
      floor_at_zero: typeof pen.floor_at_zero === 'boolean' ? pen.floor_at_zero : D.compulsory_penalty.floor_at_zero
    },
    leaderboard: {
      timezone: validTimezone(lb.timezone),
      reset_hour: clampInt(lb.reset_hour, 0, 23, D.leaderboard.reset_hour),
      size: clampInt(lb.size, 1, 500, D.leaderboard.size),
      streak_bonus_pct: isNum(lb.streak_bonus_pct) ? Math.max(0, Math.min(1000, lb.streak_bonus_pct)) : D.leaderboard.streak_bonus_pct,
      min_points: clampInt(lb.min_points, 0, 1_000_000, D.leaderboard.min_points),
      tie_breakers: Array.isArray(lb.tie_breakers) ? lb.tie_breakers.filter((t: unknown) => t === 'streaks_won' || t === 'earliest_score') : D.leaderboard.tie_breakers
    }
  }
}

export async function getRules(db: Db): Promise<Rules> {
  if (cache && Date.now() - cache.at < RULES_TTL_MS) return cache.rules
  const raw: Record<string, unknown> = {}
  for (const row of await db.query('SELECT key, value FROM game_rules')) {
    try { raw[row.key] = JSON.parse(row.value) } catch { console.warn(`[rules] ignoring invalid JSON for "${row.key}"`) }
  }
  const rules = sanitizeRules(raw as any)
  cache = { at: Date.now(), rules }
  return rules
}

/** Streak number of the compulsory streak, or null when switched off. */
export const compulsoryStreakNo = (r: Rules): number | null => (r.compulsory_streak ? r.max_streaks + 1 : null)
export const isCompulsory = (r: Rules, streakNo: number) => r.compulsory_streak && streakNo === r.max_streaks + 1

export function streakMultiplier(r: Rules, streakNo: number): number {
  const m = r.streak_point_multipliers
  return m[Math.max(0, Math.min(streakNo - 1, m.length - 1))]
}

/** Difficulty (1-4) of question `position` (0-based) in streak `streakNo`. */
export function difficultyFor(r: Rules, streakNo: number, position: number): number {
  const ramp = r.difficulty_ramp
  const floor = r.difficulty_floor_by_streak
  const base = ramp[Math.min(position, ramp.length - 1)]
  const min = floor[Math.max(0, Math.min(streakNo - 1, floor.length - 1))]
  return Math.max(1, Math.min(4, Math.max(base, min)))
}
