migrate(
  (app) => {
    // Cadastrar a colaboradora solicitada pelo usuário:
    // Nome: Angélica Cristina Geonçalves dos Santos (grafia exata com "Geonçalves")
    // Cargo: Enfermeira ("rq7lhkjipmiir86" -> Enfermeira (o))
    // Registro: 836579 (COREN 836579)
    // Setor: UTI 2 ("b1nh1ykstcsgj1r")
    // Equipe: Equipe 2 (paridade "odd" / dias ímpares)
    // Turno / Contrato: Plantão Noturno ("os1it1wfli5im9l" / CLT 180h / 180h mensais)

    if (!app.hasTable('staff_profiles') || !app.hasTable('hospital_sectors')) {
      console.log('Tabelas necessárias não existem — abortando cadastro de colaboradora.')
      return
    }

    const profilesCol = app.findCollectionByNameOrId('staff_profiles')
    const contractsCol = app.hasTable('staff_contracts')
      ? app.findCollectionByNameOrId('staff_contracts')
      : null

    // 1. Resolver Setor "UTI 2"
    let sectorRecord = null
    try {
      sectorRecord = app.findFirstRecordByData('hospital_sectors', 'name', 'UTI 2')
    } catch (_) {
      try {
        sectorRecord = app.findRecordById('hospital_sectors', 'b1nh1ykstcsgj1r')
      } catch (_) {}
    }
    const sectorId = sectorRecord ? sectorRecord.id : 'b1nh1ykstcsgj1r'

    // 2. Resolver Cargo "Enfermeira (o)" ou "Enfermeira" ou "Enfermeiro"
    let roleRecord = null
    const candidateRoleNames = ['Enfermeira (o)', 'Enfermeira', 'Enfermeiro']
    for (const rName of candidateRoleNames) {
      try {
        roleRecord = app.findFirstRecordByData('staff_roles', 'name', rName)
        if (roleRecord) break
      } catch (_) {}
    }
    if (!roleRecord) {
      try {
        roleRecord = app.findRecordById('staff_roles', 'rq7lhkjipmiir86')
      } catch (_) {}
    }
    const roleId = roleRecord ? roleRecord.id : 'rq7lhkjipmiir86'

    // 3. Resolver Turno "Plantão Noturno"
    let shiftTypeRecord = null
    try {
      shiftTypeRecord = app.findFirstRecordByData('shift_types', 'code', 'PL_NOTURNO')
    } catch (_) {
      try {
        shiftTypeRecord = app.findFirstRecordByData('shift_types', 'name', 'Plantão Noturno')
      } catch (_) {
        try {
          shiftTypeRecord = app.findRecordById('shift_types', 'os1it1wfli5im9l')
        } catch (_) {}
      }
    }
    const shiftTypeId = shiftTypeRecord ? shiftTypeRecord.id : 'os1it1wfli5im9l'

    // 4. Data de início no ciclo (ciclo ativo: 2026-10-26 a 2026-11-25)
    // Para Equipe 2 (shift_parity: 'odd' / dia ímpar no calendário civil):
    // 2026-10-27 é dia 27 (ímpar).
    let cycleStartDate = '2026-10-27 00:00:00.000Z'
    try {
      const activeCycles = app.findRecordsByFilter(
        'shift_cycles',
        "status = 'active'",
        '-created',
        1,
        0,
      )
      if (activeCycles && activeCycles.length > 0) {
        const c = activeCycles[0]
        const rawStart = c.getString('start_date') || ''
        const sDate = rawStart.split(' ')[0].split('T')[0]
        if (sDate) {
          const parts = sDate.split('-')
          const dNum = parseInt(parts[2], 10)
          // Se o início do ciclo for ímpar, usa ele; se for par, usa o dia seguinte
          if (dNum % 2 !== 0) {
            cycleStartDate = sDate + ' 00:00:00.000Z'
          } else {
            const nextD = dNum + 1
            const nextDStr = nextD < 10 ? '0' + nextD : '' + nextD
            cycleStartDate = parts[0] + '-' + parts[1] + '-' + nextDStr + ' 00:00:00.000Z'
          }
        }
      }
    } catch (_) {}

    // 5. Verificar se já existe registro com professional_id = '836579'
    let profile = null
    try {
      profile = app.findFirstRecordByData('staff_profiles', 'professional_id', '836579')
    } catch (_) {
      // Também verifica por nome exato caso professional_id não esteja setado
      try {
        profile = app.findFirstRecordByData(
          'staff_profiles',
          'name',
          'Angélica Cristina Geonçalves dos Santos',
        )
      } catch (_) {}
    }

    if (!profile) {
      profile = new Record(profilesCol)
    }

    profile.set('name', 'Angélica Cristina Geonçalves dos Santos')
    profile.set('professional_id', '836579')
    profile.set('staff_role', roleId)
    profile.set('default_sector', sectorId)
    profile.set('shift_parity', 'odd') // Equipe 2
    profile.set('cycle_start_date', cycleStartDate)
    profile.set('active', true)
    profile.set('vacation_enabled', false)
    app.save(profile)

    const profileId = profile.id
    console.log(
      'Colaboradora cadastrada com sucesso: ID=' +
        profileId +
        ', Nome=' +
        profile.getString('name'),
    )

    // 6. Cadastrar ou atualizar contrato operacional (CLT 180h / Plantão Noturno / 180h)
    if (contractsCol) {
      let contract = null
      try {
        const existingContracts = app.findRecordsByFilter(
          'staff_contracts',
          "staff_profile = '" + profileId + "'",
          '-created',
          1,
          0,
        )
        if (existingContracts && existingContracts.length > 0) {
          contract = existingContracts[0]
        }
      } catch (_) {}

      if (!contract) {
        contract = new Record(contractsCol)
      }

      contract.set('staff_profile', profileId)
      contract.set('contract_type', 'CLT 180h')
      contract.set('monthly_hour_limit', 180)
      contract.set('shift_type', shiftTypeId)
      app.save(contract)

      console.log(
        'Contrato vinculado com sucesso: ID=' + contract.id + ' para staff_profile=' + profileId,
      )
    }
  },
  (app) => {
    // Reverter caso necessário
    try {
      const profile = app.findFirstRecordByData('staff_profiles', 'professional_id', '836579')
      if (profile) {
        try {
          const contracts = app.findRecordsByFilter(
            'staff_contracts',
            "staff_profile = '" + profile.id + "'",
            '',
            10,
            0,
          )
          for (const c of contracts) {
            app.delete(c)
          }
        } catch (_) {}
        app.delete(profile)
      }
    } catch (_) {}
  },
)
