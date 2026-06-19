migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('timeoff_requests')
    if (!col.fields.getByName('end_date')) {
      col.fields.add(
        new DateField({
          name: 'end_date',
          required: false,
        }),
      )
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('timeoff_requests')
    col.fields.removeByName('end_date')
    app.save(col)
  },
)
