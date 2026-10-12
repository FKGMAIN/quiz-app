// Recap of a finished session, for the in-app share screen. The session id is an unguessable UUID.
export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') || '')
  if (!/^[\w-]{8,64}$/.test(id)) throw fail(404, 'Session not found.')
  const db = await useDb()
  const recap = await sessionRecap(db, await getRules(db), id)
  if (!recap) throw fail(404, 'Session not found, or it has not finished yet.')
  return recap
})
