migrate(
  (app) => {
    // Cadastrar o colaborador solicitado pelo usuário:
    // Nome: José Antonio Curioni
    // Registro: 1069213 (COREN 1069213)
    // Cargo: Técnico de Enfermagem ("qga4hlcqhgqtqer")
    // Setor padrão: UTI 2 ("b1nh1ykstcsgj1r")
    // Equipe/Paridade: Equipe 2 (paridade "odd" / dias ímpares no ciclo, análogo à Angélica)
    // Turno: Plantão Diurno ("iyvc78yavxhd75o" / 12x36 / badge "D")
    // Contrato: CLT 180h (limite mensal de 180 horas)
    // Ativo: true, sem férias

    if (!app.hasTable('staff_profiles') || !app.hasTable('hospital_sectors')) {
      console.log('Tabelas necessárias não existem — abortando cadastro de colaborador.')
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

    // 2. Resolver Cargo "Técnico de Enfermagem"
    let roleRecord = null
    const candidateRoleNames = [
      'Técnico de Enfermagem',
      'Tecnico de Enfermagem',
      'Técnico Enfermagem',
    ]
    for (const rName of candidateRoleNames) {
      try {
        roleRecord = app.findFirstRecordByData('staff_roles', 'name', rName)
        if (roleRecord) break
      } catch (_) {}
    }
    if (!roleRecord) {
      try {
        roleRecord = app.findRecordById('staff_roles', 'qga4hlcqhgqtqer')
      } catch (_) {}
    }
    const roleId = roleRecord ? roleRecord.id : 'qga4hlcqhgqtqer'

    // 3. Resolver Turno "Plantão Diurno" (PL_DIURNO, 12x36, Diurno)
    let shiftTypeRecord = null
    try {
      shiftTypeRecord = app.findFirstRecordByData('shift_types', 'code', 'PL_DIURNO')
    } catch (_) {
      try {
        shiftTypeRecord = app.findFirstRecordByData('shift_types', 'name', 'Plantão Diurno')
      } catch (_) {
        try {
          shiftTypeRecord = app.findRecordById('shift_types', 'iyvc78yavxhd75o')
        } catch (_) {}
      }
    }
    const shiftTypeId = shiftTypeRecord ? shiftTypeRecord.id : 'iyvc78yavxhd75o'

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

    // 5. Verificar se já existe registro com professional_id = '1069213' ou nome 'José Antonio Curioni'
    let profile = null
    try {
      profile = app.findFirstRecordByData('staff_profiles', 'professional_id', '1069213')
    } catch (_) {
      try {
        profile = app.findFirstRecordByData('staff_profiles', 'name', 'José Antonio Curioni')
      } catch (_) {}
    }

    if (!profile) {
      profile = new Record(profilesCol)
    }

    profile.set('name', 'José Antonio Curioni')
    profile.set('professional_id', '1069213')
    profile.set('staff_role', roleId)
    profile.set('default_sector', sectorId)
    profile.set('shift_parity', 'odd') // Equipe 2 (dias ímpares)
    profile.set('cycle_start_date', cycleStartDate)
    profile.set('active', true)
    profile.set('vacation_enabled', false)
    app.save(profile)

    const profileId = profile.id
    console.log(
      'Colaborador cadastrado/atualizado com sucesso: ID=' +
        profileId +
        ', Nome=' +
        profile.getString('name') +
        ', Paridade=' +
        profile.getString('shift_parity'),
    )

    // 6. Cadastrar ou atualizar contrato operacional (CLT 180h / Plantão Diurno / 180h)
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
        'Contrato vinculado com sucesso: ID=' +
          contract.id +
          ' para staff_profile=' +
          profileId +
          ', shift_type=' +
          shiftTypeId,
      )
    }
  },
  (app) => {
    // Reverter caso necessário
    try {
      const profile = app.findFirstRecordByData('staff_profiles', 'professional_id', '1069213')
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
