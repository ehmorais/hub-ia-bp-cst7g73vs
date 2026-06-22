migrate(
  (app) => {
    const findOrCreate = (collectionName, fieldName, value, createFn) => {
      try {
        return app.findFirstRecordByData(collectionName, fieldName, value)
      } catch (_) {
        const col = app.findCollectionByNameOrId(collectionName)
        const record = new Record(col)
        createFn(record)
        app.save(record)
        return record
      }
    }

    let depId = null
    try {
      const deps = app.findRecordsByFilter('departments', '1=1', 'created', 1, 0)
      if (deps.length > 0) depId = deps[0].id
    } catch (_) {}

    // 1. Shift Cycles
    const cicloOut = findOrCreate('shift_cycles', 'name', 'Ciclo Outubro 2023', (r) => {
      r.set('name', 'Ciclo Outubro 2023')
      r.set('start_date', '2023-10-01 00:00:00.000Z')
      r.set('end_date', '2023-10-31 23:59:59.000Z')
      r.set('request_deadline', '2023-09-15 23:59:59.000Z')
      r.set('status', 'closed')
    })

    const cicloNov = findOrCreate('shift_cycles', 'name', 'Ciclo Novembro 2023', (r) => {
      r.set('name', 'Ciclo Novembro 2023')
      r.set('start_date', '2023-11-01 00:00:00.000Z')
      r.set('end_date', '2023-11-30 23:59:59.000Z')
      r.set('request_deadline', '2023-10-15 23:59:59.000Z')
      r.set('status', 'active')
    })

    // 2. Shift Types
    const typeDiurno = findOrCreate('shift_types', 'name', 'Plantão Diurno', (r) => {
      r.set('name', 'Plantão Diurno')
      r.set('code', 'PL_DIURNO')
      r.set('work_hours', 12)
      r.set('rest_hours', 36)
      r.set('start_time', '07:00')
      r.set('end_time', '19:00')
      r.set('is_administrative', false)
    })

    const typeNoturno = findOrCreate('shift_types', 'name', 'Plantão Noturno', (r) => {
      r.set('name', 'Plantão Noturno')
      r.set('code', 'PL_NOTURNO')
      r.set('work_hours', 12)
      r.set('rest_hours', 36)
      r.set('start_time', '19:00')
      r.set('end_time', '07:00')
      r.set('is_administrative', false)
    })

    const typeAdmin = findOrCreate('shift_types', 'name', 'Administrativo', (r) => {
      r.set('name', 'Administrativo')
      r.set('code', 'ADM_8H')
      r.set('work_hours', 8)
      r.set('rest_hours', 16)
      r.set('start_time', '08:00')
      r.set('end_time', '17:00')
      r.set('is_administrative', true)
    })

    // 3. Hospital Sectors
    const secUti = findOrCreate('hospital_sectors', 'name', 'UTI Adulto', (r) => {
      r.set('name', 'UTI Adulto')
      if (depId) r.set('department', depId)
      r.set('min_staffing', 6)
      r.set('ideal_staffing', 10)
      r.set('bed_capacity', 20)
      r.set('staffing_ratio', 2)
      r.set('is_critical', true)
    })

    const secEmerg = findOrCreate('hospital_sectors', 'name', 'Emergência', (r) => {
      r.set('name', 'Emergência')
      if (depId) r.set('department', depId)
      r.set('min_staffing', 10)
      r.set('ideal_staffing', 15)
      r.set('bed_capacity', 30)
      r.set('staffing_ratio', 3)
      r.set('is_critical', true)
    })

    const secEnf = findOrCreate('hospital_sectors', 'name', 'Enfermaria', (r) => {
      r.set('name', 'Enfermaria')
      if (depId) r.set('department', depId)
      r.set('min_staffing', 4)
      r.set('ideal_staffing', 8)
      r.set('bed_capacity', 40)
      r.set('staffing_ratio', 5)
      r.set('is_critical', false)
    })

    // 4. Staff Roles
    const roleMed = findOrCreate('staff_roles', 'name', 'Médico Plantonista', (r) => {
      r.set('name', 'Médico Plantonista')
      r.set('hierarchy_rank', 1)
      r.set('requires_supervision', false)
    })

    const roleEnf = findOrCreate('staff_roles', 'name', 'Enfermeiro', (r) => {
      r.set('name', 'Enfermeiro')
      r.set('hierarchy_rank', 2)
      r.set('requires_supervision', false)
    })

    const roleTec = findOrCreate('staff_roles', 'name', 'Técnico de Enfermagem', (r) => {
      r.set('name', 'Técnico de Enfermagem')
      r.set('hierarchy_rank', 3)
      r.set('requires_supervision', true)
    })

    // 5. Shift Rules
    const ruleMaxHours = findOrCreate(
      'shift_rules',
      'name',
      'Carga Horária Máxima Semanal',
      (r) => {
        r.set('name', 'Carga Horária Máxima Semanal')
        r.set('rule_type', 'max_hours')
        r.set('value', 44)
        if (depId) r.set('department', depId)
      },
    )

    const ruleMinRest = findOrCreate('shift_rules', 'name', 'Descanso Mínimo', (r) => {
      r.set('name', 'Descanso Mínimo')
      r.set('rule_type', 'min_rest_hours')
      r.set('value', 11)
      if (depId) r.set('department', depId)
    })

    const ruleMix = findOrCreate('shift_rules', 'name', 'Mix de Profissionais', (r) => {
      r.set('name', 'Mix de Profissionais')
      r.set('rule_type', 'professional_mix')
      r.set('value', 30)
      if (depId) r.set('department', depId)
    })

    const rulePrompt = findOrCreate('shift_rules', 'name', 'Regras Médicas UTI', (r) => {
      r.set('name', 'Regras Médicas UTI')
      r.set('rule_type', 'custom_prompt')
      r.set('value', 0)
      r.set(
        'prompt',
        'Nunca coloque um médico recém-formado no plantão noturno da UTI sem um senior.',
      )
      if (depId) r.set('department', depId)
    })

    // 6. Staff Profiles
    const profMedUti = findOrCreate('staff_profiles', 'name', 'Perfil Médico UTI', (r) => {
      r.set('name', 'Perfil Médico UTI')
      r.set('rules', [ruleMaxHours.id, ruleMinRest.id, rulePrompt.id])
    })

    const profEnfGeral = findOrCreate('staff_profiles', 'name', 'Perfil Enfermagem Geral', (r) => {
      r.set('name', 'Perfil Enfermagem Geral')
      r.set('rules', [ruleMaxHours.id, ruleMinRest.id, ruleMix.id])
    })

    // 7. Users and Contracts
    const usersData = [
      {
        email: 'dr.joao@exemplo.com',
        name: 'Dr. João Silva',
        role: roleMed,
        sec: secUti,
        prof: profMedUti,
        cType: 'PJ',
        cLimit: 120,
        sType: typeDiurno,
      },
      {
        email: 'dra.maria@exemplo.com',
        name: 'Dra. Maria Oliveira',
        role: roleMed,
        sec: secEmerg,
        prof: profMedUti,
        cType: 'PJ',
        cLimit: 180,
        sType: typeNoturno,
      },
      {
        email: 'dr.pedro@exemplo.com',
        name: 'Dr. Pedro Costa',
        role: roleMed,
        sec: secUti,
        prof: profMedUti,
        cType: 'Autônomo',
        cLimit: 60,
        sType: typeNoturno,
      },
      {
        email: 'enf.ana@exemplo.com',
        name: 'Ana Souza (Enf)',
        role: roleEnf,
        sec: secUti,
        prof: profEnfGeral,
        cType: 'CLT 180h',
        cLimit: 180,
        sType: typeDiurno,
      },
      {
        email: 'enf.carlos@exemplo.com',
        name: 'Carlos Santos (Enf)',
        role: roleEnf,
        sec: secEmerg,
        prof: profEnfGeral,
        cType: 'CLT 180h',
        cLimit: 180,
        sType: typeNoturno,
      },
      {
        email: 'tec.julia@exemplo.com',
        name: 'Júlia Lima (Tec)',
        role: roleTec,
        sec: secUti,
        prof: profEnfGeral,
        cType: 'CLT 180h',
        cLimit: 180,
        sType: typeDiurno,
      },
      {
        email: 'tec.marcos@exemplo.com',
        name: 'Marcos Alves (Tec)',
        role: roleTec,
        sec: secEmerg,
        prof: profEnfGeral,
        cType: 'CLT 180h',
        cLimit: 180,
        sType: typeNoturno,
      },
      {
        email: 'tec.fernanda@exemplo.com',
        name: 'Fernanda Rocha (Tec)',
        role: roleTec,
        sec: secEnf,
        prof: profEnfGeral,
        cType: 'CLT 180h',
        cLimit: 180,
        sType: typeDiurno,
      },
      {
        email: 'tec.lucas@exemplo.com',
        name: 'Lucas Mendes (Tec)',
        role: roleTec,
        sec: secEnf,
        prof: profEnfGeral,
        cType: 'CLT 180h',
        cLimit: 180,
        sType: typeNoturno,
      },
      {
        email: 'adm.paula@exemplo.com',
        name: 'Paula Nogueira (Adm)',
        role: roleEnf,
        sec: secEnf,
        prof: profEnfGeral,
        cType: 'CLT 180h',
        cLimit: 220,
        sType: typeAdmin,
      },
    ]

    const usersCol = app.findCollectionByNameOrId('users')
    const contractsCol = app.findCollectionByNameOrId('staff_contracts')
    const createdUsers = []

    for (const ud of usersData) {
      let uRec
      try {
        uRec = app.findAuthRecordByEmail('users', ud.email)
      } catch (_) {
        uRec = new Record(usersCol)
        uRec.setEmail(ud.email)
        uRec.setPassword('Skip@Pass')
        uRec.setVerified(true)
        uRec.set('name', ud.name)
        uRec.set('role', 'Operador')
        uRec.set('staff_role', ud.role.id)
        uRec.set('default_sector', ud.sec.id)
        uRec.set('staff_profile', ud.prof.id)
        app.save(uRec)
      }
      createdUsers.push(uRec)

      try {
        app.findFirstRecordByData('staff_contracts', 'user', uRec.id)
      } catch (_) {
        const cRec = new Record(contractsCol)
        cRec.set('user', uRec.id)
        cRec.set('contract_type', ud.cType)
        cRec.set('monthly_hour_limit', ud.cLimit)
        cRec.set('shift_type', ud.sType.id)
        app.save(cRec)
      }
    }

    // 8. Timeoff Requests
    const timeoffsData = [
      {
        user: createdUsers[0],
        date: '2023-11-10 00:00:00.000Z',
        end: '2023-11-12 23:59:59.000Z',
        status: 'pending',
        weight: 5,
      },
      {
        user: createdUsers[1],
        date: '2023-11-15 00:00:00.000Z',
        end: '2023-11-15 23:59:59.000Z',
        status: 'fulfilled',
        weight: 3,
      },
      {
        user: createdUsers[3],
        date: '2023-11-20 00:00:00.000Z',
        end: '2023-11-25 23:59:59.000Z',
        status: 'pending',
        weight: 8,
      },
      {
        user: createdUsers[5],
        date: '2023-11-05 00:00:00.000Z',
        end: '2023-11-05 23:59:59.000Z',
        status: 'not_fulfilled',
        weight: 1,
      },
      {
        user: createdUsers[7],
        date: '2023-11-28 00:00:00.000Z',
        end: '2023-11-30 23:59:59.000Z',
        status: 'pending',
        weight: 4,
      },
    ]

    const timeoffsCol = app.findCollectionByNameOrId('timeoff_requests')
    for (const to of timeoffsData) {
      try {
        const reqs = app.findRecordsByFilter(
          'timeoff_requests',
          `user = '${to.user.id}' && date = '${to.date}'`,
          'created',
          1,
          0,
        )
        if (reqs.length === 0) {
          const r = new Record(timeoffsCol)
          r.set('user', to.user.id)
          r.set('cycle', cicloNov.id)
          r.set('date', to.date)
          r.set('end_date', to.end)
          r.set('status', to.status)
          r.set('priority_weight', to.weight)
          app.save(r)
        }
      } catch (_) {}
    }
  },
  (app) => {
    // down migration is a no-op
  },
)
