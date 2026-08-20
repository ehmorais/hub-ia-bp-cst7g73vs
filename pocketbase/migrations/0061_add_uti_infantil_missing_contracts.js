migrate(
  (app) => {
    app.runInTransaction((txApp) => {
      const UTI_INFANTIL_ID = 'i002523ouyotg6f'
      const SHIFT_NOTURNO_ID = 'os1it1wfli5im9l'
      const CONTRACT_TYPE = 'CLT 180h'
      const MONTHLY_HOUR_LIMIT = 180
      const PROFILE_IDS = [
        '1ukda33rkjccwx8',
        'wtrae1plrmbz0ll',
        'y8e3bx8w37jyoks',
        'y70mj8tem8jij14',
      ]

      const contractsCol = txApp.findCollectionByNameOrId('staff_contracts')
      let created = 0
      let existing = 0

      for (const profileId of PROFILE_IDS) {
        const profile = txApp.findRecordById('staff_profiles', profileId)

        if (profile.getString('default_sector') !== UTI_INFANTIL_ID) {
          throw new Error(
            'O colaborador ' +
              profileId +
              ' não pertence mais à UTI Infantil; nenhum contrato foi alterado.',
          )
        }

        const linked = txApp.findRecordsByFilter(
          'staff_contracts',
          "staff_profile = '" + profileId + "'",
          'created',
          10,
          0,
        )

        // Preserve any contract configured after this repair was prepared.
        if (linked.length > 0) {
          existing++
          continue
        }

        const contract = new Record(contractsCol)
        contract.set('staff_profile', profileId)
        contract.set('contract_type', CONTRACT_TYPE)
        contract.set('monthly_hour_limit', MONTHLY_HOUR_LIMIT)
        contract.set('shift_type', SHIFT_NOTURNO_ID)
        txApp.save(contract)
        created++
      }

      console.log(
        '0061_add_uti_infantil_missing_contracts: ' +
          created +
          ' contrato(s) criado(s); ' +
          existing +
          ' vínculo(s) já configurado(s) e preservado(s).',
      )
    })
  },
  (app) => {
    // Correção de dados intencionalmente não destrutiva: o rollback não remove
    // contratos que podem ter sido usados ou alterados após esta migração.
  },
)
