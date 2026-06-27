routerAdd(
  'POST',
  '/backend/v1/generate-staff-schedule',
  (e) => {
    const body = e.requestInfo().body || {}
    const userId = body.user_id
    const cycleId = body.cycle_id
    const sectorId = body.sector_id

    if (!userId || !cycleId) {
      return e.badRequestError('user_id and cycle_id are required')
    }

    var auditCol = $app.findCollectionByNameOrId('audit_logs')
    var audit = new Record(auditCol)
    audit.set('user', e.auth ? e.auth.id : '')
    audit.set('action', 'AI_STAFF_SCHEDULE_GENERATION')
    audit.set(
      'details',
      JSON.stringify({
        status: 'started',
        target_user: userId,
        cycle_id: cycleId,
        sector_id: sectorId,
      }),
    )
    $app.saveNoValidate(audit)

    const cycle = $app.findRecordById('shift_cycles', cycleId)
    const user = $app.findRecordById('users', userId)
    const targetSector = sectorId || user.getString('default_sector')

    if (!targetSector) {
      return e.badRequestError('No sector selected and user has no default sector')
    }

    let contract
    try {
      contract = $app.findFirstRecordByFilter('staff_contracts', "user='" + userId + "'")
    } catch (_) {
      return e.badRequestError('User has no contract')
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
      "user='" + userId + "' && cycle='" + cycleId + "' && status='fulfilled'",
      '',
      1000,
      0,
    )
    const timeoffDays = timeoffs.map(function (t) {
      return t.getString('date').split(' ')[0]
    })

    const monthlyLimit = contract.getInt('monthly_hour_limit') || 180

    // Also check pending timeoffs
    const pendingTimeoffs = $app.findRecordsByFilter(
      'timeoff_requests',
      "user='" + userId + "' && cycle='" + cycleId + "' && status='pending'",
      '',
      1000,
      0,
    )
    pendingTimeoffs.forEach(function (t) {
      timeoffDays.push(t.getString('date').split(' ')[0])
    })

    const existingUserShifts = $app.findRecordsByFilter(
      'shifts',
      "user='" + userId + "' && cycle='" + cycleId + "'",
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
        record.set('user', userId)
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

    var successAudit = new Record(auditCol)
    successAudit.set('user', e.auth ? e.auth.id : '')
    successAudit.set('action', 'AI_STAFF_SCHEDULE_GENERATION')
    successAudit.set(
      'details',
      JSON.stringify({
        status: 'success',
        target_user: userId,
        cycle_id: cycleId,
        sector_id: targetSector,
        shifts_created: createdShifts.length,
        total_hours: totalHours,
        skipped_timeoff_days: skippedTimeoff,
      }),
    )
    $app.saveNoValidate(successAudit)

    return e.json(200, { success: true, count: createdShifts.length })
  },
  $apis.requireAuth(),
)
