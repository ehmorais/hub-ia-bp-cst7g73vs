migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const fieldsToRemove = ['staff_role', 'default_sector', 'assigned_rules', 'staff_profile']

    let changed = false
    for (const fieldName of fieldsToRemove) {
      if (users.fields.getByName(fieldName)) {
        users.fields.removeByName(fieldName)
        changed = true
      }
    }

    if (changed) {
      app.save(users)
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const staffRoles = app.findCollectionByNameOrId('staff_roles')
    const hospitalSectors = app.findCollectionByNameOrId('hospital_sectors')
    const shiftRules = app.findCollectionByNameOrId('shift_rules')
    const staffProfiles = app.findCollectionByNameOrId('staff_profiles')

    if (!users.fields.getByName('staff_role')) {
      users.fields.add(
        new RelationField({
          name: 'staff_role',
          collectionId: staffRoles.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }
    if (!users.fields.getByName('default_sector')) {
      users.fields.add(
        new RelationField({
          name: 'default_sector',
          collectionId: hospitalSectors.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }
    if (!users.fields.getByName('assigned_rules')) {
      users.fields.add(
        new RelationField({
          name: 'assigned_rules',
          collectionId: shiftRules.id,
          maxSelect: 100,
        }),
      )
    }
    if (!users.fields.getByName('staff_profile')) {
      users.fields.add(
        new RelationField({
          name: 'staff_profile',
          collectionId: staffProfiles.id,
          maxSelect: 1,
        }),
      )
    }
    app.save(users)
  },
)
