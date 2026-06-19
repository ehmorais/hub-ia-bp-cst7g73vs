migrate(
  (app) => {
    const shiftTypes = new Collection({
      name: 'shift_types',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'code', type: 'text', required: true },
        { name: 'work_hours', type: 'number', required: true },
        { name: 'rest_hours', type: 'number', required: true },
        { name: 'is_administrative', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(shiftTypes)

    const contracts = app.findCollectionByNameOrId('staff_contracts')
    contracts.fields.add(
      new RelationField({
        name: 'shift_type',
        collectionId: shiftTypes.id,
        maxSelect: 1,
      }),
    )
    app.save(contracts)

    const sectors = app.findCollectionByNameOrId('hospital_sectors')
    sectors.fields.add(new NumberField({ name: 'bed_capacity' }))
    sectors.fields.add(new NumberField({ name: 'staffing_ratio' }))
    sectors.fields.add(new BoolField({ name: 'is_critical' }))
    app.save(sectors)
  },
  (app) => {
    const sectors = app.findCollectionByNameOrId('hospital_sectors')
    if (sectors.fields.getByName('bed_capacity')) sectors.fields.removeByName('bed_capacity')
    if (sectors.fields.getByName('staffing_ratio')) sectors.fields.removeByName('staffing_ratio')
    if (sectors.fields.getByName('is_critical')) sectors.fields.removeByName('is_critical')
    app.save(sectors)

    const contracts = app.findCollectionByNameOrId('staff_contracts')
    if (contracts.fields.getByName('shift_type')) contracts.fields.removeByName('shift_type')
    app.save(contracts)

    try {
      app.delete(app.findCollectionByNameOrId('shift_types'))
    } catch (_) {}
  },
)
