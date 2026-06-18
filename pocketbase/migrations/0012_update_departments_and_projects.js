/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const depCol = app.findCollectionByNameOrId('departments')
    if (!depCol.fields.getByName('color')) {
      depCol.fields.add(new TextField({ name: 'color' }))
    }
    app.save(depCol)

    const projCol = app.findCollectionByNameOrId('projects')
    if (!projCol.fields.getByName('members')) {
      projCol.fields.add(
        new RelationField({ name: 'members', collectionId: '_pb_users_auth_', maxSelect: 999 }),
      )
    }
    app.save(projCol)

    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'eduardo.morais@idcorp.com.br')
    } catch (_) {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      const admin = new Record(usersCol)
      admin.setEmail('eduardo.morais@idcorp.com.br')
      admin.setPassword('Skip@Pass')
      admin.setVerified(true)
      admin.set('name', 'Eduardo Morais')
      admin.set('role', 'Admin')
      app.save(admin)
    }
  },
  (app) => {
    const depCol = app.findCollectionByNameOrId('departments')
    depCol.fields.removeByName('color')
    app.save(depCol)

    const projCol = app.findCollectionByNameOrId('projects')
    projCol.fields.removeByName('members')
    app.save(projCol)
  },
)
