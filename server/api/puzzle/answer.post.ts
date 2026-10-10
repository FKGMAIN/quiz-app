// Check a guess, skip, or report a timeout. The server decides correctness, time and points.
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const phone = normalizePhone(body?.phone_number)
  const playId = Number(body?.play_id)
  const action = body?.action
  if (!phone || !Number.isInteger(playId)) throw fail(400, 'phone_number and play_id are required.')
  if (action !== 'submit' && action !== 'skip' && action !== 'timeout') throw fail(400, 'action must be submit, skip or timeout.')

  const db = await useDb()
  const out = await db.tx((tx) => answerPlay(tx, phone, playId, action, body?.letters))
  return { success: true, ...out }
})
