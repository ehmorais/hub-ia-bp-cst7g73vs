migrate(
  (app) => {
    const staffProfiles = app.findCollectionByNameOrId('staff_profiles')
    const sectors = app.findCollectionByNameOrId('hospital_sectors')
    const contracts = app.findCollectionByNameOrId('staff_contracts')
    const timeoffs = app.findCollectionByNameOrId('timeoff_requests')
    const shifts = app.findCollectionByNameOrId('shifts')

    if (!staffProfiles.fields.getByName('default_sector')) {
      staffProfiles.fields.add(
        new RelationField({
          name: 'default_sector',
          collectionId: sectors.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: false,
        }),
      )
      app.save(staffProfiles)
    }

    if (!contracts.fields.getByName('staff_profile')) {
      contracts.fields.add(
        new RelationField({
          name: 'staff_profile',
          collectionId: staffProfiles.id,
          maxSelect: 1,
          cascadeDelete: true,
          required: false,
        }),
      )
      app.save(contracts)
    }

    if (!timeoffs.fields.getByName('staff_profile')) {
      timeoffs.fields.add(
        new RelationField({
          name: 'staff_profile',
          collectionId: staffProfiles.id,
          maxSelect: 1,
          cascadeDelete: true,
          required: false,
        }),
      )
      app.save(timeoffs)
    }

    const legacyShiftUser = shifts.fields.getByName('user')
    if (legacyShiftUser && legacyShiftUser.required) {
      legacyShiftUser.required = false
    }
    if (!shifts.fields.getByName('staff_profile')) {
      shifts.fields.add(
        new RelationField({
          name: 'staff_profile',
          collectionId: staffProfiles.id,
          maxSelect: 1,
          cascadeDelete: true,
          required: false,
        }),
      )
    }
    app.save(shifts)
  },
  (app) => {
    const contracts = app.findCollectionByNameOrId('staff_contracts')
    const timeoffs = app.findCollectionByNameOrId('timeoff_requests')
    const shifts = app.findCollectionByNameOrId('shifts')
    const staffProfiles = app.findCollectionByNameOrId('staff_profiles')

    if (contracts.fields.getByName('staff_profile')) {
      contracts.fields.removeByName('staff_profile')
      app.save(contracts)
    }
    if (timeoffs.fields.getByName('staff_profile')) {
      timeoffs.fields.removeByName('staff_profile')
      app.save(timeoffs)
    }
    if (shifts.fields.getByName('staff_profile')) {
      shifts.fields.removeByName('staff_profile')
      app.save(shifts)
    }
    if (staffProfiles.fields.getByName('default_sector')) {
      staffProfiles.fields.removeByName('default_sector')
      app.save(staffProfiles)
    }
  },
)
