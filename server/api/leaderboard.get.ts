// Today's leaderboard. It is a sum over point_events for one board day, so it "resets" simply because
// a new day starts a new key. Timezone, reset hour, size and tie-breaking come from game_rules.
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const me = normalizePhone(q.phone_number)
  const db = await useDb()
  const rules = await getRules(db)
  const lb = rules.leaderboard
  const now = new Date()
  const today = dayKey(now, lb.timezone, lb.reset_hour)
  const day = typeof q.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.day) ? q.day : today

  const all = await leaderboard(db, rules, day)
  const toRow = (e: BoardEntry, i: number) => ({
    rank: i + 1,
    player: maskPhone(e.phone_number),
    points: e.points,
    streaks: e.streaks,
    you: !!me && e.phone_number === me
  })
  const idx = me ? all.findIndex((e) => e.phone_number === me) : -1
  return {
    day,
    is_today: day === today,
    timezone: lb.timezone,
    resets_at: day === today ? nextReset(now, lb.timezone, lb.reset_hour).toISOString() : null,
    entries: all.slice(0, lb.size).map(toRow),
    you: idx >= 0 ? toRow(all[idx], idx) : null,
    total_players: all.length
  }
})
