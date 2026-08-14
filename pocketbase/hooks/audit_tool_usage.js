routerAdd(
  'POST',
  '/backend/v1/audit/tool-usage',
  (e) => {
    const body = e.requestInfo().body || {}
    const toolId = String(body.tool_id || '').trim()

    if (!toolId) return e.badRequestError('tool_id is required')

    let tool
    try {
      tool = $app.findRecordById('ia_tools', toolId)
    } catch (_) {
      return e.notFoundError('Tool not found')
    }

    if (tool.getString('status') !== 'active') {
      return e.forbiddenError('Tool is not active')
    }

    const auditCollection = $app.findCollectionByNameOrId('audit_logs')
    const audit = new Record(auditCollection)
    audit.set('user', e.auth.id)
    audit.set('action', tool.id)
    audit.set('department', 'IA Chat')
    audit.set('details', 'Uso da ferramenta ' + tool.getString('name'))
    $app.saveNoValidate(audit)

    return e.json(201, { success: true })
  },
  $apis.requireAuth(),
)
