migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('shift_types')

    if (!col.fields.getByName('start_time')) {
      col.fields.add(new TextField({ name: 'start_time' }))
    }
    if (!col.fields.getByName('end_time')) {
      col.fields.add(new TextField({ name: 'end_time' }))
    }

    // Dedup by name so unique index can be created cleanly
    app
      .db()
      .newQuery(
        `
      DELETE FROM shift_types WHERE id NOT IN (
        SELECT MIN(id) FROM shift_types GROUP BY name
      ) AND name IS NOT NULL
    `,
      )
      .execute()

    col.addIndex('idx_shift_types_name', true, 'name', '')

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('shift_types')
    col.fields.removeByName('start_time')
    col.fields.removeByName('end_time')
    col.removeIndex('idx_shift_types_name')
    app.save(col)
  },
)
