migrate(
  (app) => {
    const profiles = app.findCollectionByNameOrId('staff_profiles')
    const roles = app.findCollectionByNameOrId('staff_roles')

    if (!profiles.fields.getByName('staff_role')) {
      profiles.fields.add(
        new RelationField({
          name: 'staff_role',
          collectionId: roles.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    app.save(profiles)
  },
  (app) => {
    const profiles = app.findCollectionByNameOrId('staff_profiles')

    if (profiles.fields.getByName('staff_role')) {
      profiles.fields.removeByName('staff_role')
    }

    app.save(profiles)
  },
)
