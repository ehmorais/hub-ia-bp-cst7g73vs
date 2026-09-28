// Simplified individual staff schedule generator for HUB IA BP
// Only TWO mandatory generation rules:
// 1. 12x36 alternation for 12x36 staff respecting parity/team ("Equipe 1" = even, "Equipe 2" = odd) and parity-inversion
// 2. Exactly ONE weekend day off (Saturday or Sunday) per month in cycle. If no safe date, register warning and proceed (non-blocking).
// No staffing minimum/ideal blocking, no timeoffs/vacations blocking, no hour limit blocking.

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
        staff_processed: 0,
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
    if (startTimeStr.length === 5) startTimeStr += ':00'

    const startDateRaw = cycle.getString('start_date').split(' ')[0]
    const endDateRaw = cycle.getString('end_date').split(' ')[0]

    // Pure date-only and parity helpers
    var parseDateOnly = function (s) {
      var clean = (s || '').split('T')[0].split(' ')[0]
      var parts = clean.split('-')
      return { y: +parts[0], m: +parts[1], d: +parts[2] }
    }

    var formatDateOnly = function (y, m, d) {
      var utc = new Date(Date.UTC(y, m - 1, d))
      var fY = utc.getUTCFullYear()
      var fM = utc.getUTCMonth() + 1
      var fD = utc.getUTCDate()
      return fY + '-' + (fM < 10 ? '0' + fM : '' + fM) + '-' + (fD < 10 ? '0' + fD : '' + fD)
    }

    var addDaysDateOnly = function (dateStr, days) {
      var parsed = parseDateOnly(dateStr)
      var utc = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d + days))
      return formatDateOnly(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate())
    }

    var dayOfWeekDateOnly = function (dateStr) {
      var parsed = parseDateOnly(dateStr)
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).getUTCDay()
    }

    var ANCHOR_YEAR = 2026
    var ANCHOR_MONTH = 10

    var getDaysInMonth = function (y, m) {
      return new Date(Date.UTC(y, m, 0)).getUTCDate()
    }

    var resolveTeamWorkingParity = function (base, year, month) {
      if (!base || (base !== 'even' && base !== 'odd')) return base
      var targetTotalMonths = year * 12 + (month - 1)
      var anchorTotalMonths = ANCHOR_YEAR * 12 + (ANCHOR_MONTH - 1)
      if (targetTotalMonths === anchorTotalMonths) return base

      var count31 = 0
      if (targetTotalMonths > anchorTotalMonths) {
        for (var mi = anchorTotalMonths; mi < targetTotalMonths; mi++) {
          var cy = Math.floor(mi / 12)
          var cm = (mi % 12) + 1
          if (getDaysInMonth(cy, cm) === 31) count31++
        }
      } else {
        for (var mj = targetTotalMonths; mj < anchorTotalMonths; mj++) {
          var cby = Math.floor(mj / 12)
          var cbm = (mj % 12) + 1
          if (getDaysInMonth(cby, cbm) === 31) count31++
        }
      }
      var shouldInvert = count31 % 2 !== 0
      if (!shouldInvert) return base
      return base === 'even' ? 'odd' : 'even'
    }

    var isStaffEligibleForCivilDate = function (dateStr, parity) {
      if (!parity || (parity !== 'even' && parity !== 'odd')) return true
      if (!dateStr || typeof dateStr !== 'string') return true
      var clean = dateStr.split('T')[0].split(' ')[0]
      var parts = clean.split('-')
      if (parts.length < 3) return true
      var y = parseInt(parts[0], 10)
      var m = parseInt(parts[1], 10)
      var d = parseInt(parts[2], 10)
      if (isNaN(y) || isNaN(m) || isNaN(d)) return true

      var activeParity = resolveTeamWorkingParity(parity, y, m)
      var dayParity = d % 2 === 0 ? 'even' : 'odd'
      return activeParity === dayParity
    }

    var getMonthsInCycle = function (startStr, endStr) {
      var s = parseDateOnly(startStr)
      var e = parseDateOnly(endStr)
      var months = []
      var curY = s.y
      var curM = s.m
      while (curY < e.y || (curY === e.y && curM <= e.m)) {
        var key = curY + '-' + (curM < 10 ? '0' + curM : '' + curM)
        months.push({ key: key, year: curY, month: curM })
        curM++
        if (curM > 12) {
          curM = 1
          curY++
        }
      }
      return months
    }

    var cycleMonths = getMonthsInCycle(startDateRaw, endDateRaw)

    // Rule 1: 12x36 sequence across the cycle
    var parity = user.getString('shift_parity') || ''
    var cycleStartDate = (user.getString('cycle_start_date') || '').split(' ')[0].split('T')[0]
    var is12x36 = workHours === 12 && restHours >= 36

    var shiftDays = []
    if (is12x36 && (parity === 'even' || parity === 'odd')) {
      var curD = startDateRaw
      while (curD <= endDateRaw) {
        if (isStaffEligibleForCivilDate(curD, parity)) {
          shiftDays.push(curD)
        }
        curD = addDaysDateOnly(curD, 1)
      }
    } else {
      var stepDays = Math.max(2, Math.round((workHours + restHours) / 24))
      var offset = 0
      if (cycleStartDate && cycleStartDate >= startDateRaw && cycleStartDate <= endDateRaw) {
        var pA = parseDateOnly(cycleStartDate)
        var pS = parseDateOnly(startDateRaw)
        var diff = Math.round(
          (Date.UTC(pA.y, pA.m - 1, pA.d) - Date.UTC(pS.y, pS.m - 1, pS.d)) / 86400000,
        )
        offset = ((diff % stepDays) + stepDays) % stepDays
      }
      var cD = addDaysDateOnly(startDateRaw, offset)
      while (cD <= endDateRaw) {
        shiftDays.push(cD)
        cD = addDaysDateOnly(cD, stepDays)
      }
    }

    // Rule 2: exactly ONE weekend day off (Saturday or Sunday) per month in cycle
    var shiftDaysSet = {}
    shiftDays.forEach(function (d) {
      shiftDaysSet[d] = true
    })

    var assignedWeekendOffs = []
    var warnings = []

    cycleMonths.forEach(function (mInfo) {
      var monthPrefix = mInfo.key
      var candidates = []
      shiftDays.forEach(function (d) {
        if (d.startsWith(monthPrefix)) {
          var dow = dayOfWeekDateOnly(d)
          if (dow === 6 || dow === 0) {
            candidates.push(d)
          }
        }
      })

      if (candidates.length > 0) {
        var chosen = candidates[0]
        assignedWeekendOffs.push(chosen)
        delete shiftDaysSet[chosen]
      } else {
        warnings.push(
          'Sem plantão de fim de semana na paridade no mês ' + mInfo.key + ' para folga.',
        )
      }
    })

    var finalDates = Object.keys(shiftDaysSet).sort()
    var createdShifts = []

    finalDates.forEach(function (dateStr) {
      const shiftStart = new Date(dateStr + 'T' + startTimeStr + '.000Z')
      const shiftEnd = new Date(shiftStart.getTime() + workHours * 3600000)
      createdShifts.push({
        start_time: shiftStart.toISOString().replace('T', ' ').substring(0, 23) + 'Z',
        end_time: shiftEnd.toISOString().replace('T', ' ').substring(0, 23) + 'Z',
      })
    })

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
      status: 'success',
      target_user: profileId,
      cycle_id: cycleId,
      sector_id: targetSector,
      shifts_created: createdShifts.length,
      total_hours: createdShifts.length * workHours,
      staff_processed: 1,
    })

    return e.json(200, {
      success: true,
      count: createdShifts.length,
      weekend_off_assignments: assignedWeekendOffs,
      warnings: warnings.length > 0 ? warnings : undefined,
    })
  },
  $apis.requireAuth(),
)
