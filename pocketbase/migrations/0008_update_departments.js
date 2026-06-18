migrate(
  (app) => {
    const deps = app.findCollectionByNameOrId('departments')
    if (!deps.fields.getByName('sort_order')) {
      deps.fields.add(new NumberField({ name: 'sort_order' }))
      app.save(deps)
    }
  },
  (app) => {
    const deps = app.findCollectionByNameOrId('departments')
    if (deps.fields.getByName('sort_order')) {
      deps.fields.removeByName('sort_order')
      app.save(deps)
    }
  },
)
