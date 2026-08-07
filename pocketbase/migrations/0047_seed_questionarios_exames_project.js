migrate(
  (app) => {
    let generalDept
    try {
      generalDept = app.findFirstRecordByData('departments', 'name', 'Projetos Gerais HBPSCS')
    } catch (_) {}

    if (!generalDept) {
      const col = app.findCollectionByNameOrId('departments')
      generalDept = new Record(col)
      generalDept.set('name', 'Projetos Gerais HBPSCS')
      generalDept.set('description', 'Acesso aos projetos e ferramentas gerais da instituição.')
      generalDept.set('sort_order', 0)
      generalDept.set('icon', 'FolderKanban')
      generalDept.set('color', '#047857')
      app.saveNoValidate(generalDept)
    }

    try {
      app.findFirstRecordByData('projects', 'name', 'Questionários de Exames')
    } catch (_) {
      const projCol = app.findCollectionByNameOrId('projects')
      const project = new Record(projCol)
      project.set('name', 'Questionários de Exames')
      project.set('description', 'Sistema de questionários de exames e históricos de pacientes.')
      project.set('department', generalDept.id)
      project.set('status', 'active')
      project.set('sort_order', 2)
      app.saveNoValidate(project)
    }
  },
  (app) => {
    try {
      const project = app.findFirstRecordByData('projects', 'name', 'Questionários de Exames')
      app.delete(project)
    } catch (_) {}
  },
)
