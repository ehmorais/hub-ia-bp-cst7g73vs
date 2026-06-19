migrate(
  (app) => {
    const cycles = new Collection({
      name: 'shift_cycles',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'start_date', type: 'date', required: true },
        { name: 'end_date', type: 'date', required: true },
        { name: 'request_deadline', type: 'date', required: true },
        { name: 'status', type: 'select', values: ['active', 'closed', 'draft'], maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(cycles)

    const sectors = new Collection({
      name: 'hospital_sectors',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'department',
          type: 'relation',
          collectionId: app.findCollectionByNameOrId('departments').id,
          maxSelect: 1,
        },
        { name: 'min_staffing', type: 'number' },
        { name: 'ideal_staffing', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(sectors)

    const roles = new Collection({
      name: 'staff_roles',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'hierarchy_rank', type: 'number' },
        { name: 'requires_supervision', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(roles)

    const contracts = new Collection({
      name: 'staff_contracts',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'user', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        {
          name: 'contract_type',
          type: 'select',
          values: ['CLT 180h', 'PJ', 'Autônomo'],
          maxSelect: 1,
        },
        { name: 'monthly_hour_limit', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(contracts)

    const requests = new Collection({
      name: 'timeoff_requests',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'user', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'cycle', type: 'relation', collectionId: cycles.id, maxSelect: 1 },
        { name: 'date', type: 'date' },
        { name: 'priority_weight', type: 'number' },
        {
          name: 'status',
          type: 'select',
          values: ['pending', 'fulfilled', 'not_fulfilled'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(requests)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('timeoff_requests'))
    app.delete(app.findCollectionByNameOrId('staff_contracts'))
    app.delete(app.findCollectionByNameOrId('staff_roles'))
    app.delete(app.findCollectionByNameOrId('hospital_sectors'))
    app.delete(app.findCollectionByNameOrId('shift_cycles'))
  },
)
