// Points for one solved word. Same formula the Express version used, now computed on the server
// from server-measured time.

export interface ScoreInput {
  /** Words already solved in this run (0..3). */
  solvedBefore: number
  /** Puzzle difficulty 1..4. */
  difficulty: number
  seconds: number
  hintUsed: boolean
}

export function scoreWord({ solvedBefore, difficulty, seconds, hintUsed }: ScoreInput): number {
  const base = 250
  const speedBonus = Math.max(0, Math.round((45 - seconds) * 6))
  const streakMultiplier = Math.min(3, 1 + solvedBefore * 0.2)
  const diffMultiplier = 1 + ((difficulty || 2) - 1) * 0.25
  const hintFactor = hintUsed ? 0.6 : 1
  return Math.round((base + speedBonus) * streakMultiplier * hintFactor * diffMultiplier)
}
