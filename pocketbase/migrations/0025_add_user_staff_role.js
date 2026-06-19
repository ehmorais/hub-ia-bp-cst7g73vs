migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const staffRoles = app.findCollectionByNameOrId('staff_roles')

    if (!users.fields.getByName('staff_role')) {
      users.fields.add(
        new RelationField({
          name: 'staff_role',
          collectionId: staffRoles.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
      app.save(users)
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (users.fields.getByName('staff_role')) {
      users.fields.removeByName('staff_role')
      app.save(users)
    }
  },
)
