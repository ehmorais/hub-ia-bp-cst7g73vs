routerAdd(
  'POST',
  '/backend/v1/agent-chat/stream',
  (e) => {
    const body = e.requestInfo().body || {}
    const userId = e.auth?.id
    if (!userId) return e.unauthorizedError('auth required')
    if (!body.message?.trim()) return e.badRequestError('message is required')

    let slug = 'escala-expert'
    if (body.tool_id) {
      try {
        const tool = $app.findRecordById('ia_tools', body.tool_id)
        if (tool.getString('name') === 'Escala Expert HBPSCS') slug = 'escala-expert'
      } catch (_) {}
    }

    const conv = $ai.agent(slug).getOrCreateConversation({
      user_id: userId,
      id: body.conversation_id || null,
    })

    const iter = $ai.agent(slug).chat({
      user_id: userId,
      conversation_id: conv.id,
      message: body.message,
      stream: true,
    })

    e.response.header().set('Content-Type', 'text/event-stream')
    e.response.header().set('Cache-Control', 'no-cache')
    e.response.header().set('X-Conversation-Id', conv.id)

    $response.stream(e, iter)
  },
  $apis.requireAuth(),
)
