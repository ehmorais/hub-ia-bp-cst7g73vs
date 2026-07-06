migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('staff_profiles')

    if (!col.fields.getByName('professional_id')) {
      col.fields.add(
        new TextField({
          name: 'professional_id',
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('staff_profiles')
    col.fields.removeByName('professional_id')
    app.save(col)
  },
)
