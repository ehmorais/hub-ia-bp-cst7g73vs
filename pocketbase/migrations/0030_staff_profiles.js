migrate(
  (app) => {
    // 1. Create staff_profiles collection
    const staffProfiles = new Collection({
      name: 'staff_profiles',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'Admin'",
      updateRule: "@request.auth.role = 'Admin'",
      deleteRule: "@request.auth.role = 'Admin'",
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'rules',
          type: 'relation',
          collectionId: app.findCollectionByNameOrId('shift_rules').id,
          maxSelect: 100,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(staffProfiles)

    // 2. Add fields to users collection
    const users = app.findCollectionByNameOrId('users')

    if (!users.fields.getByName('assigned_rules')) {
      users.fields.add(
        new RelationField({
          name: 'assigned_rules',
          collectionId: app.findCollectionByNameOrId('shift_rules').id,
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

    // 3. Seed data
    const profiles = [
      { name: 'Enfermeiro Padrão' },
      { name: 'Médico Plantonista' },
      { name: 'Equipe Administrativa' },
    ]

    for (const p of profiles) {
      const record = new Record(staffProfiles)
      record.set('name', p.name)
      app.save(record)
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.fields.removeByName('assigned_rules')
    users.fields.removeByName('staff_profile')
    app.save(users)

    const staffProfiles = app.findCollectionByNameOrId('staff_profiles')
    app.delete(staffProfiles)
  },
)
