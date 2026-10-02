// Simplified multi-sector schedule generator for HUB IA BP
// 1. 12x36 alternation respecting civil parity and parity-inversion.
// 2. One Saturday OR Sunday off per collaborator per cycle, allocated by date without reducing coverage below the sector minimum (at least one).
// If no safe weekend date exists, keep the shift and return a warning.

routerAdd(
  'POST',
  '/backend/v1/escala/generate',
  (e) => {
    if (!e.auth || e.auth.getString('role') !== 'Admin') {
      return e.forbiddenError('Apenas administradores podem gerar escalas.')
    }

    const body = e.requestInfo().body || {}
    const cycleId = body.cycle_id
    const sectorIds = body.sector_ids || []

    if (!cycleId) {
      return e.badRequestError('O ID do ciclo (cycle_id) é obrigatório para a geração.')
    }
    if (!sectorIds || !sectorIds.length) {
      return e.badRequestError('Pelo menos um setor deve ser selecionado (sector_ids).')
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

    logAudit('AI_SHIFT_GENERATION', {
      status: 'started',
      cycle_id: cycleId,
      sector_ids: sectorIds,
    })

    var cycle
    try {
      cycle = $app.findRecordById('shift_cycles', cycleId)
    } catch (_) {
      return e.badRequestError('Ciclo não encontrado.')
    }

    var cycleStart = (cycle.getString('start_date') || '').split(' ')[0]
    var cycleEnd = (cycle.getString('end_date') || '').split(' ')[0]
    if (!cycleStart || !cycleEnd || cycleStart > cycleEnd) {
      return e.badRequestError('O ciclo possui datas inválidas.')
    }
    if (cycle.getString('status') === 'closed') {
      return e.badRequestError('Não é permitido gerar escala para um ciclo encerrado.')
    }

    var sectorFilters = sectorIds
      .map(function (id) {
        return "id='" + id + "'"
      })
      .join(' || ')
    var sectors = $app.findRecordsByFilter('hospital_sectors', sectorFilters, '-created', 100, 0)

    var contracts = $app.findRecordsByFilter('staff_contracts', '', '-created', 1000, 0)
    var shiftTypes = $app.findRecordsByFilter('shift_types', '', '-created', 1000, 0)
    var shiftTypeMap = {}
    shiftTypes.forEach(function (st) {
      var wHours = st.getInt('work_hours') || 12
      var rHours = st.getInt('rest_hours') || 36
      var sStart = st.getString('start_time') || '07:00'
      var sEnd = st.getString('end_time') || '19:00'
      shiftTypeMap[st.id] = {
        work_hours: wHours,
        rest_hours: rHours,
        start_time: sStart,
        end_time: sEnd,
      }
    })

    var usersWithContracts = []
    contracts.forEach(function (c) {
      try {
        var profileId = c.getString('staff_profile')
        if (!profileId) return
        var u = $app.findRecordById('staff_profiles', profileId)
        if (u.get('active') === false) return
        if (sectorIds.indexOf(u.getString('default_sector')) === -1) return

        var sType = shiftTypeMap[c.getString('shift_type')]
        var sHours = sType ? sType.work_hours : 12
        var sRest = sType ? sType.rest_hours : 36
        var sStart = sType ? sType.start_time : '07:00'
        var sEnd = sType ? sType.end_time : '19:00'

        usersWithContracts.push({
          id: u.id,
          name: u.getString('name'),
          sector_id: u.getString('default_sector'),
          work_hours: sHours,
          rest_hours: sRest,
          shift_start_time: sStart,
          shift_end_time: sEnd,
          shift_parity: u.getString('shift_parity') || '',
          cycle_start_date: (u.getString('cycle_start_date') || '').split(' ')[0].split('T')[0],
        })
      } catch (_) {}
    })

    if (usersWithContracts.length === 0) {
      return e.badRequestError(
        'Nenhum colaborador elegível encontrado para os setores selecionados.',
      )
    }

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

    var cycleMonths = getMonthsInCycle(cycleStart, cycleEnd)

    // Compute natural working days for 12x36
    var computeStaffNaturalDays = function (u) {
      var is12x36 = u.work_hours === 12 && u.rest_hours >= 36
      var days = []
      var uParity = u.shift_parity || ''

      if (is12x36 && (uParity === 'even' || uParity === 'odd')) {
        var curDate = cycleStart
        while (curDate <= cycleEnd) {
          if (isStaffEligibleForCivilDate(curDate, uParity)) {
            days.push(curDate)
          }
          curDate = addDaysDateOnly(curDate, 1)
        }
        return days
      }

      var stepDays = Math.max(2, Math.round((u.work_hours + u.rest_hours) / 24))
      var offset = 0
      var anchorDate = u.cycle_start_date ? u.cycle_start_date.split(' ')[0] : ''
      if (anchorDate && anchorDate >= cycleStart && anchorDate <= cycleEnd) {
        var pA = parseDateOnly(anchorDate)
        var pS = parseDateOnly(cycleStart)
        var diff = Math.round(
          (Date.UTC(pA.y, pA.m - 1, pA.d) - Date.UTC(pS.y, pS.m - 1, pS.d)) / 86400000,
        )
        offset = ((diff % stepDays) + stepDays) % stepDays
      } else {
        var sortedIds = usersWithContracts
          .map(function (c) {
            return c.id
          })
          .sort()
        var pos = sortedIds.indexOf(u.id)
        offset = (pos === -1 ? 0 : pos) % stepDays
      }

      var cur = addDaysDateOnly(cycleStart, offset)
      while (cur <= cycleEnd) {
        days.push(cur)
        cur = addDaysDateOnly(cur, stepDays)
      }
      return days
    }

    var requiredWeekendCoverageBySector = {}
    var sectorById = {}
    sectors.forEach(function (sector) {
      var required = Math.max(1, sector.getInt('min_staffing') || 0)
      var beds = sector.getInt('bed_capacity') || 0
      var ratio = sector.getInt('staffing_ratio') || 0
      if (!sector.getBool('is_critical') && beds > 0 && ratio > 0) {
        required = Math.max(required, Math.ceil(beds / ratio), 2)
      }
      requiredWeekendCoverageBySector[sector.id] = required
      sectorById[sector.id] = sector
    })

    var initialShiftsByStaff = {}
    var weekendCandidatesByStaff = {}
    var naturalWeekendCoverage = {}
    usersWithContracts.forEach(function (u) {
      var staffDays = computeStaffNaturalDays(u)
      initialShiftsByStaff[u.id] = staffDays
      var candidates = []
      staffDays.forEach(function (date) {
        var dow = dayOfWeekDateOnly(date)
        if (dow === 6 || dow === 0) {
          candidates.push(date)
          var coverageKey = u.sector_id + '|' + date
          naturalWeekendCoverage[coverageKey] = (naturalWeekendCoverage[coverageKey] || 0) + 1
        }
      })
      weekendCandidatesByStaff[u.id] = candidates
    })

    var weekendOffAssignments = {}
    var weekendOffBlockedBySector = {}
    var assignedWeekendOffByDate = {}
    var warnings = []
    var warningsBySector = {}
    var allocationOrder = usersWithContracts.slice().sort(function (a, b) {
      return (
        (weekendCandidatesByStaff[a.id] || []).length -
          (weekendCandidatesByStaff[b.id] || []).length ||
        a.sector_id.localeCompare(b.sector_id) ||
        a.id.localeCompare(b.id)
      )
    })

    allocationOrder.forEach(function (u, staffIndex) {
      var candidates = weekendCandidatesByStaff[u.id] || []
      var requiredWeekendCoverage = requiredWeekendCoverageBySector[u.sector_id] || 1
      var safeCandidates = candidates.filter(function (date) {
        var coverageKey = u.sector_id + '|' + date
        return (
          (naturalWeekendCoverage[coverageKey] || 0) -
            (assignedWeekendOffByDate[coverageKey] || 0) -
            1 >=
          requiredWeekendCoverage
        )
      })
      safeCandidates.sort(function (a, b) {
        var keyA = u.sector_id + '|' + a
        var keyB = u.sector_id + '|' + b
        var capA = Math.max(0, (naturalWeekendCoverage[keyA] || 0) - requiredWeekendCoverage)
        var capB = Math.max(0, (naturalWeekendCoverage[keyB] || 0) - requiredWeekendCoverage)
        var loadA = capA > 0 ? ((assignedWeekendOffByDate[keyA] || 0) + 1) / capA : 1
        var loadB = capB > 0 ? ((assignedWeekendOffByDate[keyB] || 0) + 1) / capB : 1
        if (loadA !== loadB) return loadA - loadB
        if ((assignedWeekendOffByDate[keyA] || 0) !== (assignedWeekendOffByDate[keyB] || 0)) {
          return (assignedWeekendOffByDate[keyA] || 0) - (assignedWeekendOffByDate[keyB] || 0)
        }
        var originalCandidates = weekendCandidatesByStaff[u.id] || []
        var rotation = originalCandidates.length > 0 ? staffIndex % originalCandidates.length : 0
        var indexA = (originalCandidates.indexOf(a) - rotation + originalCandidates.length) % originalCandidates.length
        var indexB = (originalCandidates.indexOf(b) - rotation + originalCandidates.length) % originalCandidates.length
        return indexA - indexB
      })

      var staffDaysSet = {}
      ;(initialShiftsByStaff[u.id] || []).forEach(function (date) {
        staffDaysSet[date] = true
      })
      if (safeCandidates.length === 0) {
        weekendOffAssignments[u.id] = []
        if (!weekendOffBlockedBySector[u.sector_id]) weekendOffBlockedBySector[u.sector_id] = []
        weekendOffBlockedBySector[u.sector_id].push(u.id)
        var warning =
          'Folga de fim de semana não alocada para ' +
          u.name +
          ': nenhuma data segura preserva o efetivo mínimo (' +
          requiredWeekendCoverage +
          '). Plantões mantidos.'
        warnings.push(warning)
        if (!warningsBySector[u.sector_id]) warningsBySector[u.sector_id] = []
        warningsBySector[u.sector_id].push(warning)
      } else {
        var chosenWeekendOff = safeCandidates[0]
        var chosenKey = u.sector_id + '|' + chosenWeekendOff
        weekendOffAssignments[u.id] = [chosenWeekendOff]
        assignedWeekendOffByDate[chosenKey] = (assignedWeekendOffByDate[chosenKey] || 0) + 1
        delete staffDaysSet[chosenWeekendOff]
      }
      initialShiftsByStaff[u.id] = Object.keys(staffDaysSet).sort()
    })

    var generatedShifts = []
    usersWithContracts.forEach(function (u) {
      var days = initialShiftsByStaff[u.id] || []
      var startTime = u.shift_start_time || '07:00'
      if (startTime.length === 5) startTime += ':00'

      days.forEach(function (date) {
        var start = new Date(date + 'T' + startTime + '.000Z')
        var end = new Date(start.getTime() + u.work_hours * 3600000)
        generatedShifts.push({
          user_id: u.id,
          sector_id: u.sector_id,
          start_time: start.toISOString().replace('T', ' ').substring(0, 23) + 'Z',
          end_time: end.toISOString().replace('T', ' ').substring(0, 23) + 'Z',
        })
      })
    })

    var validSectorIds = sectors.map(function (s) {
      return s.id
    })
    var savedCount = 0
    var createdDraftIds = {}

    try {
      $app.runInTransaction((txApp) => {
        var existingShifts = txApp.findRecordsByFilter(
          'shifts',
          'cycle = {:cyc}',
          '-created',
          10000,
          0,
          { cyc: cycleId },
        )
        existingShifts.forEach(function (shiftRecord) {
          if (validSectorIds.indexOf(shiftRecord.getString('sector')) !== -1) {
            txApp.delete(shiftRecord)
          }
        })

        var draftsCol = txApp.findCollectionByNameOrId('schedule_drafts')
        validSectorIds.forEach(function (sId) {
          var draftRec = new Record(draftsCol)
          draftRec.set('cycle', cycleId)
          draftRec.set('sector', sId)
          draftRec.set('status', 'draft')
          draftRec.set('version', 1)
          draftRec.set('generation_source', 'deterministic')
          draftRec.set('generated_by', e.auth ? e.auth.id : '')
          draftRec.set('created_by', e.auth ? e.auth.id : '')
          var sectorWeekendOffAssignments = {}
          usersWithContracts.forEach(function (u) {
            if (u.sector_id === sId && weekendOffAssignments[u.id]) {
              sectorWeekendOffAssignments[u.id] = weekendOffAssignments[u.id]
            }
          })
          var sectorWarnings = warningsBySector[sId] || []
          draftRec.set('validation_summary', {
            violations_count: 0,
            warnings_count: sectorWarnings.length,
            hard_violations: [],
            warnings: sectorWarnings.slice(0, 20),
            weekend_off_assignments: sectorWeekendOffAssignments,
            weekend_off_blocked_staff: weekendOffBlockedBySector[sId] || [],
            weekend_off_coverage_minimum: requiredWeekendCoverageBySector[sId] || 1,
            additional_off_assignments: {},
            cycle_start: cycleStart,
            cycle_end: cycleEnd,
          })
          txApp.save(draftRec)
          createdDraftIds[sId] = draftRec.id
        })

        var shiftsCol = txApp.findCollectionByNameOrId('shifts')
        for (var gi = 0; gi < generatedShifts.length; gi++) {
          var generated = generatedShifts[gi]
          var record = new Record(shiftsCol)
          record.set('staff_profile', generated.user_id)
          record.set('sector', generated.sector_id)
          record.set('cycle', cycleId)
          record.set('start_time', generated.start_time)
          record.set('end_time', generated.end_time)
          if (createdDraftIds[generated.sector_id]) {
            record.set('draft', createdDraftIds[generated.sector_id])
          }
          txApp.save(record)
          savedCount++
        }
      })

      logAudit(
        'AI_SHIFT_GENERATION',
        {
          status: 'success',
          cycle_id: cycleId,
          sector_ids: sectorIds,
          shifts_created: savedCount,
        },
        0,
      )

      return e.json(200, {
        success: true,
        count: savedCount,
        warnings: warnings,
      })
    } catch (err) {
      var errorMessage = err.message || 'Falha durante a persistência da escala.'
      logAudit('AI_SHIFT_GENERATION', {
        status: 'error',
        cycle_id: cycleId,
        error: errorMessage,
      })
      return e.json(400, { error: errorMessage })
    }
  },
  $apis.requireAuth(),
)
