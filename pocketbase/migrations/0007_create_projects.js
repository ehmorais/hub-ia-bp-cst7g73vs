migrate(
  (app) => {
    const collection = new Collection({
      name: 'projects',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'Admin'",
      updateRule: "@request.auth.role = 'Admin'",
      deleteRule: "@request.auth.role = 'Admin'",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'text' },
        {
          name: 'department',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('departments').id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'sort_order', type: 'number' },
        { name: 'status', type: 'select', values: ['active', 'inactive'], maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('projects')
    app.delete(collection)
  },
)
