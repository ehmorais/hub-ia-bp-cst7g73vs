routerAdd(
  'POST',
  '/backend/v1/generate-staff-schedule',
  (e) => {
    if (!e.auth || e.auth.getString('role') !== 'Admin') {
      return e.forbiddenError('Apenas administradores podem gerar escalas individuais.')
    }

    const body = e.requestInfo().body || {}
    const profileId = body.staff_profile_id || body.user_id
    const cycleId = body.cycle_id
    const sectorId = body.sector_id

    if (!profileId || !cycleId) {
      return e.badRequestError('staff_profile_id and cycle_id are required')
    }

    var auditCol = $app.findCollectionByNameOrId('audit_logs')
    var logAudit = function (action, details, tokens) {
      var audit = new Record(auditCol)
      audit.set('user', e.auth ? e.auth.id : '')
      audit.set('action', action)
      audit.set('details', typeof details === 'string' ? details : JSON.stringify(details))
      if (tokens) audit.set('token_usage', tokens)
      $app.saveNoValidate(audit)
    }

    logAudit('AI_STAFF_SCHEDULE_GENERATION', {
      status: 'started',
      target_user: profileId,
      cycle_id: cycleId,
      sector_id: sectorId,
    })

    var cycle
    try {
      cycle = $app.findRecordById('shift_cycles', cycleId)
    } catch (_) {
      logAudit('AI_STAFF_SCHEDULE_GENERATION', {
        status: 'error',
        target_user: profileId,
        cycle_id: cycleId,
        error: 'Cycle not found',
        staff_processed: 0,
      })
      return e.json(400, {
        error: 'CYCLE_NOT_FOUND',
        message: 'O ciclo de escala informado não foi encontrado.',
      })
    }

    var user
    try {
      user = $app.findRecordById('staff_profiles', profileId)
    } catch (_) {
      logAudit('AI_STAFF_SCHEDULE_GENERATION', {
        status: 'error',
        target_user: profileId,
        cycle_id: cycleId,
        error: 'Staff profile not found',
        staff_processed: 0,
      })
      return e.json(400, {
        error: 'STAFF_PROFILE_NOT_FOUND',
        message: 'O colaborador informado não foi encontrado.',
      })
    }

    const targetSector = sectorId || user.getString('default_sector')

    if (!targetSector) {
      logAudit('AI_STAFF_SCHEDULE_GENERATION', {
        status: 'error',
        target_user: profileId,
        cycle_id: cycleId,
        error: 'No sector selected',
        staff_processed: 0,
      })
      return e.json(400, {
        error: 'MISSING_SECTOR',
        message: 'Nenhum setor selecionado e o colaborador não possui setor padrão.',
      })
    }

    // Pre-check: verify the target sector has users with both staff_role and staff_contract
    var sectorUsers = $app.findRecordsByFilter(
      'staff_profiles',
      "default_sector='" + targetSector + "'",
      '',
      10000,
      0,
    )

    var eligibleStaffCount = 0
    sectorUsers.forEach(function (su) {
      var hasRole = !!su.getString('staff_role')
      var hasContract = false
      if (hasRole) {
        try {
          $app.findFirstRecordByFilter('staff_contracts', "staff_profile='" + su.id + "'")
          hasContract = true
        } catch (_) {}
      }
      if (hasRole && hasContract) eligibleStaffCount++
    })

    // Also check the target user specifically
    var targetHasRole = !!user.getString('staff_role')
    var targetHasContract = false
    if (targetHasRole) {
      try {
        $app.findFirstRecordByFilter('staff_contracts', "staff_profile='" + profileId + "'")
        targetHasContract = true
      } catch (_) {}
    }

    if (!targetHasRole || !targetHasContract) {
      logAudit('AI_STAFF_SCHEDULE_GENERATION', {
        status: 'error',
        target_user: profileId,
        cycle_id: cycleId,
        sector_id: targetSector,
        error: 'MISSING_STAFF_DATA',
        target_has_role: targetHasRole,
        target_has_contract: targetHasContract,
        staff_processed: 0,
      })
      return e.json(400, {
        error: 'MISSING_STAFF_DATA',
        message: 'Nenhum colaborador com contrato e cargo ativo encontrado para este setor.',
      })
    }

    if (eligibleStaffCount === 0) {
      logAudit('AI_STAFF_SCHEDULE_GENERATION', {
        status: 'error',
        target_user: profileId,
        cycle_id: cycleId,
        sector_id: targetSector,
        error: 'MISSING_STAFF_DATA',
        staff_processed: 0,
      })
      return e.json(400, {
        error: 'MISSING_STAFF_DATA',
        message: 'Nenhum colaborador com contrato e cargo ativo encontrado para este setor.',
      })
    }

    let contract
    try {
      contract = $app.findFirstRecordByFilter(
        'staff_contracts',
        "staff_profile='" + profileId + "'",
      )
    } catch (_) {
      logAudit('AI_STAFF_SCHEDULE_GENERATION', {
        status: 'error',
        target_user: profileId,
        cycle_id: cycleId,
        sector_id: targetSector,
        error: 'Staff profile has no contract',
        staff_processed: eligibleStaffCount,
      })
      return e.json(400, {
        error: 'MISSING_STAFF_DATA',
        message: 'Nenhum colaborador com contrato e cargo ativo encontrado para este setor.',
      })
    }

    const shiftTypeId = contract.getString('shift_type')
    let shiftType
    try {
      if (shiftTypeId) shiftType = $app.findRecordById('shift_types', shiftTypeId)
    } catch (_) {}

    const workHours = shiftType ? shiftType.getInt('work_hours') || 12 : 12
    const restHours = shiftType ? shiftType.getInt('rest_hours') || 36 : 36
    let startTimeStr = shiftType ? shiftType.getString('start_time') : '07:00'
    if (!startTimeStr) startTimeStr = '07:00'

    const startDateRaw = cycle.getString('start_date').split(' ')[0]
    const endDateRaw = cycle.getString('end_date').split(' ')[0]

    const timeoffs = $app.findRecordsByFilter(
      'timeoff_requests',
      "staff_profile='" + profileId + "' && cycle='" + cycleId + "' && status='fulfilled'",
      '',
      1000,
      0,
    )
    const timeoffDays = timeoffs.map(function (t) {
      return t.getString('date').split(' ')[0]
    })

    const monthlyLimit = contract.getInt('monthly_hour_limit') || 180

    const pendingTimeoffs = $app.findRecordsByFilter(
      'timeoff_requests',
      "staff_profile='" + profileId + "' && cycle='" + cycleId + "' && status='pending'",
      '',
      1000,
      0,
    )
    pendingTimeoffs.forEach(function (t) {
      timeoffDays.push(t.getString('date').split(' ')[0])
    })

    const existingUserShifts = $app.findRecordsByFilter(
      'shifts',
      "staff_profile='" + profileId + "' && cycle='" + cycleId + "'",
      '',
      10000,
      0,
    )
    existingUserShifts.forEach(function (s) {
      $app.delete(s)
    })

    const allSectorShifts = $app.findRecordsByFilter(
      'shifts',
      "sector='" + targetSector + "' && cycle='" + cycleId + "'",
      '',
      10000,
      0,
    )

    const staffingCount = {}
    let current = new Date(startDateRaw + 'T00:00:00Z')
    const endObj = new Date(endDateRaw + 'T23:59:59Z')
    while (current <= endObj) {
      staffingCount[current.toISOString().split('T')[0]] = 0
      current = new Date(current.getTime() + 24 * 3600000)
    }

    allSectorShifts.forEach(function (s) {
      var d = s.getString('start_time').split(' ')[0]
      if (staffingCount[d] !== undefined) staffingCount[d]++
    })

    const shiftsCol = $app.findCollectionByNameOrId('shifts')
    const createdShifts = []

    let bestStartOffset = 0
    let minScore = 999999
    const stepHours = workHours + restHours
    const stepDays = Math.max(1, Math.round(stepHours / 24))

    for (let offset = 0; offset < stepDays; offset++) {
      let score = 0
      let c = new Date(startDateRaw + 'T00:00:00Z')
      c = new Date(c.getTime() + offset * 24 * 3600000)
      while (c <= endObj) {
        const dStr = c.toISOString().split('T')[0]
        score += staffingCount[dStr] || 0
        c = new Date(c.getTime() + stepDays * 24 * 3600000)
      }
      if (score < minScore) {
        minScore = score
        bestStartOffset = offset
      }
    }

    current = new Date(startDateRaw + 'T00:00:00Z')
    current = new Date(current.getTime() + bestStartOffset * 24 * 3600000)
    let totalHours = 0
    let skippedTimeoff = 0

    while (current <= endObj && totalHours + workHours <= monthlyLimit) {
      const dateStr = current.toISOString().split('T')[0]

      if (timeoffDays.indexOf(dateStr) === -1) {
        const record = new Record(shiftsCol)
        record.set('staff_profile', profileId)
        record.set('sector', targetSector)
        record.set('cycle', cycleId)

        let st = startTimeStr
        if (st.length === 5) st += ':00'

        const shiftStart = new Date(dateStr + 'T' + st + '.000Z')
        const shiftEnd = new Date(shiftStart.getTime() + workHours * 3600000)

        record.set('start_time', shiftStart.toISOString().replace('T', ' ').substring(0, 23) + 'Z')
        record.set('end_time', shiftEnd.toISOString().replace('T', ' ').substring(0, 23) + 'Z')

        $app.save(record)
        createdShifts.push(record)
        totalHours += workHours
      } else {
        skippedTimeoff++
      }

      current = new Date(current.getTime() + stepDays * 24 * 3600000)
    }

    logAudit('AI_STAFF_SCHEDULE_GENERATION', {
      status: 'success',
      target_user: profileId,
      cycle_id: cycleId,
      sector_id: targetSector,
      shifts_created: createdShifts.length,
      total_hours: totalHours,
      skipped_timeoff_days: skippedTimeoff,
      staff_processed: eligibleStaffCount,
    })

    return e.json(200, { success: true, count: createdShifts.length })
  },
  $apis.requireAuth(),
)
