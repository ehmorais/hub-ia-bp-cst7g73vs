routerAdd(
  'POST',
  '/backend/v1/ai-chat/stream',
  (e) => {
    const body = e.requestInfo().body || {}
    const userId = e.auth?.id
    if (!userId) return e.unauthorizedError('auth required')
    if (!body.message?.trim()) return e.badRequestError('message is required')

    let systemPrompt = 'Você é um assistente de IA útil e conciso.'
    let modelAlias = 'fast'

    if (body.tool_id) {
      try {
        const tool = $app.findRecordById('ia_tools', body.tool_id)
        if (tool.getString('description')) {
          systemPrompt = tool.getString('description')
        }
        if (tool.getString('model_alias')) {
          modelAlias = tool.getString('model_alias')
        }
      } catch (_) {}
    }

    const messages = []

    messages.push({ role: 'system', content: systemPrompt })

    if (body.history && Array.isArray(body.history)) {
      messages.push(...body.history)
    } else {
      messages.push({ role: 'user', content: body.message })
    }

    const iter = $ai.chat({
      model: modelAlias,
      messages: messages,
      stream: true,
    })

    e.response.header().set('Content-Type', 'text/event-stream')
    e.response.header().set('Cache-Control', 'no-cache')

    $response.stream(e, iter)
  },
  $apis.requireAuth(),
)
