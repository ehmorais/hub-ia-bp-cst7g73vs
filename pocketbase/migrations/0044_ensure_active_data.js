migrate(
  (app) => {
    let hasActiveCycle = false
    try {
      const cycles = app.findRecordsByFilter('shift_cycles', 'status = "active"', 'created', 1, 0)
      hasActiveCycle = cycles.length > 0
    } catch (_) {}

    if (!hasActiveCycle) {
      try {
        const col = app.findCollectionByNameOrId('shift_cycles')
        const r = new Record(col)
        r.set('name', 'Ciclo Ativo Padrão 2026')
        r.set('start_date', '2026-06-01 00:00:00.000Z')
        r.set('end_date', '2026-12-31 23:59:59.000Z')
        r.set('request_deadline', '2026-05-25 23:59:59.000Z')
        r.set('status', 'active')
        app.save(r)
      } catch (err) {
        console.log('Failed to seed active shift_cycle: ' + err.message)
      }
    }

    let hasActiveTool = false
    try {
      const tools = app.findRecordsByFilter('ia_tools', 'status = "active"', 'created', 1, 0)
      hasActiveTool = tools.length > 0
    } catch (_) {}

    if (!hasActiveTool) {
      try {
        const col = app.findCollectionByNameOrId('ia_tools')
        const r = new Record(col)
        r.set('name', 'Assistente Geral BP')
        r.set('description', 'Assistente de IA geral para consultas internas do hospital.')
        r.set('model_alias', 'fast')
        r.set('status', 'active')
        r.set('version', 'v1.0.0')
        app.save(r)
      } catch (err) {
        console.log('Failed to seed active ia_tool: ' + err.message)
      }
    }
  },
  (app) => {
    try {
      const cycle = app.findFirstRecordByData('shift_cycles', 'name', 'Ciclo Ativo Padrão 2026')
      app.delete(cycle)
    } catch (_) {}
    try {
      const tool = app.findFirstRecordByData('ia_tools', 'name', 'Assistente Geral BP')
      app.delete(tool)
    } catch (_) {}
  },
)
