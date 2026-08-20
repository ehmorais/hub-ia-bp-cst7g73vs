migrate(
  (app) => {
    app.runInTransaction((txApp) => {
      var utiAdulto = null

      // Prioriza o setor histórico já usado por escalas e colaboradores.
      try {
        var knownSector = txApp.findRecordById('hospital_sectors', 'e8knxl3jy0s5ql5')
        if (knownSector.getString('name').trim().toLowerCase() === 'uti adulto') {
          utiAdulto = knownSector
        }
      } catch (_) {}

      // Fallback seguro caso o identificador histórico não exista neste ambiente.
      if (!utiAdulto) {
        try {
          utiAdulto = txApp.findFirstRecordByData('hospital_sectors', 'name', 'UTI Adulto')
        } catch (_) {
          try {
            utiAdulto = txApp.findFirstRecordByData('hospital_sectors', 'name', 'UTI ADULTO')
          } catch (_) {}
        }
      }

      if (!utiAdulto) {
        throw new Error('Setor UTI Adulto não encontrado; nenhum colaborador foi alterado.')
      }

      var unassigned = txApp.findRecordsByFilter(
        'staff_profiles',
        'default_sector=""',
        'name',
        10000,
        0,
      )

      for (var i = 0; i < unassigned.length; i++) {
        unassigned[i].set('default_sector', utiAdulto.id)
        txApp.save(unassigned[i])
      }

      console.log(
        '0060_assign_unassigned_staff_to_uti_adulto: ' +
          unassigned.length +
          ' colaborador(es) vinculado(s) ao setor ' +
          utiAdulto.id,
      )
    })
  },
  (app) => {
    // Data backfill intencionalmente não destrutivo: o rollback não remove
    // vínculos que já podem ter sido confirmados ou alterados após a aplicação.
  },
)
