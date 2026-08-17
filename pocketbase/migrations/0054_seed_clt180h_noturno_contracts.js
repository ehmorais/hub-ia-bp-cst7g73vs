migrate(
  (app) => {
    // Escala test seed: ensure EVERY staff_profiles collaborator (active or not)
    // has exactly one staff_contracts row set to CLT 180h, 180h/month, Plantão
    // Noturno (12h/36h). Idempotent upsert keyed on the unique index
    // idx_staff_contracts_profile_unique (1 contract per profile).
    //
    // Rules respected:
    // - staff_profiles is NEVER mutated (no name, sector, role, active, ...).
    // - Orphan contracts (staff_profile empty/null) are left untouched.
    // - Re-running is safe: existing contracts are updated in place, missing
    //   ones are created, never duplicated.

    const SHIFT_NOTURNO_ID = 'os1it1wfli5im9l' // Plantão Noturno 12h/36h
    const CONTRACT_TYPE = 'CLT 180h'
    const MONTHLY_HOUR_LIMIT = 180

    if (!app.hasTable('staff_profiles') || !app.hasTable('staff_contracts')) {
      console.log('Seed CLT 180h: tabelas staff_profiles/staff_contracts ausentes — nada a fazer.')
      return
    }

    const contractsCol = app.findCollectionByNameOrId('staff_contracts')

    // Load every staff_profile (active + inactive), oldest first for determinism.
    let profiles = []
    try {
      profiles = app.findRecordsByFilter('staff_profiles', '', 'created', 100000, 0)
    } catch (e) {
      console.log('Seed CLT 180h: falha ao listar staff_profiles — ' + e)
      return
    }

    let processed = 0
    let created = 0
    let updated = 0

    for (const profile of profiles) {
      const profileId = profile.id
      const profileName = profile.getString('name') || '(sem nome)'
      processed++

      // Upsert: try to find an existing contract linked to this profile.
      // The unique index guarantees at most one, but use a filter to be safe.
      let existing = []
      try {
        existing = app.findRecordsByFilter(
          'staff_contracts',
          "staff_profile = '" + profileId + "'",
          'created',
          10,
          0,
        )
      } catch (_) {
        // No matching contract — treat as none.
      }

      if (existing.length > 0) {
        // Update the (first) existing contract in place.
        const contract = existing[0]
        contract.set('contract_type', CONTRACT_TYPE)
        contract.set('monthly_hour_limit', MONTHLY_HOUR_LIMIT)
        contract.set('shift_type', SHIFT_NOTURNO_ID)
        contract.set('staff_profile', profileId)
        app.save(contract)
        updated++

        // If (defensively) more than one contract pointed at this profile,
        // the unique index should already prevent that — but if duplicates
        // somehow exist, leave the extras untouched rather than risk data
        // loss. They will be reported by the verification pass below.
      } else {
        // No contract yet — create a new one.
        const contract = new Record(contractsCol)
        contract.set('contract_type', CONTRACT_TYPE)
        contract.set('monthly_hour_limit', MONTHLY_HOUR_LIMIT)
        contract.set('shift_type', SHIFT_NOTURNO_ID)
        contract.set('staff_profile', profileId)
        app.save(contract)
        created++
      }
    }

    console.log(
      'Processados ' +
        processed +
        ' colaboradores. Criados ' +
        created +
        ' contratos. Atualizados ' +
        updated +
        ' contratos.',
    )

    // --- Verification pass: each profile must have exactly one CLT 180h /
    // 180h / Plantão Noturno contract. Report any profile missing it. ---
    let missing = []
    for (const profile of profiles) {
      const profileId = profile.id
      const profileName = profile.getString('name') || '(sem nome)'

      let linked = []
      try {
        linked = app.findRecordsByFilter(
          'staff_contracts',
          "staff_profile = '" + profileId + "'",
          'created',
          100,
          0,
        )
      } catch (_) {
        // none
      }

      const ok =
        linked.length === 1 &&
        linked[0].getString('contract_type') === CONTRACT_TYPE &&
        linked[0].getInt('monthly_hour_limit') === MONTHLY_HOUR_LIMIT &&
        linked[0].getString('shift_type') === SHIFT_NOTURNO_ID

      if (!ok) {
        missing.push(profileName + ' (ID: ' + profileId + ') — contratos: ' + linked.length)
      }
    }

    if (missing.length > 0) {
      console.log(
        'Verificação CLT 180h: ' +
          missing.length +
          ' colaborador(es) sem contrato válido:\n' +
          missing.join('\n'),
      )
    } else {
      console.log(
        'Verificação CLT 180h: todos os ' +
          processed +
          ' colaboradores possuem contrato CLT 180h / 180h / Plantão Noturno.',
      )
    }
  },
  (app) => {
    // Non-reversible data seed: re-running the up migration is the correct way
    // to re-synchronize. The down migration is a no-op so the test contracts
    // created here are not silently destroyed on rollback.
  },
)
