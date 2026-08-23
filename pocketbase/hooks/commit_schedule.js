routerAdd(
  'POST',
  '/backend/v1/escala/commit',
  (e) => {
    if (!e.auth || e.auth.getString('role') !== 'Admin') {
      return e.forbiddenError('Apenas administradores podem salvar escalas.')
    }

    const body = e.requestInfo().body || {}
    const cycleId = body.cycle_id
    const sectorId = body.sector_id
    const shifts = Array.isArray(body.shifts) ? body.shifts : []
    const publish = body.publish === true

    if (!cycleId || !sectorId) {
      return e.badRequestError('Ciclo e setor são obrigatórios.')
    }
    if (shifts.length === 0) {
      return e.badRequestError('A escala não possui plantões para salvar.')
    }

    var cycle
    var sector
    try {
      cycle = $app.findRecordById('shift_cycles', cycleId)
      sector = $app.findRecordById('hospital_sectors', sectorId)
    } catch (_) {
      return e.badRequestError('Ciclo ou setor inválido.')
    }

    var cycleStart = (cycle.getString('start_date') || '').split(' ')[0]
    var cycleEnd = (cycle.getString('end_date') || '').split(' ')[0]
    if (!cycleStart || !cycleEnd || cycleStart > cycleEnd) {
      return e.badRequestError('O ciclo possui datas inválidas.')
    }
    if (cycle.getString('status') === 'closed') {
      return e.badRequestError('Não é permitido alterar uma escala de ciclo encerrado.')
    }

    var profiles = $app.findRecordsByFilter(
      'staff_profiles',
      'default_sector={:sector}',
      'name',
      10000,
      0,
      { sector: sectorId },
    )
    var profileMap = {}
    profiles.forEach(function (profile) {
      if (profile.get('active') === false) return
      var roleId = profile.getString('staff_role')
      var roleRank = 0
      var requiresSupervision = true
      if (roleId) {
        try {
          var role = $app.findRecordById('staff_roles', roleId)
          roleRank = role.getInt('hierarchy_rank') || 0
          requiresSupervision = role.getBool('requires_supervision')
        } catch (_) {}
      }
      profileMap[profile.id] = {
        name: profile.getString('name') || profile.id,
        role_id: roleId,
        rank: roleRank,
        requires_supervision: requiresSupervision,
      }
    })

    var contractRecords = $app.findRecordsByFilter('staff_contracts', '', '-updated', 10000, 0)
    var contractMap = {}
    var duplicateContracts = {}
    contractRecords.forEach(function (contract) {
      var profileId = contract.getString('staff_profile')
      if (!profileId) return
      if (contractMap[profileId]) duplicateContracts[profileId] = true
      else contractMap[profileId] = contract
    })

    var timeoffRecords = $app.findRecordsByFilter(
      'timeoff_requests',
      "cycle={:cycle} && (status='pending' || status='fulfilled')",
      'date',
      10000,
      0,
      { cycle: cycleId },
    )
    var timeoffMap = {}
    timeoffRecords.forEach(function (request) {
      var profileId = request.getString('staff_profile')
      if (!profileId) return
      if (!timeoffMap[profileId]) timeoffMap[profileId] = []
      var start = (request.getString('date') || '').split(' ')[0]
      var end = (request.getString('end_date') || request.getString('date') || '').split(' ')[0]
      if (start) timeoffMap[profileId].push({ start: start, end: end || start })
    })

    var violations = []
    var warnings = []
    var normalized = []
    var userHours = {}
    var userShifts = {}
    var dayAssignments = {}

    shifts.forEach(function (shift, index) {
      var profileId = shift.staff_profile || shift.user_id
      var shiftSector = shift.sector || sectorId
      var shiftCycle = shift.cycle || cycleId
      var startRaw = shift.start_time || ''
      var endRaw = shift.end_time || ''

      if (!profileId || !startRaw || !endRaw) {
        violations.push('Plantão ' + (index + 1) + ': dados obrigatórios ausentes.')
        return
      }
      if (shiftSector !== sectorId || shiftCycle !== cycleId) {
        violations.push('Plantão ' + (index + 1) + ': setor ou ciclo divergente.')
        return
      }

      var profile = profileMap[profileId]
      if (!profile) {
        violations.push('Colaborador ' + profileId + ' não está ativo ou não pertence ao setor.')
        return
      }
      if (!profile.role_id) {
        violations.push(profile.name + ' não possui cargo/função.')
        return
      }
      if (duplicateContracts[profileId]) {
        violations.push(profile.name + ' possui mais de um contrato ativo.')
        return
      }

      var contract = contractMap[profileId]
      if (
        !contract ||
        !contract.getString('contract_type') ||
        !contract.getString('shift_type') ||
        contract.getInt('monthly_hour_limit') <= 0
      ) {
        violations.push(profile.name + ' não possui contrato completo.')
        return
      }

      var startDate = new Date(startRaw.replace(' ', 'T'))
      var endDate = new Date(endRaw.replace(' ', 'T'))
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
        violations.push('Plantão de ' + profile.name + ' possui horário inválido.')
        return
      }

      var day = startDate.toISOString().split('T')[0]
      if (day < cycleStart || day > cycleEnd) {
        violations.push('Plantão de ' + profile.name + ' em ' + day + ' está fora do ciclo.')
      }

      var requests = timeoffMap[profileId] || []
      requests.forEach(function (request) {
        if (day >= request.start && day <= request.end) {
          violations.push(
            'Folga não respeitada: ' +
              profile.name +
              ' está alocado em ' +
              day +
              ' (período ' +
              request.start +
              ' a ' +
              request.end +
              ').',
          )
        }
      })

      var duration = (endDate.getTime() - startDate.getTime()) / 3600000
      userHours[profileId] = (userHours[profileId] || 0) + duration
      if (!userShifts[profileId]) userShifts[profileId] = []
      userShifts[profileId].push({ start: startDate, end: endDate, name: profile.name })

      if (!dayAssignments[day]) dayAssignments[day] = []
      dayAssignments[day].push({
        profile_id: profileId,
        name: profile.name,
        rank: profile.rank,
        requires_supervision: profile.requires_supervision,
      })

      normalized.push({
        staff_profile: profileId,
        sector: sectorId,
        cycle: cycleId,
        start_time: startDate.toISOString().replace('T', ' ').substring(0, 23) + 'Z',
        end_time: endDate.toISOString().replace('T', ' ').substring(0, 23) + 'Z',
      })
    })

    Object.keys(userHours).forEach(function (profileId) {
      var contract = contractMap[profileId]
      if (!contract) return
      var limit = contract.getInt('monthly_hour_limit') || 0
      if (userHours[profileId] > limit) {
        violations.push(
          profileMap[profileId].name +
            ' excede a carga horária: ' +
            Math.round(userHours[profileId] * 10) / 10 +
            'h de ' +
            limit +
            'h.',
        )
      }

      var restHours = 0
      try {
        var shiftType = $app.findRecordById('shift_types', contract.getString('shift_type'))
        restHours = shiftType.getInt('rest_hours') || 0
      } catch (_) {}
      var ordered = userShifts[profileId].sort(function (a, b) {
        return a.start.getTime() - b.start.getTime()
      })
      for (var i = 1; i < ordered.length; i++) {
        var gap = (ordered[i].start.getTime() - ordered[i - 1].end.getTime()) / 3600000
        if (gap < 0) {
          violations.push(profileMap[profileId].name + ' possui plantões sobrepostos.')
        } else if (gap < restHours) {
          violations.push(
            profileMap[profileId].name +
              ' possui apenas ' +
              Math.round(gap * 10) / 10 +
              'h de descanso; mínimo de ' +
              restHours +
              'h.',
          )
        }
      }
    })

    var minStaffing = sector.getInt('min_staffing') || 0
    var idealStaffing = sector.getInt('ideal_staffing') || minStaffing
    var bedCapacity = sector.getInt('bed_capacity') || 0
    var staffingRatio = sector.getInt('staffing_ratio') || 0
    var requiredStaffing = minStaffing
    if (!sector.getBool('is_critical') && bedCapacity > 0 && staffingRatio > 0) {
      requiredStaffing = Math.max(requiredStaffing, Math.ceil(bedCapacity / staffingRatio), 2)
    }

    var cursor = new Date(cycleStart + 'T00:00:00Z')
    var cycleEndDate = new Date(cycleEnd + 'T00:00:00Z')
    while (cursor <= cycleEndDate) {
      var dateKey = cursor.toISOString().split('T')[0]
      var assignments = dayAssignments[dateKey] || []
      if (assignments.length < requiredStaffing) {
        violations.push(
          'Efetivo insuficiente em ' +
            dateKey +
            ': ' +
            assignments.length +
            ' de ' +
            requiredStaffing +
            ' profissionais obrigatórios.',
        )
      } else if (assignments.length < idealStaffing) {
        warnings.push(
          'Efetivo abaixo do ideal em ' +
            dateKey +
            ': ' +
            assignments.length +
            ' de ' +
            idealStaffing +
            '.',
        )
      }

      assignments.forEach(function (assignment) {
        if (!assignment.requires_supervision) return
        var hasSupervisor = assignments.some(function (candidate) {
          return candidate.profile_id !== assignment.profile_id && candidate.rank > assignment.rank
        })
        if (!hasSupervisor) {
          violations.push(
            'Supervisão ausente em ' +
              dateKey +
              ': ' +
              assignment.name +
              ' necessita de profissional com hierarquia superior.',
          )
        }
      })
      cursor = new Date(cursor.getTime() + 86400000)
    }

    // --- isWeekendOffApplicableMonth helper (shared logic) ---
    var isWeekendOffApplicableMonth = function (rangeStart, rangeEnd, yearMonth) {
      if (!rangeStart || !rangeEnd || !yearMonth) return false
      var rStart = rangeStart.split(' ')[0].split('T')[0]
      var rEnd = rangeEnd.split(' ')[0].split('T')[0]
      if (!rStart || !rEnd || rStart > rEnd) return false

      var parts = yearMonth.split('-')
      var y = Number(parts[0])
      var m = Number(parts[1])
      if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return false

      var dCur = new Date(Date.UTC(y, m - 1, 1))
      var dLast = new Date(Date.UTC(y, m, 0))
      var cStart = new Date(rStart + 'T00:00:00Z')
      var cEnd = new Date(rEnd + 'T00:00:00Z')

      if (dCur < cStart) dCur = new Date(cStart)
      var effectiveEnd = dLast < cEnd ? dLast : cEnd

      var completePairs = 0
      while (dCur <= effectiveEnd) {
        if (dCur.getUTCDay() === 6) {
          var sunDate = new Date(dCur.getTime() + 86400000)
          var satIso = dCur.toISOString().split('T')[0]
          var sunIso = sunDate.toISOString().split('T')[0]
          if (satIso >= rStart && satIso <= rEnd && sunIso >= rStart && sunIso <= rEnd) {
            completePairs++
          }
        }
        dCur = new Date(dCur.getTime() + 86400000)
      }
      return completePairs >= 2
    }

    // --- WEEKEND_OFF validation BEFORE allowing commit/publish (v0.0.251) ---
    var computeNaturalPatternByStaff = function (staffId, staffContracts, cStart, cEnd) {
      var contract = null
      if (Array.isArray(staffContracts)) {
        for (var sci = 0; sci < staffContracts.length; sci++) {
          var item = staffContracts[sci]
          if (item && item.id === staffId) {
            contract = item
            break
          }
        }
      } else if (staffContracts && typeof staffContracts === 'object') {
        contract = staffContracts[staffId] || null
      }
      var workHours = contract ? contract.work_hours || contract.shift_work_hours || 12 : 12
      var restHours = contract ? contract.rest_hours || contract.shift_rest_hours || 36 : 36
      var is12x36 = workHours === 12 && restHours >= 36
      var stepDays = Math.max(2, Math.round((workHours + restHours) / 24))

      var stableIdx = 0
      if (Array.isArray(staffContracts)) {
        var sortedIds = staffContracts
          .map(function (c) {
            return c.id
          })
          .filter(Boolean)
          .sort()
        var pos = sortedIds.indexOf(staffId)
        if (pos !== -1) stableIdx = pos
      } else if (staffContracts && typeof staffContracts === 'object') {
        var keys = Object.keys(staffContracts).sort()
        var kpos = keys.indexOf(staffId)
        if (kpos !== -1) stableIdx = kpos
      }

      var offset = is12x36 ? stableIdx % stepDays : 0
      var map = {}
      var cur = new Date(cStart + 'T00:00:00Z')
      cur = new Date(cur.getTime() + offset * 86400000)
      var end = new Date(cEnd + 'T00:00:00Z')
      while (cur <= end) {
        map[cur.toISOString().split('T')[0]] = true
        cur = new Date(cur.getTime() + stepDays * 86400000)
      }
      return map
    }

    var commitMonths = {}
    var commitMonthCursor = new Date(cycleStart + 'T00:00:00Z')
    var commitMonthEnd = new Date(cycleEnd + 'T00:00:00Z')
    while (commitMonthCursor <= commitMonthEnd) {
      var cMKey =
        commitMonthCursor.getUTCFullYear() +
        '-' +
        String(commitMonthCursor.getUTCMonth() + 1).padStart(2, '0')
      commitMonths[cMKey] = true
      commitMonthCursor = new Date(commitMonthCursor.getTime() + 86400000)
    }

    // 1. Check if there is an existing schedule_draft with validation_summary.weekend_off_assignments
    var draftRecord = null
    var weekendOffAssignments = null
    var bodyDraftId = body.draft_id || body.draft || ''

    if (bodyDraftId) {
      try {
        draftRecord = $app.findRecordById('schedule_drafts', bodyDraftId)
      } catch (_) {}
    }

    if (!draftRecord) {
      // Look for the most recent draft for this cycle and sector
      try {
        var existingDrafts = $app.findRecordsByFilter(
          'schedule_drafts',
          'cycle={:cyc} && sector={:sec}',
          '-created',
          1,
          0,
          { cyc: cycleId, sec: sectorId },
        )
        if (existingDrafts.length > 0) {
          draftRecord = existingDrafts[0]
        }
      } catch (_) {}
    }

    if (draftRecord) {
      try {
        var valSummary = draftRecord.get('validation_summary')
        if (typeof valSummary === 'string') {
          try {
            valSummary = JSON.parse(valSummary)
          } catch (_) {}
        }
        if (
          valSummary &&
          valSummary.weekend_off_assignments &&
          typeof valSummary.weekend_off_assignments === 'object'
        ) {
          if (Object.keys(valSummary.weekend_off_assignments).length > 0) {
            weekendOffAssignments = valSummary.weekend_off_assignments
          }
        }
      } catch (_) {}
    }

    // Build staffContracts list for computeNaturalPatternByStaff
    var staffContractsCommit = []
    var sortedProfileIds = Object.keys(profileMap).slice().sort()
    sortedProfileIds.forEach(function (profileId) {
      var contract = contractMap[profileId]
      var workHours = 12
      var restHours = 36
      if (contract) {
        try {
          var shiftType = $app.findRecordById('shift_types', contract.getString('shift_type'))
          workHours = shiftType.getInt('work_hours') || 12
          restHours = shiftType.getInt('rest_hours') || 36
        } catch (_) {}
      }
      staffContractsCommit.push({
        id: profileId,
        work_hours: workHours,
        rest_hours: restHours,
      })
    })

    sortedProfileIds.forEach(function (profileId) {
      var profile = profileMap[profileId]
      var contract = contractMap[profileId]
      if (!contract) return

      var workHours = 12
      var restHours = 36
      try {
        var shiftType = $app.findRecordById('shift_types', contract.getString('shift_type'))
        workHours = shiftType.getInt('work_hours') || 12
        restHours = shiftType.getInt('rest_hours') || 36
      } catch (_) {}

      var is12x36 = workHours === 12 && restHours >= 36
      var uShifts = normalized
        .filter(function (s) {
          return s.staff_profile === profileId
        })
        .map(function (s) {
          return s.start_time.split(' ')[0]
        })
      var uShiftSet = {}
      uShifts.forEach(function (d) {
        uShiftSet[d] = true
      })

      var staffAssignments = weekendOffAssignments ? weekendOffAssignments[profileId] : null

      // Recalculate natural pattern using deterministic anchor by staff_id
      var naturalDays = is12x36
        ? computeNaturalPatternByStaff(profileId, staffContractsCommit, cycleStart, cycleEnd)
        : null

      if (staffAssignments && Array.isArray(staffAssignments) && staffAssignments.length > 0) {
        // 2. Validate against explicit assignments from draft
        for (var ai = 0; ai < staffAssignments.length; ai += 2) {
          var satD = staffAssignments[ai]
          var sunD = staffAssignments[ai + 1]
          if (uShiftSet[satD] || (sunD && uShiftSet[sunD])) {
            violations.push(
              'Fim de semana obrigatório não atendido: ' +
                profile.name +
                ' possui plantão no fim de semana de folga designado (' +
                satD +
                (sunD ? ' / ' + sunD : '') +
                ').',
            )
          }
        }
      } else {
        // 3. Fallback: verify every month has a valid free weekend satisfying natural rotation
        Object.keys(commitMonths).forEach(function (monthKey) {
          if (!isWeekendOffApplicableMonth(cycleStart, cycleEnd, monthKey)) {
            return
          }

          var parts = monthKey.split('-')
          var y = Number(parts[0])
          var m = Number(parts[1])
          var dCur = new Date(Date.UTC(y, m - 1, 1))
          var dLast = new Date(Date.UTC(y, m, 0))
          var cStart = new Date(cycleStart + 'T00:00:00Z')
          var cEnd = new Date(cycleEnd + 'T00:00:00Z')
          if (dCur < cStart) dCur = new Date(cStart)
          if (dLast > cEnd) dLast = new Date(cEnd)

          var foundValidWeekend = false
          while (dCur <= dLast) {
            if (dCur.getUTCDay() === 6) {
              // Sat
              var satStr = dCur.toISOString().split('T')[0]
              var sunDate = new Date(dCur.getTime() + 86400000)
              var sunStr = sunDate.toISOString().split('T')[0]
              if (sunDate <= cEnd && sunDate >= cStart) {
                var satFree = !uShiftSet[satStr]
                var sunFree = !uShiftSet[sunStr]
                var isNatWorked = is12x36 ? !!(naturalDays && naturalDays[sunStr]) : true
                if (satFree && sunFree && isNatWorked) {
                  foundValidWeekend = true
                  break
                }
              }
            }
            dCur = new Date(dCur.getTime() + 86400000)
          }

          if (!foundValidWeekend) {
            violations.push(
              'Fim de semana obrigatório não atendido: ' +
                profile.name +
                ' não tem sábado+domingo livres em ' +
                monthKey +
                '.',
            )
          }
        })
      }
    })

    violations = violations.filter(function (item, index, all) {
      return all.indexOf(item) === index
    })
    warnings = warnings.filter(function (item, index, all) {
      return all.indexOf(item) === index
    })

    if (violations.length > 0) {
      return e.json(400, {
        error: 'A escala não atende às regras obrigatórias.',
        violations: violations,
        warnings: warnings,
      })
    }

    try {
      $app.runInTransaction((txApp) => {
        var existing = txApp.findRecordsByFilter(
          'shifts',
          'cycle={:cycle} && sector={:sector}',
          '-created',
          10000,
          0,
          { cycle: cycleId, sector: sectorId },
        )
        existing.forEach(function (record) {
          txApp.delete(record)
        })

        var shiftsCollection = txApp.findCollectionByNameOrId('shifts')
        normalized.forEach(function (shift) {
          var record = new Record(shiftsCollection)
          record.set('staff_profile', shift.staff_profile)
          record.set('sector', shift.sector)
          record.set('cycle', shift.cycle)
          record.set('start_time', shift.start_time)
          record.set('end_time', shift.end_time)
          txApp.save(record)
        })

        if (publish && cycle.getString('status') === 'draft') {
          var cycleRecord = txApp.findRecordById('shift_cycles', cycleId)
          cycleRecord.set('status', 'active')
          txApp.save(cycleRecord)
        }
      })
    } catch (err) {
      return e.internalServerError('Falha ao gravar a escala. Nenhum dado anterior foi alterado.')
    }

    try {
      var auditCollection = $app.findCollectionByNameOrId('audit_logs')
      var audit = new Record(auditCollection)
      audit.set('user', e.auth.id)
      audit.set('action', publish ? 'SHIFT_SCHEDULE_PUBLISHED' : 'SHIFT_SCHEDULE_SAVED')
      audit.set(
        'details',
        JSON.stringify({
          cycle_id: cycleId,
          sector_id: sectorId,
          shift_count: normalized.length,
          warnings: warnings,
        }),
      )
      $app.saveNoValidate(audit)
    } catch (_) {}

    return e.json(200, {
      success: true,
      count: normalized.length,
      warnings: warnings,
      published: publish,
    })
  },
  $apis.requireAuth(),
)
