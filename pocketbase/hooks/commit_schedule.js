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

    // --- Pure date-only helpers (immune to timezone differences in goja/JS) ---
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

    var assertWeekendPair = function (saturday, sunday) {
      if (!saturday || !sunday) return false
      if (dayOfWeekDateOnly(saturday) !== 6) return false
      if (dayOfWeekDateOnly(sunday) !== 0) return false
      if (addDaysDateOnly(saturday, 1) !== sunday) return false
      return true
    }

    // --- FOLGAS DO CICLO: 1 Fim de Semana (Sáb OU Dom na paridade) + 1 Dia de Semana (Seg-Sex na paridade) ---
    var draftRecord = null
    var weekendOffAssignments = null
    var additionalOffAssignments = null
    var bodyDraftId = body.draft_id || body.draft || ''

    if (bodyDraftId) {
      try {
        draftRecord = $app.findRecordById('schedule_drafts', bodyDraftId)
      } catch (_) {}
    }

    if (!draftRecord) {
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
          weekendOffAssignments = valSummary.weekend_off_assignments
        }
        if (
          valSummary &&
          valSummary.additional_off_assignments &&
          typeof valSummary.additional_off_assignments === 'object'
        ) {
          additionalOffAssignments = valSummary.additional_off_assignments
        }
      } catch (_) {}
    }

    var sortedProfileIds = Object.keys(profileMap).slice().sort()

    // Helper determinístico de paridade
    var computeNaturalPatternByStaffCommit = function (staffId, contractObj, cStart, cEnd) {
      var workHours = 12
      var restHours = 36
      if (contractObj) {
        try {
          var stId = contractObj.getString('shift_type')
          if (stId) {
            var stRecord = $app.findRecordById('shift_types', stId)
            workHours = stRecord.getInt('work_hours') || 12
            restHours = stRecord.getInt('rest_hours') || 36
          }
        } catch (_) {}
      }
      var is12x36 = workHours === 12 && restHours >= 36
      var stepDays = Math.max(2, Math.round((workHours + restHours) / 24))
      var normStart = cStart.split(' ')[0].split('T')[0]
      var normEnd = cEnd.split(' ')[0].split('T')[0]

      var offset = 0
      var parity = ''
      var anchorDate = ''
      if (contractObj) {
        try {
          var staffRec = $app.findRecordById('staff_profiles', staffId)
          parity = staffRec.getString('shift_parity') || ''
          anchorDate = (staffRec.getString('cycle_start_date') || '').split(' ')[0].split('T')[0]
        } catch (_) {}
      }

      if (is12x36) {
        if (parity === 'even') {
          offset = 1
        } else if (parity === 'odd') {
          offset = 0
        } else if (anchorDate && anchorDate >= normStart && anchorDate <= normEnd) {
          var diffAnchor = Math.round(
            (new Date(anchorDate + 'T00:00:00Z').getTime() -
              new Date(normStart + 'T00:00:00Z').getTime()) /
              86400000,
          )
          offset = ((diffAnchor % stepDays) + stepDays) % stepDays
        } else {
          var pos = sortedProfileIds.indexOf(staffId)
          var stableIdx = pos !== -1 ? pos : 0
          offset = stableIdx % stepDays
        }
      }

      var natDays = {}
      var cur = addDaysDateOnly(normStart, offset)
      while (cur <= normEnd) {
        natDays[cur] = true
        cur = addDaysDateOnly(cur, stepDays)
      }
      return natDays
    }

    sortedProfileIds.forEach(function (profileId) {
      var profile = profileMap[profileId]
      var contract = contractMap[profileId]
      if (!contract) return

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

      var naturalDays = computeNaturalPatternByStaffCommit(
        profileId,
        contract,
        cycleStart,
        cycleEnd,
      )

      // 1. Validar Folga de Fim de Semana (exatamente 1 data no ciclo em sábado OU domingo na paridade trabalhada)
      var staffWeekendOffs = weekendOffAssignments ? weekendOffAssignments[profileId] : null
      var weekendOffDate = null
      if (Array.isArray(staffWeekendOffs) && staffWeekendOffs.length > 0) {
        weekendOffDate = staffWeekendOffs[0]
      } else if (typeof staffWeekendOffs === 'string' && staffWeekendOffs) {
        weekendOffDate = staffWeekendOffs
      }

      // Se não veio do draft, calcula a data esperada
      if (!weekendOffDate) {
        var wCandidates = []
        var cCur = cycleStart
        while (cCur <= cycleEnd) {
          if (naturalDays[cCur]) {
            var dow = dayOfWeekDateOnly(cCur)
            if (dow === 6 || dow === 0) {
              wCandidates.push(cCur)
            }
          }
          cCur = addDaysDateOnly(cCur, 1)
        }
        if (wCandidates.length > 0) {
          var pIdx = sortedProfileIds.indexOf(profileId)
          weekendOffDate = wCandidates[(pIdx !== -1 ? pIdx : 0) % wCandidates.length]
        }
      }

      if (!weekendOffDate) {
        violations.push(
          'Fim de semana obrigatório não atendido: ' +
            profile.name +
            '. Nenhuma folga de fim de semana elegível no ciclo.',
        )
      } else {
        var wDow = dayOfWeekDateOnly(weekendOffDate)
        if (wDow !== 6 && wDow !== 0) {
          violations.push(
            'Folga de fim de semana inválida para ' +
              profile.name +
              ': ' +
              weekendOffDate +
              ' não é sábado nem domingo.',
          )
        } else if (weekendOffDate < cycleStart || weekendOffDate > cycleEnd) {
          violations.push(
            'Folga de fim de semana inválida para ' +
              profile.name +
              ': ' +
              weekendOffDate +
              ' está fora dos limites do ciclo.',
          )
        } else if (!naturalDays[weekendOffDate]) {
          violations.push(
            'Folga de fim de semana inválida para ' +
              profile.name +
              ': ' +
              weekendOffDate +
              ' não coincide com a paridade de plantão do colaborador.',
          )
        } else if (uShiftSet[weekendOffDate]) {
          violations.push(
            'Fim de semana obrigatório não atendido: ' +
              profile.name +
              ' possui plantão na folga de fim de semana designada (' +
              weekendOffDate +
              ').',
          )
        }
      }

      // 2. Validar Folga Adicional de Dia de Semana (segunda a sexta na paridade trabalhada, ou substituída por solicitação fulfilled)
      var staffAdditionalOffs = additionalOffAssignments
        ? additionalOffAssignments[profileId]
        : null
      var additionalOffDate = null
      if (Array.isArray(staffAdditionalOffs) && staffAdditionalOffs.length > 0) {
        additionalOffDate = staffAdditionalOffs[0]
      } else if (typeof staffAdditionalOffs === 'string' && staffAdditionalOffs) {
        additionalOffDate = staffAdditionalOffs
      }

      if (additionalOffDate) {
        var addDow = dayOfWeekDateOnly(additionalOffDate)
        if (addDow < 1 || addDow > 5) {
          violations.push(
            'Folga adicional de dia de semana inválida para ' +
              profile.name +
              ': ' +
              additionalOffDate +
              ' é sábado/domingo (deve ser seg-sex).',
          )
        } else if (additionalOffDate < cycleStart || additionalOffDate > cycleEnd) {
          violations.push(
            'Folga adicional de dia de semana para ' +
              profile.name +
              ' (' +
              additionalOffDate +
              ') está fora do ciclo.',
          )
        } else if (!naturalDays[additionalOffDate]) {
          violations.push(
            'Folga adicional inválida para ' +
              profile.name +
              ': ' +
              additionalOffDate +
              ' está em dia de folga natural por paridade oposta.',
          )
        } else if (uShiftSet[additionalOffDate]) {
          violations.push(
            'Folga adicional de dia de semana não respeitada: ' +
              profile.name +
              ' possui plantão no dia ' +
              additionalOffDate +
              '.',
          )
        }
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
