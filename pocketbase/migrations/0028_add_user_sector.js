migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!users.fields.getByName('default_sector')) {
      users.fields.add(
        new RelationField({
          name: 'default_sector',
          collectionId: app.findCollectionByNameOrId('hospital_sectors').id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
      app.save(users)
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (users.fields.getByName('default_sector')) {
      users.fields.removeByName('default_sector')
      app.save(users)
    }
  },
)
