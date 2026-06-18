migrate(
  (app) => {
    const deps = app.findCollectionByNameOrId('departments')
    const initialDeps = [
      { name: 'Human Resources', description: 'HR Department' },
      { name: 'Information Technology', description: 'IT Department' },
      { name: 'Operations', description: 'Operations Department' },
    ]

    for (const d of initialDeps) {
      try {
        app.findFirstRecordByData('departments', 'name', d.name)
      } catch (_) {
        const record = new Record(deps)
        record.set('name', d.name)
        record.set('description', d.description)
        app.save(record)
      }
    }
  },
  (app) => {
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM departments WHERE name IN ('Human Resources', 'Information Technology', 'Operations')",
        )
        .execute()
    } catch (_) {}
  },
)
