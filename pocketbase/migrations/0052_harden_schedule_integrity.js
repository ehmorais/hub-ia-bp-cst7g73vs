migrate(
  (app) => {
    const profiles = app.findCollectionByNameOrId('staff_profiles')
    if (!profiles.fields.getByName('active')) {
      profiles.fields.add(new BoolField({ name: 'active' }))
    }
    profiles.addIndex(
      'idx_staff_profiles_professional_id_unique',
      true,
      'professional_id',
      "professional_id != ''",
    )
    profiles.addIndex('idx_staff_profiles_sector_active', false, 'default_sector, active', '')
    app.save(profiles)

    const profileRecords = app.findRecordsByFilter('staff_profiles', '', 'created', 10000, 0)
    const genericNames = {
      'Enfermeiro Padrão': true,
      'Equipe Administrativa': true,
      'Médico Plantonista': true,
      'Perfil Enfermagem Geral': true,
      'Perfil Médico UTI': true,
    }
    profileRecords.forEach(function (profile) {
      profile.set('active', !genericNames[profile.getString('name')])
      app.save(profile)
    })

    const contracts = app.findCollectionByNameOrId('staff_contracts')
    const contractProfile = contracts.fields.getByName('staff_profile')
    if (contractProfile) contractProfile.cascadeDelete = false
    contracts.addIndex(
      'idx_staff_contracts_profile_unique',
      true,
      'staff_profile',
      "staff_profile != ''",
    )
    app.save(contracts)

    const timeoffs = app.findCollectionByNameOrId('timeoff_requests')
    const timeoffProfile = timeoffs.fields.getByName('staff_profile')
    if (timeoffProfile) timeoffProfile.cascadeDelete = false
    timeoffs.addIndex(
      'idx_timeoff_profile_cycle_dates',
      false,
      'staff_profile, cycle, date, end_date',
      '',
    )
    app.save(timeoffs)

    const shifts = app.findCollectionByNameOrId('shifts')
    const shiftProfile = shifts.fields.getByName('staff_profile')
    if (shiftProfile) shiftProfile.cascadeDelete = false
    shifts.addIndex('idx_shifts_cycle_sector_start', false, 'cycle, sector, start_time', '')
    shifts.addIndex(
      'idx_shifts_profile_cycle_start_unique',
      true,
      'staff_profile, cycle, start_time',
      "staff_profile != ''",
    )
    app.save(shifts)
  },
  (app) => {
    const shifts = app.findCollectionByNameOrId('shifts')
    shifts.removeIndex('idx_shifts_profile_cycle_start_unique')
    shifts.removeIndex('idx_shifts_cycle_sector_start')
    app.save(shifts)

    const timeoffs = app.findCollectionByNameOrId('timeoff_requests')
    timeoffs.removeIndex('idx_timeoff_profile_cycle_dates')
    app.save(timeoffs)

    const contracts = app.findCollectionByNameOrId('staff_contracts')
    contracts.removeIndex('idx_staff_contracts_profile_unique')
    app.save(contracts)

    const profiles = app.findCollectionByNameOrId('staff_profiles')
    profiles.removeIndex('idx_staff_profiles_sector_active')
    profiles.removeIndex('idx_staff_profiles_professional_id_unique')
    if (profiles.fields.getByName('active')) profiles.fields.removeByName('active')
    app.save(profiles)
  },
)
