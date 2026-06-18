migrate(
  (app) => {
    let staffCol
    try {
      staffCol = app.findCollectionByNameOrId('hospital_staff')
    } catch (_) {
      staffCol = new Collection({
        name: 'hospital_staff',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'registry_id', type: 'text', required: true },
          {
            name: 'role',
            type: 'select',
            values: ['Supervisor', 'Nurse', 'Technician'],
            required: true,
            maxSelect: 1,
          },
          {
            name: 'department',
            type: 'relation',
            required: true,
            collectionId: app.findCollectionByNameOrId('departments').id,
            maxSelect: 1,
          },
          { name: 'contracted_hours', type: 'number', required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(staffCol)
    }

    if (!staffCol.fields.getByName('user_id')) {
      staffCol.fields.add(
        new RelationField({ name: 'user_id', collectionId: '_pb_users_auth_', maxSelect: 1 }),
      )
    }
    if (!staffCol.fields.getByName('contract_type')) {
      staffCol.fields.add(
        new SelectField({ name: 'contract_type', values: ['12x36', '5x2'], maxSelect: 1 }),
      )
    }
    app.save(staffCol)

    const shiftsCol = new Collection({
      name: 'shifts',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'staff_id',
          type: 'relation',
          required: true,
          collectionId: staffCol.id,
          maxSelect: 1,
        },
        { name: 'date', type: 'date', required: true },
        {
          name: 'shift_type',
          type: 'select',
          required: true,
          values: ['Day 1', 'Day 2', 'Night 1', 'Night 2', 'Off'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Draft', 'Published'],
          maxSelect: 1,
        },
        { name: 'is_overtime', type: 'bool' },
        {
          name: 'department_id',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('departments').id,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(shiftsCol)

    const offDayCol = new Collection({
      name: 'off_day_requests',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'staff_id',
          type: 'relation',
          required: true,
          collectionId: staffCol.id,
          maxSelect: 1,
        },
        { name: 'requested_date', type: 'date', required: true },
        { name: 'month_reference', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Pending', 'Approved', 'Rejected'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(offDayCol)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('off_day_requests'))
    } catch (e) {}
    try {
      app.delete(app.findCollectionByNameOrId('shifts'))
    } catch (e) {}
  },
)
