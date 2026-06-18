migrate(
  (app) => {
    const staff = new Collection({
      name: 'hospital_staff',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'Admin'",
      updateRule: "@request.auth.role = 'Admin'",
      deleteRule: "@request.auth.role = 'Admin'",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'registry_id', type: 'text', required: true },
        {
          name: 'role',
          type: 'select',
          required: true,
          values: ['Nurse', 'Technician', 'Supervisor'],
          maxSelect: 1,
        },
        {
          name: 'department',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('departments').id,
          maxSelect: 1,
        },
        { name: 'contracted_hours', type: 'number', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_hospital_staff_registry ON hospital_staff (registry_id)'],
    })
    app.save(staff)

    const scales = new Collection({
      name: 'hospital_scales',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.role = 'Admin'",
      fields: [
        {
          name: 'department',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('departments').id,
          maxSelect: 1,
        },
        { name: 'month_year', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: false,
          values: ['Draft', 'Approved', 'Published'],
          maxSelect: 1,
        },
        { name: 'scale_data', type: 'json', required: false },
        { name: 'justification', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(scales)

    const absences = new Collection({
      name: 'staff_absences',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'Admin'",
      updateRule: "@request.auth.role = 'Admin'",
      deleteRule: "@request.auth.role = 'Admin'",
      fields: [
        { name: 'staff', type: 'relation', required: true, collectionId: staff.id, maxSelect: 1 },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['Vacation', 'Leave', 'Sick', 'Swap'],
          maxSelect: 1,
        },
        { name: 'start_date', type: 'date', required: true },
        { name: 'end_date', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(absences)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('staff_absences'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('hospital_scales'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('hospital_staff'))
    } catch (_) {}
  },
)
