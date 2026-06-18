migrate(
  (app) => {
    // Ensure ia_tools are active
    try {
      const tools = app.findRecordsByFilter('ia_tools', '1=1', '', 100, 0)
      for (const tool of tools) {
        if (tool.getString('status') !== 'active') {
          tool.set('status', 'active')
          app.save(tool)
        }
      }
    } catch (_) {}

    // Ensure 'RH' department exists
    let rhDept
    try {
      rhDept = app.findFirstRecordByData('departments', 'name', 'RH')
    } catch (_) {
      const depsCol = app.findCollectionByNameOrId('departments')
      rhDept = new Record(depsCol)
      rhDept.set('name', 'RH')
      rhDept.set('sort_order', 1)
      app.save(rhDept)
    }

    // Create sample projects
    const projectsCol = app.findCollectionByNameOrId('projects')
    try {
      app.findFirstRecordByData('projects', 'name', 'Recrutamento AI')
    } catch (_) {
      const p1 = new Record(projectsCol)
      p1.set('name', 'Recrutamento AI')
      p1.set('department', rhDept.id)
      p1.set('sort_order', 1)
      p1.set('status', 'active')
      app.save(p1)
    }

    try {
      app.findFirstRecordByData('projects', 'name', 'Análise de Clima')
    } catch (_) {
      const p2 = new Record(projectsCol)
      p2.set('name', 'Análise de Clima')
      p2.set('department', rhDept.id)
      p2.set('sort_order', 2)
      p2.set('status', 'active')
      app.save(p2)
    }
  },
  (app) => {
    // Safe down
  },
)
