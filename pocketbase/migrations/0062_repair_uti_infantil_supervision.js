migrate(
  (app) => {
    app.runInTransaction((txApp) => {
      const UTI_INFANTIL_ID = 'i002523ouyotg6f'

      const sector = txApp.findRecordById('hospital_sectors', UTI_INFANTIL_ID)
      sector.set('min_staffing', 2)
      sector.set('ideal_staffing', 3)
      sector.set('is_critical', true)
      txApp.save(sector)

      // Reassert the canonical supervision semantics used by both the manual
      // planner and the generation backend.
      const nurseRole = txApp.findFirstRecordByData('staff_roles', 'name', 'Enfermeiro')
      nurseRole.set('requires_supervision', false)
      txApp.save(nurseRole)

      const technicianRole = txApp.findFirstRecordByData(
        'staff_roles',
        'name',
        'Técnico de Enfermagem',
      )
      technicianRole.set('requires_supervision', true)
      txApp.save(technicianRole)

      const cycle = txApp.findFirstRecordByData('shift_cycles', 'name', 'Ciclo Outubro 2026')
      const profiles = txApp.findRecordsByFilter(
        'staff_profiles',
        'default_sector={:sec} && active=true',
        'name',
        10000,
        0,
        { sec: UTI_INFANTIL_ID },
      )
      const profileIds = {}
      profiles.forEach((profile) => {
        profileIds[profile.id] = true
      })

      // These collaborators now belong to UTI Infantil. Remove stale draft
      // assignments from other sectors in the same active cycle so the two
      // registered nurses can alternate supervision without uniqueness
      // conflicts. Current UTI Infantil shifts are preserved and will be
      // replaced through the normal draft-generation flow.
      const cycleShifts = txApp.findRecordsByFilter(
        'shifts',
        'cycle={:cyc} && sector!={:sec}',
        'start_time',
        10000,
        0,
        { cyc: cycle.id, sec: UTI_INFANTIL_ID },
      )
      let removed = 0
      cycleShifts.forEach((shift) => {
        const profileId = shift.getString('staff_profile')
        if (!profileIds[profileId]) return
        txApp.delete(shift)
        removed++
      })

      console.log(
        '0062_repair_uti_infantil_supervision: funções normalizadas, setor mínimo 2/ideal 3; ' +
          removed +
          ' plantão(ões) conflitante(s) de outro setor removido(s).',
      )
    })
  },
  (app) => {
    // Correção de dados intencionalmente não destrutiva no rollback.
  },
)
