// Finished runs for a phone number, newest first, with totals.
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const phone = normalizePhone(q.phone_number)
  if (!phone) throw fail(400, 'phone_number query parameter is required.')
  const limit = Math.min(100, Math.max(1, parseInt(String(q.limit), 10) || 20))

  const db = await useDb()
  const finished = "phone_number = ? AND status <> 'active' AND words > 0"
  const sessions = await db.query(
    `SELECT started_at, ended_at, outcome, correct AS streak, points, words FROM sessions WHERE ${finished} ORDER BY ended_at DESC LIMIT ${limit}`,
    [phone]
  )
  const t = await db.get(
    `SELECT COUNT(*) AS sessions, COALESCE(SUM(CASE WHEN outcome = 'won' THEN 1 ELSE 0 END), 0) AS wins,
            COALESCE(MAX(points), 0) AS best_points, COALESCE(MAX(correct), 0) AS best_streak, COALESCE(SUM(words), 0) AS words
     FROM sessions WHERE ${finished}`,
    [phone]
  )
  return {
    sessions: sessions.map((s) => ({ ...s, streak: num(s.streak), points: num(s.points), words: num(s.words) })),
    totals: {
      sessions: num(t?.sessions), wins: num(t?.wins), best_points: num(t?.best_points),
      best_streak: num(t?.best_streak), words: num(t?.words)
    }
  }
})
