migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('departments')

    const allDepts = app.findRecordsByFilter('departments', '1=1', '-created', 1000, 0)
    for (const dept of allDepts) {
      if (dept.getString('name') !== 'Projetos Gerais HBPSCS') {
        const current = dept.getInt('sort_order')
        dept.set('sort_order', current + 10)
        app.saveNoValidate(dept)
      }
    }

    let generalDept
    try {
      generalDept = app.findFirstRecordByData('departments', 'name', 'Projetos Gerais HBPSCS')
    } catch (_) {}

    if (generalDept) {
      generalDept.set('sort_order', 0)
      app.saveNoValidate(generalDept)
    } else {
      const record = new Record(collection)
      record.set('name', 'Projetos Gerais HBPSCS')
      record.set('description', 'Acesso aos projetos e ferramentas gerais da instituição.')
      record.set('sort_order', 0)
      record.set('icon', 'FolderKanban')
      record.set('color', '#047857')
      app.saveNoValidate(record)
    }
  },
  (app) => {
    // Revert updates
  },
)
