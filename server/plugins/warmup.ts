// Open the database, run migrations and seed at startup instead of on the first request.
export default defineNitroPlugin(() => {
  useDb().catch((err) => console.error('[db] startup failed:', err))
})
