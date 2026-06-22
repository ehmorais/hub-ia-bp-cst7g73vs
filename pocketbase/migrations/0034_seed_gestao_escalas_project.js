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

    let project
    try {
      project = app.findFirstRecordByData('projects', 'name', 'Gestão de Escalas')
    } catch (_) {}

    if (project) {
      project.set('department', generalDept.id)
      app.saveNoValidate(project)
    } else {
      const projCol = app.findCollectionByNameOrId('projects')
      project = new Record(projCol)
      project.set('name', 'Gestão de Escalas')
      project.set('description', 'Gestão automatizada de escalas e plantões.')
      project.set('department', generalDept.id)
      project.set('status', 'active')
      project.set('sort_order', 1)
      app.saveNoValidate(project)
    }
  },
  (app) => {
    // Revert not provided as the upward creation modifies structured core state.
  },
)
