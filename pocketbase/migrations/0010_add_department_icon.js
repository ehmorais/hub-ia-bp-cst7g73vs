migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('departments')
    if (!col.fields.getByName('icon')) {
      col.fields.add(new TextField({ name: 'icon' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('departments')
    col.fields.removeByName('icon')
    app.save(col)
  },
)
