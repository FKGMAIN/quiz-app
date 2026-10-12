// Shapes returned by the /api routes (see server/utils/game.ts).

export interface SessionView {
  id: string
  status: string
  /** 'between' = streak(s) done, the player is choosing to continue or bank. */
  phase: 'playing' | 'between'
  /** 1-based; the streak just completed while phase is 'between'. */
  streak_no: number
  /** Correct answers in the current streak, 0..questions_per_streak. */
  in_streak: number
  streaks_won: number
  questions_per_streak: number
  entitled_streaks: number
  max_streaks: number
  /** The streak on screen is the compulsory one: it must be won. */
  compulsory: boolean
  /** Points multiplier of the streak on screen (or of the next one while choosing). */
  multiplier: number
  correct: number
  points: number
  words: number
  expires_at: string
  decision: { next_streak: number; multiplier: number; banked_points: number } | null
  /** What failing the compulsory streak would cost right now. */
  penalty_if_failed: number | null
}

export interface SessionResponse {
  success: boolean
  phone_number: string
  score: number
  wins: number
  session: SessionView
  session_expired: boolean
  total_puzzles: number
  answered_in_30_days: number
  remaining_available: number
}

export interface PuzzleResponse {
  between: false
  play_id: number
  /** The word with gaps as "_", e.g. "TIT_NIC STAR_". */
  pattern: string
  gaps: number
  tiles: string[]
  difficulty: number
  attempts_left: number
  hint: { gap: number; letter: string } | null
  elapsed_ms: number
  resumed: boolean
  session: SessionView
  session_expired: boolean
}

/** Returned instead of a word when the player is choosing between streaks. */
export interface BetweenResponse {
  between: true
  session: SessionView
  session_expired: boolean
}

export interface HintResponse {
  success: boolean
  gap: number
  letter: string
  already: boolean
}

export interface SessionSummary {
  outcome: string
  streaks: number
  correct: number
  points: number
  words: number
  penalty: number
}

export type StreakFlow = 'next' | 'decision' | 'final' | 'finished'

export interface AnswerResponse {
  success: boolean
  correct: boolean
  finished: boolean
  attempts_left?: number
  word?: string
  points_awarded?: number
  penalty?: number
  time_spent?: number
  hint_used?: boolean
  score?: number
  wins?: number
  won?: boolean
  session_ended?: boolean
  outcome?: string | null
  /** Streak number just completed by this answer, if any. */
  streak_completed?: number | null
  flow?: StreakFlow | null
  summary?: SessionSummary | null
  session: SessionView
  session_expired: boolean
}

export interface ContinueResponse {
  success: boolean
  ended: boolean
  session: SessionView
  summary: SessionSummary | null
}

export interface HistoryResponse {
  sessions: { id: string; started_at: string; ended_at: string; outcome: string; streaks: number; points: number; words: number }[]
  totals: { sessions: number; wins: number; best_points: number; best_streaks: number; words: number }
}

export interface BoardRow {
  rank: number
  player: string
  points: number
  streaks: number
  you: boolean
}

export interface LeaderboardResponse {
  day: string
  is_today: boolean
  timezone: string
  /** When today's board resets (ISO); null for past days. */
  resets_at: string | null
  entries: BoardRow[]
  you: BoardRow | null
  total_players: number
}

export interface RecapStreak { no: number; compulsory: boolean; multiplier: number; cells: Array<'ok' | 'hint' | 'miss'>; complete: boolean; points: number }

/** A finished session, as shown on the share screen. Never contains the words. */
export interface RecapResponse {
  id: string
  player: string
  status: string
  outcome: string
  outcome_text: string
  started_at: string
  ended_at: string
  day: string
  points: number
  penalty: number
  streaks_won: number
  words: number
  correct: number
  streaks: RecapStreak[]
  rank: number | null
  players: number
  share_text: string
}
