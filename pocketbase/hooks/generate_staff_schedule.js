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

    const cycle = $app.findRecordById('shift_cycles', cycleId)
    const user = $app.findRecordById('users', userId)
    const targetSector = sectorId || user.getString('default_sector')

    if (!targetSector) {
      return e.badRequestError('No sector selected and user has no default sector')
    }

    // Find contract
    let contract
    try {
      contract = $app.findFirstRecordByFilter('staff_contracts', `user='${userId}'`)
    } catch (_) {
      return e.badRequestError('User has no contract')
    }

    const shiftTypeId = contract.getString('shift_type')
    let shiftType
    try {
      if (shiftTypeId) {
        shiftType = $app.findRecordById('shift_types', shiftTypeId)
      }
    } catch (_) {}

    const workHours = shiftType ? shiftType.getInt('work_hours') || 12 : 12
    const restHours = shiftType ? shiftType.getInt('rest_hours') || 36 : 36
    let startTimeStr = shiftType ? shiftType.getString('start_time') : '07:00'
    if (!startTimeStr) startTimeStr = '07:00'

    // Date parsing
    const startDateRaw = cycle.getString('start_date').split(' ')[0]
    const endDateRaw = cycle.getString('end_date').split(' ')[0]

    // Time-offs
    const timeoffs = $app.findRecordsByFilter(
      'timeoff_requests',
      `user='${userId}' && cycle='${cycleId}' && status='fulfilled'`,
      '',
      1000,
      0,
    )
    const timeoffDays = timeoffs.map((t) => t.getString('date').split(' ')[0])

    // Delete existing shifts for this user in this cycle
    const existingShifts = $app.findRecordsByFilter(
      'shifts',
      `user='${userId}' && cycle='${cycleId}'`,
      '',
      10000,
      0,
    )
    existingShifts.forEach((s) => $app.delete(s))

    const shiftsCol = $app.findCollectionByNameOrId('shifts')
    const createdShifts = []

    let current = new Date(startDateRaw + 'T00:00:00Z')
    const endObj = new Date(endDateRaw + 'T23:59:59Z')

    while (current <= endObj) {
      const dateStr = current.toISOString().split('T')[0]

      if (!timeoffDays.includes(dateStr)) {
        const record = new Record(shiftsCol)
        record.set('user', userId)
        record.set('sector', targetSector)
        record.set('cycle', cycleId)

        let st = startTimeStr
        if (st.length === 5) st += ':00'

        const shiftStart = new Date(`${dateStr}T${st}.000Z`)
        const shiftEnd = new Date(shiftStart.getTime() + workHours * 3600000)

        record.set('start_time', shiftStart.toISOString().replace('T', ' ').substring(0, 23) + 'Z')
        record.set('end_time', shiftEnd.toISOString().replace('T', ' ').substring(0, 23) + 'Z')

        $app.save(record)
        createdShifts.push(record)
      }

      const step = workHours + restHours
      if (step <= 0) break

      current = new Date(current.getTime() + step * 3600000)
    }

    return e.json(200, { success: true, count: createdShifts.length })
  },
  $apis.requireAuth(),
)
