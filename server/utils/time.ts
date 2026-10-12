// Leaderboard days are cut in a configurable time zone (default Africa/Lagos), not the server's.

function offsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(at)
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return asUtc - Math.floor(at.getTime() / 1000) * 1000
}

/** 'YYYY-MM-DD' of the leaderboard day an instant belongs to. */
export function dayKey(at: Date, timeZone: string, resetHour = 0): string {
  const shifted = new Date(at.getTime() - resetHour * 3_600_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(shifted)
}

/** The instant the current leaderboard day ends. */
export function nextReset(now: Date, timeZone: string, resetHour = 0): Date {
  const [y, m, d] = dayKey(now, timeZone, resetHour).split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d + 1, resetHour)
  let t = guess - offsetMs(new Date(guess), timeZone)
  t = guess - offsetMs(new Date(t), timeZone)
  return new Date(t)
}
