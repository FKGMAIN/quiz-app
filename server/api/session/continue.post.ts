// After the entitled streaks the player either plays on or banks their points.
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const phone = normalizePhone(body?.phone_number)
  if (!phone) throw fail(400, 'phone_number is required.')
  const db = await useDb()
  const out = await db.tx((tx) => chooseNext(tx, phone, body?.choice))
  return { success: true, ...out }
})
