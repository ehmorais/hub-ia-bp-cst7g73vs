migrate(
  (app) => {
    app.runInTransaction((txApp) => {
      const UTI_INFANTIL_ID = 'i002523ouyotg6f'
      const cycle = txApp.findFirstRecordByData('shift_cycles', 'name', 'Ciclo Outubro 2026')
      const profiles = txApp.findRecordsByFilter(
        'staff_profiles',
        'default_sector={:sector} && active=true',
        'name',
        10000,
        0,
        { sector: UTI_INFANTIL_ID },
      )

      let updated = 0
      let alreadySynced = 0

      profiles.forEach((profile) => {
        const contracts = txApp.findRecordsByFilter(
          'staff_contracts',
          'staff_profile={:profile}',
          'created',
          2,
          0,
          { profile: profile.id },
        )
        if (contracts.length !== 1) return

        const shiftTypeId = contracts[0].getString('shift_type')
        if (!shiftTypeId) return
        const shiftType = txApp.findRecordById('shift_types', shiftTypeId)
        let startTime = shiftType.getString('start_time') || '07:00'
        if (startTime.length === 5) startTime = startTime + ':00'
        const workHours = shiftType.getInt('work_hours') || 12

        const shifts = txApp.findRecordsByFilter(
          'shifts',
          "staff_profile={:profile} && sector={:sector} && cycle={:cycle} && draft!=''",
          'start_time',
          1000,
          0,
          {
            profile: profile.id,
            sector: UTI_INFANTIL_ID,
            cycle: cycle.id,
          },
        )

        shifts.forEach((shift) => {
          const draft = txApp.findRecordById('schedule_drafts', shift.getString('draft'))
          const status = draft.getString('status')
          if (status !== 'draft' && status !== 'validated') return

          const currentStart = shift.getString('start_time') || ''
          const date = currentStart.split(' ')[0]
          if (!date) return
          const startDate = new Date(date + 'T' + startTime + '.000Z')
          const endDate = new Date(startDate.getTime() + workHours * 3600000)
          const nextStart = startDate.toISOString()
          const nextEnd = endDate.toISOString()

          if (
            new Date(currentStart).toISOString() === nextStart &&
            new Date(shift.getString('end_time')).toISOString() === nextEnd
          ) {
            alreadySynced++
            return
          }

          shift.set('start_time', nextStart)
          shift.set('end_time', nextEnd)
          txApp.save(shift)
          updated++
        })
      })

      console.log(
        '0063_sync_uti_infantil_draft_with_contracts: ' +
          updated +
          ' plantão(ões) corrigido(s); ' +
          alreadySynced +
          ' já sincronizado(s). Escalas publicadas não foram alteradas.',
      )
    })
  },
  (app) => {
    // Correção limitada ao rascunho ativo da UTI Infantil; escalas publicadas
    // nunca são alteradas por esta migração.
  },
)
