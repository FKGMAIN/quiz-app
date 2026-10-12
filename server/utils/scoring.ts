// Points for one solved word, computed on the server from server-measured time.
//   (base + speed bonus) x question multiplier x streak multiplier x difficulty x hint factor
// Later streaks pay more (streak_point_multipliers), so more streaks means more points.

export interface ScoreInput {
  /** Questions already solved in this streak (0-based position of this question). */
  position: number
  /** 1-based streak number. */
  streakNo: number
  /** Puzzle difficulty 1..4. */
  difficulty: number
  seconds: number
  hintUsed: boolean
}

export function scoreWord(i: ScoreInput, rules: Rules): number {
  const base = 250
  const speedBonus = Math.max(0, Math.round((45 - i.seconds) * 6))
  const questionMult = Math.min(3, 1 + i.position * rules.question_multiplier_step)
  const diffMult = 1 + ((i.difficulty || 2) - 1) * 0.25
  const hintFactor = i.hintUsed ? 0.6 : 1
  return Math.round((base + speedBonus) * questionMult * streakMultiplier(rules, i.streakNo) * hintFactor * diffMult)
}

/** What a fully won streak is worth at a steady pace. Used for the compulsory-streak penalty. */
export function streakValue(rules: Rules, streakNo: number): number {
  let total = 0
  for (let pos = 0; pos < rules.questions_per_streak; pos++) {
    total += scoreWord({ position: pos, streakNo, difficulty: difficultyFor(rules, streakNo, pos), seconds: rules.compulsory_penalty.nominal_seconds, hintUsed: false }, rules)
  }
  return total
}
