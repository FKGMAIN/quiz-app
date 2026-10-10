// Docker health check: the app is up and the database answers.
export default defineEventHandler(async () => {
  const db = await useDb()
  await db.get('SELECT 1 AS ok')
  return { ok: true, db: db.type }
})
