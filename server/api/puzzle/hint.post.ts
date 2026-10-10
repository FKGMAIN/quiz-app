// Reveal one letter for the current word (once per word).
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const phone = normalizePhone(body?.phone_number)
  const playId = Number(body?.play_id)
  if (!phone || !Number.isInteger(playId)) throw fail(400, 'phone_number and play_id are required.')

  const db = await useDb()
  const hint = await db.tx((tx) => giveHint(tx, phone, playId, Number(body?.gap)))
  return { success: true, ...hint }
})
