migrate(
  (app) => {
    try {
      let activeCycles = []
      try {
        activeCycles = app.findRecordsByFilter('shift_cycles', 'status = "active"', '', 1, 0)
      } catch (_) {}

      if (activeCycles.length === 0) {
        const col = app.findCollectionByNameOrId('shift_cycles')
        var now = new Date()
        var end = new Date()
        end.setMonth(end.getMonth() + 1)
        var deadline = new Date()
        deadline.setDate(deadline.getDate() + 7)

        var record = new Record(col)
        record.set('name', 'Ciclo Ativo Padrão')
        record.set('start_date', now.toISOString().split('T')[0])
        record.set('end_date', end.toISOString().split('T')[0])
        record.set('request_deadline', deadline.toISOString().split('T')[0])
        record.set('status', 'active')
        app.save(record)
      }
    } catch (err) {
      console.log('ensure active shift cycle failed:', String(err))
    }

    try {
      let activeTools = []
      try {
        activeTools = app.findRecordsByFilter('ia_tools', 'status = "active"', '', 1, 0)
      } catch (_) {}

      if (activeTools.length === 0) {
        var col2 = app.findCollectionByNameOrId('ia_tools')
        var record2 = new Record(col2)
        record2.set('name', 'Assistente IA')
        record2.set('description', 'Assistente de Inteligência Artificial')
        record2.set('model_alias', 'fast')
        record2.set('status', 'active')
        app.save(record2)
      }
    } catch (err) {
      console.log('ensure active ia tool failed:', String(err))
    }
  },
  (app) => {},
)
