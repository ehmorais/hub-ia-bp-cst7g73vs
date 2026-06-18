migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('role')) {
      users.fields.add(
        new SelectField({
          name: 'role',
          values: ['Admin', 'Operador'],
          maxSelect: 1,
        }),
      )
      app.save(users)
    }

    try {
      const admin = app.findAuthRecordByEmail('_pb_users_auth_', 'eduardo.morais@idcorp.com.br')
      admin.set('role', 'Admin')
      app.save(admin)
    } catch (_) {}

    const deps = app.findCollectionByNameOrId('departments')
    deps.createRule = "@request.auth.role = 'Admin'"
    deps.updateRule = "@request.auth.role = 'Admin'"
    deps.deleteRule = "@request.auth.role = 'Admin'"
    app.save(deps)
  },
  (app) => {
    const deps = app.findCollectionByNameOrId('departments')
    deps.createRule = "@request.auth.id != ''"
    deps.updateRule = "@request.auth.id != ''"
    deps.deleteRule = "@request.auth.id != ''"
    app.save(deps)
  },
)
