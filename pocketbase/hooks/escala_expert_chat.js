routerAdd(
  'POST',
  '/backend/v1/escala-expert/chat',
  (e) => {
    const body = e.requestInfo().body || {}
    const userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('auth required')
    if (!body.message || !String(body.message).trim())
      return e.badRequestError('message is required')

    try {
      var conv = $ai.agent('escala-expert').getOrCreateConversation({
        user_id: userId,
        id: body.conversation_id ? String(body.conversation_id) : null,
      })
      var convId = conv.id

      var iter = $ai.agent('escala-expert').chat({
        user_id: userId,
        conversation_id: convId,
        message: String(body.message),
        stream: true,
      })

      e.response.header().set('Content-Type', 'text/event-stream')
      e.response.header().set('Cache-Control', 'no-cache')
      e.response.header().set('X-Conversation-Id', convId)

      $response.stream(e, iter)
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'IA temporariamente indisponível' })
      }
      if (err instanceof SkipAiAgentsError) {
        var status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'falha na requisição do agente' : err.message,
        })
      }
      if (err instanceof SkipAiError) {
        var s2 = err.status || 502
        return e.json(s2, { error: s2 >= 500 ? 'IA temporariamente indisponível' : err.message })
      }
      throw err
    }
  },
  $apis.requireAuth(),
)
