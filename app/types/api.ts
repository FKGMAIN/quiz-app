// Shapes returned by the /api routes (see server/utils/game.ts).

export interface SessionView {
  id: string
  /** Words solved in the current run, 0..3. */
  correct: number
  points: number
  words: number
  /** 1..4, also the difficulty of the next word. */
  level: number
  expires_at: string
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

export interface HintResponse {
  success: boolean
  gap: number
  letter: string
  already: boolean
}

export interface RunSummary {
  outcome: string
  streak: number
  points: number
  words: number
}

export interface AnswerResponse {
  success: boolean
  correct: boolean
  finished: boolean
  attempts_left?: number
  word?: string
  points_awarded?: number
  time_spent?: number
  hint_used?: boolean
  score?: number
  wins?: number
  won?: boolean
  session_ended?: boolean
  outcome?: string | null
  summary?: RunSummary | null
  session: SessionView | null
  session_expired: boolean
}

export interface HistoryResponse {
  sessions: { started_at: string; ended_at: string; outcome: string; streak: number; points: number; words: number }[]
  totals: { sessions: number; wins: number; best_points: number; best_streak: number; words: number }
}
