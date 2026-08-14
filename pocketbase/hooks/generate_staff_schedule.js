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

    var sectorRecord = $app.findRecordById('hospital_sectors', targetSector)
    var requiredStaffing = sectorRecord.getInt('min_staffing') || 0
    var bedCapacity = sectorRecord.getInt('bed_capacity') || 0
    var staffingRatio = sectorRecord.getInt('staffing_ratio') || 0
    if (!sectorRecord.getBool('is_critical') && bedCapacity > 0 && staffingRatio > 0) {
      requiredStaffing = Math.max(requiredStaffing, Math.ceil(bedCapacity / staffingRatio), 2)
    }

    var assignmentsByDay = {}
    var addAssignment = function (profile, day) {
      if (!assignmentsByDay[day]) assignmentsByDay[day] = []
      var roleId = profile.getString('staff_role')
      var rank = 0
      var requires = true
      if (roleId) {
        try {
          var role = $app.findRecordById('staff_roles', roleId)
          rank = role.getInt('hierarchy_rank') || 0
          requires = role.getBool('requires_supervision')
        } catch (_) {}
      }
      assignmentsByDay[day].push({
        id: profile.id,
        name: profile.getString('name') || profile.id,
        rank: rank,
        requires_supervision: requires,
      })
    }

    allSectorShifts.forEach(function (shift) {
      var existingProfileId = shift.getString('staff_profile')
      if (!existingProfileId || existingProfileId === profileId) return
      try {
        addAssignment(
          $app.findRecordById('staff_profiles', existingProfileId),
          shift.getString('start_time').split(' ')[0],
        )
      } catch (_) {}
    })
    createdShifts.forEach(function (shift) {
      addAssignment(user, shift.start_time.split(' ')[0])
    })

    var scheduleViolations = []
    var validationDay = new Date(startDateRaw + 'T00:00:00Z')
    while (validationDay <= endObj) {
      var validationDate = validationDay.toISOString().split('T')[0]
      var dayAssignments = assignmentsByDay[validationDate] || []
      if (dayAssignments.length < requiredStaffing) {
        scheduleViolations.push(
          validationDate + ': efetivo ' + dayAssignments.length + '/' + requiredStaffing + '.',
        )
      }
      dayAssignments.forEach(function (assignment) {
        if (!assignment.requires_supervision) return
        var hasSupervisor = dayAssignments.some(function (candidate) {
          return candidate.id !== assignment.id && candidate.rank > assignment.rank
        })
        if (!hasSupervisor) {
          scheduleViolations.push(
            validationDate + ': supervisão ausente para ' + assignment.name + '.',
          )
        }
      })
      validationDay = new Date(validationDay.getTime() + 86400000)
    }

    if (scheduleViolations.length > 0) {
      return e.json(400, {
        error: 'A escala individual deixaria o setor em condição inválida.',
        violations: scheduleViolations.filter(function (item, index, all) {
          return all.indexOf(item) === index
        }),
      })
    }

    $app.runInTransaction((txApp) => {
      var previous = txApp.findRecordsByFilter(
        'shifts',
        "staff_profile='" + profileId + "' && cycle='" + cycleId + "'",
        '',
        10000,
        0,
      )
      previous.forEach(function (record) {
        txApp.delete(record)
      })

      var shiftsCol = txApp.findCollectionByNameOrId('shifts')
      createdShifts.forEach(function (shift) {
        var record = new Record(shiftsCol)
        record.set('staff_profile', profileId)
        record.set('sector', targetSector)
        record.set('cycle', cycleId)
        record.set('start_time', shift.start_time)
        record.set('end_time', shift.end_time)
        txApp.save(record)
      })
    })

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

    if (user.get('active') === false) {
      return e.json(400, {
        error: 'INACTIVE_STAFF_PROFILE',
        message: 'O colaborador está inativo para geração de escalas.',
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
      "staff_profile='" +
        profileId +
        "' && cycle='" +
        cycleId +
        "' && (status='fulfilled' || status='pending')",
      'date',
      1000,
      0,
    )
    const timeoffDays = []
    timeoffs.forEach(function (request) {
      var start = (request.getString('date') || '').split(' ')[0]
      var end = (request.getString('end_date') || request.getString('date') || '').split(' ')[0]
      if (!start) return
      var cursor = new Date(start + 'T00:00:00Z')
      var last = new Date((end || start) + 'T00:00:00Z')
      while (cursor <= last) {
        timeoffDays.push(cursor.toISOString().split('T')[0])
        cursor = new Date(cursor.getTime() + 86400000)
      }
    })

    const monthlyLimit = contract.getInt('monthly_hour_limit') || 180

    const existingUserShifts = $app.findRecordsByFilter(
      'shifts',
      "staff_profile='" + profileId + "' && cycle='" + cycleId + "'",
      '',
      10000,
      0,
    )
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
      if (s.getString('staff_profile') === profileId) return
      var d = s.getString('start_time').split(' ')[0]
      if (staffingCount[d] !== undefined) staffingCount[d]++
    })

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
        let st = startTimeStr
        if (st.length === 5) st += ':00'

        const shiftStart = new Date(dateStr + 'T' + st + '.000Z')
        const shiftEnd = new Date(shiftStart.getTime() + workHours * 3600000)

        createdShifts.push({
          start_time: shiftStart.toISOString().replace('T', ' ').substring(0, 23) + 'Z',
          end_time: shiftEnd.toISOString().replace('T', ' ').substring(0, 23) + 'Z',
        })
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
