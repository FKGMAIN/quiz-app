// Public page behind the link a player shares: /s/<session id>.
export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') || '')
  const db = await useDb()
  const recap = /^[\w-]{8,64}$/.test(id) ? await sessionRecap(db, await getRules(db), id) : null
  if (!recap) throw createError({ statusCode: 404, statusMessage: 'Session not found', message: 'Session not found, or it has not finished yet.' })
  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=300')
  return renderSharePage(recap, getRequestURL(event).origin)
})
