// The word on screen. Refreshing the page returns the same word (and the same clock), never a new one.
export default defineEventHandler(async (event) => {
  const phone = normalizePhone(getQuery(event).phone_number)
  if (!phone) throw fail(400, 'phone_number query parameter is required.')

  const db = await useDb()
  const now = new Date()
  const out = await db.tx((tx) => nextPlay(tx, phone, now))
  if (!out.play) {
    throw fail(404, "You've played every word we have. Each one comes back 30 days after you last played it.")
  }
  return { ...playView(out.play, now), resumed: out.resumed, session: sessionView(out.session), session_expired: out.expired }
})
