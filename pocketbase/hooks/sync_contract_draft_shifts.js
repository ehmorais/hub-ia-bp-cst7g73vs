onRecordAfterUpdateSuccess((e) => {
  e.next()

  const profileId = e.record.getString('staff_profile')
  const shiftTypeId = e.record.getString('shift_type')
  if (!profileId || !shiftTypeId) return

  try {
    const shiftType = $app.findRecordById('shift_types', shiftTypeId)
    let startTime = shiftType.getString('start_time') || '07:00'
    if (startTime.length === 5) startTime = startTime + ':00'
    const workHours = shiftType.getInt('work_hours') || 12

    const shifts = $app.findRecordsByFilter(
      'shifts',
      "staff_profile={:profile} && draft!=''",
      'start_time',
      10000,
      0,
      { profile: profileId },
    )

    let updated = 0
    shifts.forEach((shift) => {
      try {
        const draftId = shift.getString('draft')
        if (!draftId) return
        const draft = $app.findRecordById('schedule_drafts', draftId)
        const draftStatus = draft.getString('status')
        if (draftStatus !== 'draft' && draftStatus !== 'validated') return

        const date = (shift.getString('start_time') || '').split(' ')[0]
        if (!date) return
        const startDate = new Date(date + 'T' + startTime + '.000Z')
        const endDate = new Date(startDate.getTime() + workHours * 3600000)
        shift.set('start_time', startDate.toISOString())
        shift.set('end_time', endDate.toISOString())
        $app.save(shift)
        updated++
      } catch (shiftErr) {
        $app
          .logger()
          .error(
            'Falha ao sincronizar plantão com contrato',
            'contractId',
            e.record.id,
            'shiftId',
            shift.id,
            'error',
            shiftErr && shiftErr.message ? shiftErr.message : String(shiftErr),
          )
      }
    })

    $app
      .logger()
      .info(
        'Rascunhos sincronizados após alteração de contrato',
        'contractId',
        e.record.id,
        'staffProfile',
        profileId,
        'updatedShifts',
        updated,
      )
  } catch (err) {
    $app
      .logger()
      .error(
        'Falha na sincronização do contrato com rascunhos',
        'contractId',
        e.record.id,
        'error',
        err && err.message ? err.message : String(err),
      )
  }
}, 'staff_contracts')
