migrate(
  (app) => {
    const shiftRules = new Collection({
      name: 'shift_rules',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'rule_type',
          type: 'select',
          required: true,
          values: [
            'min_staff',
            'max_consecutive',
            'professional_mix',
            'max_hours',
            'min_rest_hours',
            'other',
          ],
          maxSelect: 1,
        },
        { name: 'value', type: 'number', required: true },
        {
          name: 'department',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('departments').id,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(shiftRules)

    const shifts = new Collection({
      name: 'shifts',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        {
          name: 'sector',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('hospital_sectors').id,
          maxSelect: 1,
        },
        {
          name: 'cycle',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('shift_cycles').id,
          maxSelect: 1,
        },
        { name: 'start_time', type: 'date', required: true },
        { name: 'end_time', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(shifts)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('shifts'))
    app.delete(app.findCollectionByNameOrId('shift_rules'))
  },
)
