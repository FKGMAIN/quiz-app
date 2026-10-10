// Sign in (or create) a player by phone number and return their current run.
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const phone = normalizePhone(body?.phone_number)
  if (!phone) throw fail(400, 'Valid phone number is required (at least 7 digits).')

  const db = await useDb()
  const now = new Date()
  return db.tx(async (tx) => {
    await tx.run(
      `INSERT INTO users (phone_number, created_at, last_active_at, score, wins) VALUES (?, ?, ?, 0, 0)
       ON CONFLICT (phone_number) DO UPDATE SET last_active_at = excluded.last_active_at`,
      [phone, now.toISOString(), now.toISOString()]
    )
    const user = (await tx.get('SELECT * FROM users WHERE phone_number = ?', [phone]))!
    const { session, expired } = await ensureSession(tx, phone, now)
    const total = num((await tx.get('SELECT COUNT(*) AS n FROM puzzles'))?.n)
    const cutoff = new Date(now.getTime() - COOLDOWN_MS).toISOString()
    const recent = num((await tx.get('SELECT COUNT(DISTINCT word_key) AS n FROM plays WHERE phone_number = ? AND served_at > ?', [phone, cutoff]))?.n)
    return {
      success: true,
      phone_number: phone,
      score: num(user.score),
      wins: num(user.wins),
      session: sessionView(session),
      session_expired: expired,
      total_puzzles: total,
      answered_in_30_days: recent,
      remaining_available: Math.max(0, total - recent)
    }
  })
})
