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
    const providedRules = body.rules || ''
    const priority = body.priority || 'staffing'
    const strictness = body.strictness !== undefined ? body.strictness : 50

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
      priority: priority,
      strictness: strictness,
    })

    var cycle = $app.findRecordById('shift_cycles', cycleId)

    var sectorFilters = sectorIds
      .map(function (id) {
        return "id='" + id + "'"
      })
      .join(' || ')
    var sectors = $app.findRecordsByFilter('hospital_sectors', sectorFilters, '-created', 100, 0)

    var departmentIds = []
    sectors.forEach(function (s) {
      var d = s.getString('department')
      if (d && departmentIds.indexOf(d) === -1) departmentIds.push(d)
    })

    var dbRules = []
    if (departmentIds.length > 0) {
      var depFilter = departmentIds
        .map(function (id) {
          return "department='" + id + "'"
        })
        .join(' || ')
      dbRules = $app.findRecordsByFilter('shift_rules', depFilter, '-created', 100, 0)
    }

    var contracts = $app.findRecordsByFilter('staff_contracts', '', '-created', 1000, 0)
    var roles = $app.findRecordsByFilter('staff_roles', '', '-created', 1000, 0)
    var shiftTypes = $app.findRecordsByFilter('shift_types', '', '-created', 1000, 0)
    var timeoffs = $app.findRecordsByFilter(
      'timeoff_requests',
      "cycle = {:cyc} && (status = 'pending' || status = 'fulfilled')",
      '-created',
      1000,
      0,
      { cyc: cycleId },
    )

    var usersWithContracts = []
    contracts.forEach(function (c) {
      try {
        var profileId = c.getString('staff_profile')
        if (!profileId) return
        var u = $app.findRecordById('staff_profiles', profileId)
        if (u.get('active') === false) return
        if (sectorIds.indexOf(u.getString('default_sector')) === -1) return

        var rId = u.getString('staff_role')
        var rName = 'N/A',
          rRank = 0,
          rSup = false
        if (rId) {
          for (var i = 0; i < roles.length; i++) {
            if (roles[i].id === rId) {
              rName = roles[i].getString('name')
              rRank = roles[i].getInt('hierarchy_rank')
              rSup = roles[i].getBool('requires_supervision')
              break
            }
          }
        }

        var sTypeName = 'Padrão',
          sTypeHours = 12,
          sTypeRest = 36,
          sTypeStart = '07:00'
        var sTypeId = c.getString('shift_type')
        if (sTypeId) {
          for (var j = 0; j < shiftTypes.length; j++) {
            if (shiftTypes[j].id === sTypeId) {
              sTypeName = shiftTypes[j].getString('name')
              sTypeHours = shiftTypes[j].getInt('work_hours')
              sTypeRest = shiftTypes[j].getInt('rest_hours')
              sTypeStart = shiftTypes[j].getString('start_time') || '07:00'
              break
            }
          }
        }

        var assignedRulesIds = u.getStringSlice('rules') || []
        var userRules = []
        assignedRulesIds.forEach(function (rid) {
          var rule = null
          for (var k = 0; k < dbRules.length; k++) {
            if (dbRules[k].id === rid) {
              rule = dbRules[k]
              break
            }
          }
          if (!rule) {
            try {
              rule = $app.findRecordById('shift_rules', rid)
            } catch (_) {}
          }
          if (rule) {
            var rType = rule.getString('rule_type') || 'other'
            var entry = {
              name: rule.getString('name') || 'Regra',
              type: rType,
              value: rule.getInt('value') || 0,
            }
            if (rType === 'custom_prompt') entry.prompt = rule.getString('prompt') || ''
            userRules.push(entry)
          }
        })

        var is12x36User = sTypeHours === 12 && sTypeRest >= 36
        var weekendOffSundays = []
        if (is12x36User && cycle) {
          var cStartGen = (cycle.getString('start_date') || '').split(' ')[0]
          var cEndGen = (cycle.getString('end_date') || '').split(' ')[0]
          if (cStartGen && cEndGen) {
            var stepDaysGen = Math.max(2, Math.round((sTypeHours + sTypeRest) / 24))
            var curGen = new Date(cStartGen + 'T00:00:00Z')
            var endGen = new Date(cEndGen + 'T00:00:00Z')
            var dayIdxGen = 0
            while (curGen <= endGen) {
              var dowGen = curGen.getUTCDay()
              if (dowGen === 0 && dayIdxGen % stepDaysGen === 0) {
                weekendOffSundays.push(curGen.toISOString().split('T')[0])
              }
              curGen = new Date(curGen.getTime() + 86400000)
              dayIdxGen++
            }
          }
        }

        var profileParity = u.getString('shift_parity') || ''
        var profileCycleStart = (u.getString('cycle_start_date') || '').split(' ')[0].split('T')[0]
        usersWithContracts.push({
          id: u.id,
          name: u.getString('name'),
          sector_id: u.getString('default_sector'),
          contract_type: c.getString('contract_type') || 'Não definido',
          hour_limit: c.getInt('monthly_hour_limit') || 0,
          role: rName,
          role_id: rId,
          rank: rRank,
          requires_supervision: rSup,
          shift_type: sTypeName,
          shift_work_hours: sTypeHours,
          shift_rest_hours: sTypeRest,
          shift_start_time: sTypeStart,
          shift_parity: profileParity,
          cycle_start_date: profileCycleStart,
          weekend_off_sundays: weekendOffSundays.length > 0 ? weekendOffSundays : undefined,
          assigned_rules: userRules.length > 0 ? userRules : undefined,
        })
      } catch (_) {}
    })

    var sectorData = sectors.map(function (s) {
      return {
        id: s.id,
        name: s.getString('name'),
        min_staff: s.getInt('min_staffing'),
        ideal_staff: s.getInt('ideal_staffing'),
        bed_capacity: s.getInt('bed_capacity'),
        staffing_ratio: s.getInt('staffing_ratio') || 10,
        is_critical: s.getBool('is_critical'),
      }
    })

    var customRuleCount = 0
    var ruleData = dbRules.map(function (r) {
      var type = r.getString('rule_type') || 'other'
      var entry = {
        name: r.getString('name') || 'Regra',
        type: type,
        value: r.getInt('value') || 0,
      }
      if (type === 'custom_prompt') {
        entry.prompt = r.getString('prompt') || ''
        entry.priority = 'override'
        customRuleCount++
      }
      return entry
    })

    var timeoffData = timeoffs.map(function (t) {
      return {
        user: t.getString('staff_profile') || t.getString('user'),
        date: (t.getString('date') || '').split(' ')[0],
        end_date: (t.getString('end_date') || t.getString('date') || '').split(' ')[0],
        weight: t.getInt('priority_weight') || 0,
      }
    })

    var prompt = [
      'You are an expert hospital shift scheduling algorithm.',
      'Generate an optimal shift schedule for the following cycle and sectors.',
      '',
      'Cycle Start: ' + cycle.getString('start_date'),
      'Cycle End: ' + cycle.getString('end_date'),
      '',
      'Sectors:',
      JSON.stringify(sectorData, null, 2),
      '',
      'Staff:',
      JSON.stringify(usersWithContracts, null, 2),
      '',
      'Database Rules:',
      JSON.stringify(ruleData, null, 2),
      '',
      'Context Rules:',
      providedRules,
      '',
      'AI Strictness and Priority:',
      '- Strictness: ' +
        strictness +
        '% (0% means very flexible, 100% means strictly fail if rules cannot be met).',
      priority === 'timeoff'
        ? '- Priority: Strictly respect time-off over staffing minimums'
        : '- Priority: Ensure minimum staffing even if it means slightly violating secondary rules (but timeoffs still highly prioritized).',
      '',
      'Timeoff Requests:',
      JSON.stringify(timeoffData, null, 2),
      '',
      'Constraints:',
      '1. Operational Cycle: The scale covers strictly the period from the 26th of the start month to the 25th of the end month as defined by Cycle Start/End.',
      '2. Safety Ratios: Non-critical floors must have at least 1 professional per "staffing_ratio" beds (default 10), and a minimum of 2 professionals.',
      '3. Predictive & Critical: Sectors marked is_critical should prioritize reaching their ideal_staff.',
      '4. Hierarchical Supervision: A professional requiring supervision cannot work alone. Pair with at least one higher hierarchy_rank professional.',
      '5. Time-off Requests: You MUST NOT schedule a user on any day from date through end_date, inclusive.',
      '6. Hours & Shifts: Respect shift_type work hours and rest hours. Total hours must not exceed hour_limit.',
      '7. Individual Rules: assigned_rules override general department rules for this specific professional.',
      '8. Custom AI Rules have MAXIMUM OVERRIDE PRIORITY. Follow their prompt precisely. When a custom rule conflicts with rest hours, 12x36, monthly hours or sequence rules, the custom rule wins; reorganize the remaining shifts to minimize the exception. Valid IDs, cycle dates, minimum staffing, supervision and formally registered timeoffs remain mandatory.',
      '9. Every collaborator with a 12x36 contract must receive the complete alternating-day sequence for the whole cycle, up to the monthly hour limit. Do not stop after reaching only the sector minimum or ideal staffing.',
      '10. Output strictly a JSON array. Assume default shifts start at 07:00:00.000Z.',
      '11. Every collaborator must have at least 1 full weekend (Saturday AND Sunday) off per calendar month. For 12x36 collaborators, the chosen Sunday must be one that would normally be worked in the alternating pattern — a naturally free Sunday does not count.',
      '',
      'Output FORMAT (strictly JSON array):',
      '[{"user_id":"...","sector_id":"...","start_time":"YYYY-MM-DD 07:00:00.000Z","end_time":"YYYY-MM-DD 19:00:00.000Z"}]',
      'Only output the JSON array, no markdown or text.',
    ].join('\n')

    try {
      var res = $ai.chat({
        model: 'reasoning',
        messages: [
          {
            role: 'system',
            content:
              'You output only strictly valid JSON. Do not wrap in markdown blocks. Output the raw array.',
          },
          { role: 'user', content: prompt },
        ],
      })

      var tokenUsage = 0
      if (res.usage) {
        tokenUsage = res.usage.total_tokens || 0
      }

      var content = res.choices[0].message.content.trim()
      if (content.startsWith('```')) {
        content = content.replace(/^\`\`\`[a-z]*\n/, '').replace(/\n\`\`\`$/, '')
      }

      var generatedShifts
      try {
        generatedShifts = JSON.parse(content)
      } catch (parseErr) {
        logAudit(
          'AI_SHIFT_GENERATION',
          { status: 'error', error: 'AI returned invalid JSON', cycle_id: cycleId },
          tokenUsage,
        )
        throw new Error(
          'A IA retornou um formato de dados inválido (não-JSON). Restrições impossíveis podem ter causado isso.',
        )
      }

      if (!Array.isArray(generatedShifts)) {
        logAudit(
          'AI_SHIFT_GENERATION',
          { status: 'error', error: 'AI returned non-array', cycle_id: cycleId },
          tokenUsage,
        )
        throw new Error('O formato retornado não é uma lista de plantões válida.')
      }

      if (generatedShifts.length === 0) {
        logAudit(
          'AI_SHIFT_GENERATION',
          { status: 'error', error: 'No shifts generated', cycle_id: cycleId },
          tokenUsage,
        )
        throw new Error(
          'Nenhum plantão gerado. Conflito: regras de descanso, carga horária e/ou colaboradores insuficientes impedem o preenchimento mínimo.',
        )
      }

      // Post-generation validation
      var timeoffMap = {}
      timeoffData.forEach(function (t) {
        if (!timeoffMap[t.user]) timeoffMap[t.user] = []
        var cursor = new Date(t.date + 'T00:00:00Z')
        var end = new Date((t.end_date || t.date) + 'T00:00:00Z')
        while (cursor <= end) {
          timeoffMap[t.user].push(cursor.toISOString().split('T')[0])
          cursor = new Date(cursor.getTime() + 86400000)
        }
      })

      // Complete all regular 12x36 contracts instead of stopping when only the
      // sector minimum was reached. Named custom-rule targets keep the dates
      // proposed by the AI because custom rules have override priority.
      var customPromptText = ruleData
        .filter(function (rule) {
          return rule.type === 'custom_prompt'
        })
        .map(function (rule) {
          return (rule.prompt || '').toLowerCase()
        })
        .join(' ')
      var completedShifts = []
      var completedDayCount = {}
      var completedIndependentCount = {}

      generatedShifts.forEach(function (shift) {
        var info = usersWithContracts.filter(function (u) {
          return u.id === shift.user_id
        })[0]
        if (!info) return
        var isRegular12x36 = info.shift_work_hours === 12 && info.shift_rest_hours >= 36
        var namedOverride =
          customPromptText && info.name && customPromptText.indexOf(info.name.toLowerCase()) !== -1
        if (isRegular12x36 && !namedOverride) return
        completedShifts.push(shift)
        var existingDate = (shift.start_time || '').split(' ')[0]
        completedDayCount[existingDate] = (completedDayCount[existingDate] || 0) + 1
        if (!info.requires_supervision) {
          completedIndependentCount[existingDate] =
            (completedIndependentCount[existingDate] || 0) + 1
        }
      })

      var completionOrder = usersWithContracts.slice().sort(function (a, b) {
        if (a.requires_supervision === b.requires_supervision) {
          return a.name < b.name ? -1 : 1
        }
        return a.requires_supervision ? 1 : -1
      })
      var generationStart = (cycle.getString('start_date') || '').split(' ')[0]
      var generationEnd = (cycle.getString('end_date') || '').split(' ')[0]

      // Stable anchor natural worked projection helper (v0.0.251)
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

        var normStart = cStart.split(' ')[0].split('T')[0]
        var normEnd = cEnd.split(' ')[0].split('T')[0]

        // Regra de paridade configurada por colaborador (shift_parity e cycle_start_date)
        var offset = 0
        var parity = contract ? contract.shift_parity : ''
        var anchorDate =
          contract && contract.cycle_start_date
            ? (contract.cycle_start_date || '').split(' ')[0].split('T')[0]
            : ''

        if (is12x36) {
          if (parity === 'even') {
            offset = 0
          } else if (parity === 'odd') {
            offset = 1
          } else if (anchorDate && anchorDate >= normStart && anchorDate <= normEnd) {
            var diffAnchor = Math.round(
              (new Date(anchorDate + 'T00:00:00Z').getTime() -
                new Date(normStart + 'T00:00:00Z').getTime()) /
                86400000,
            )
            offset = ((diffAnchor % stepDays) + stepDays) % stepDays
          } else {
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
            offset = stableIdx % stepDays
          }
        }

        var map = {}
        var cur = addDaysDateOnly(normStart, offset)
        while (cur <= normEnd) {
          map[cur] = true
          cur = addDaysDateOnly(cur, stepDays)
        }
        return map
      }

      var getNaturalWorkedDaysGen = function (staffList, cStart, cEnd) {
        var map = {}
        var normStart = cStart.split(' ')[0].split('T')[0]
        var normEnd = cEnd.split(' ')[0].split('T')[0]
        staffList.forEach(function (u) {
          map[u.id] = computeNaturalPatternByStaff(u.id, staffList, normStart, normEnd)
        })
        return map
      }
      var naturalWorkedMapGen = getNaturalWorkedDaysGen(
        usersWithContracts,
        generationStart,
        generationEnd,
      )

      completionOrder.forEach(function (u) {
        var isRegular12x36 = u.shift_work_hours === 12 && u.shift_rest_hours >= 36
        var namedOverride =
          customPromptText && u.name && customPromptText.indexOf(u.name.toLowerCase()) !== -1
        if (!isRegular12x36 || namedOverride) return

        var normGenStart = generationStart.split(' ')[0].split('T')[0]
        var normGenEnd = generationEnd.split(' ')[0].split('T')[0]

        var stepDays = Math.max(2, Math.round((u.shift_work_hours + u.shift_rest_hours) / 24))
        var maxShifts = Math.floor((u.hour_limit || 0) / u.shift_work_hours)

        // Resolve offset do colaborador a partir de sua paridade ou âncora
        var uParity = u.shift_parity || ''
        var uCycleStart = u.cycle_start_date
          ? (u.cycle_start_date || '').split(' ')[0].split('T')[0]
          : ''
        var targetOffset = 0
        var fixedOffset = false

        if (uParity === 'even') {
          targetOffset = 0
          fixedOffset = true
        } else if (uParity === 'odd') {
          targetOffset = 1
          fixedOffset = true
        } else if (uCycleStart && uCycleStart >= normGenStart && uCycleStart <= normGenEnd) {
          var diffFromCycleStart = Math.round(
            (new Date(uCycleStart + 'T00:00:00Z').getTime() -
              new Date(normGenStart + 'T00:00:00Z').getTime()) /
              86400000,
          )
          targetOffset = ((diffFromCycleStart % stepDays) + stepDays) % stepDays
          fixedOffset = true
        } else {
          var sortedStaffIds = usersWithContracts
            .map(function (c) {
              return c.id
            })
            .filter(Boolean)
            .sort()
          var stableIdx = sortedStaffIds.indexOf(u.id)
          if (stableIdx === -1) stableIdx = 0
          targetOffset = stableIdx % stepDays
        }

        var bestDates = []
        var bestScore = Number.MAX_SAFE_INTEGER

        var offsetRangeStart = fixedOffset ? targetOffset : 0
        var offsetRangeEnd = fixedOffset ? targetOffset + 1 : stepDays

        for (var offset = offsetRangeStart; offset < offsetRangeEnd; offset++) {
          var dates = []
          var dateCursor = addDaysDateOnly(normGenStart, offset)
          while (dateCursor <= normGenEnd && dates.length < maxShifts) {
            if ((timeoffMap[u.id] || []).indexOf(dateCursor) === -1) {
              dates.push(dateCursor)
            }
            dateCursor = addDaysDateOnly(dateCursor, stepDays)
          }

          var score = -dates.length * 1000
          if (offset === targetOffset) score -= 500
          dates.forEach(function (date) {
            score += (completedDayCount[date] || 0) * 10
            if (u.requires_supervision && !(completedIndependentCount[date] > 0)) {
              score += 100
            }
          })
          if (score < bestScore) {
            bestScore = score
            bestDates = dates
          }
        }

        bestDates.forEach(function (date) {
          var startTime = u.shift_start_time || '07:00'
          if (startTime.length === 5) startTime += ':00'
          var start = new Date(date + 'T' + startTime + '.000Z')
          var end = new Date(start.getTime() + u.shift_work_hours * 3600000)
          completedShifts.push({
            user_id: u.id,
            sector_id: u.sector_id,
            start_time: start.toISOString().replace('T', ' ').substring(0, 23) + 'Z',
            end_time: end.toISOString().replace('T', ' ').substring(0, 23) + 'Z',
          })
          completedDayCount[date] = (completedDayCount[date] || 0) + 1
          if (!u.requires_supervision) {
            completedIndependentCount[date] = (completedIndependentCount[date] || 0) + 1
          }
        })
      })

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

      // enforceWeekendOff per-cycle for generate_shifts.js
      var enforceWeekendOffGen = function (currentShifts, staffList, cStart, cEnd, sectorsList) {
        var normStart = cStart.split(' ')[0].split('T')[0]
        var normEnd = cEnd.split(' ')[0].split('T')[0]

        // Todos os fins de semana candidatos no ciclo inteiro
        var cycleWeekends = []
        var dCur = normStart
        while (dCur <= normEnd) {
          if (dayOfWeekDateOnly(dCur) === 6) {
            var satStr = dCur
            var sunStr = addDaysDateOnly(dCur, 1)
            if (sunStr <= normEnd && assertWeekendPair(satStr, sunStr)) {
              cycleWeekends.push({ sat: satStr, sun: sunStr })
            }
          }
          dCur = addDaysDateOnly(dCur, 1)
        }

        // Helper map for sector min staffing
        var sectorMinStaffMap = {}
        if (Array.isArray(sectorsList)) {
          sectorsList.forEach(function (sec) {
            if (!sec) return
            var secId = sec.id || (typeof sec.getId === 'function' ? sec.getId() : '')
            var minSt =
              typeof sec.getInt === 'function'
                ? sec.getInt('min_staffing')
                : sec.min_staffing || sec.min_staff || 0
            if (secId) {
              sectorMinStaffMap[secId] = minSt
            }
          })
        }

        var workingShifts = currentShifts.map(function (s) {
          return {
            user_id: s.user_id,
            sector_id: s.sector_id,
            start_time: s.start_time,
            end_time: s.end_time,
            date: (s.start_time || s.date || '').split(' ')[0],
          }
        })

        // Shift sets per staff
        var shiftsByStaff = {}
        staffList.forEach(function (u) {
          shiftsByStaff[u.id] = {}
        })
        workingShifts.forEach(function (s) {
          if (!shiftsByStaff[s.user_id]) shiftsByStaff[s.user_id] = {}
          shiftsByStaff[s.user_id][s.date] = true
        })

        // Clone helper for transactional candidate evaluation
        var cloneState = function (shiftsArr, staffMap) {
          var clonedShifts = shiftsArr.map(function (s) {
            return {
              user_id: s.user_id,
              sector_id: s.sector_id,
              start_time: s.start_time,
              end_time: s.end_time,
              date: s.date,
            }
          })
          var clonedStaffMap = {}
          Object.keys(staffMap).forEach(function (k) {
            clonedStaffMap[k] = {}
            Object.keys(staffMap[k]).forEach(function (d) {
              if (staffMap[k][d]) {
                clonedStaffMap[k][d] = true
              }
            })
          })
          return { shifts: clonedShifts, staffMap: clonedStaffMap }
        }

        // Check coverage on all days in [cStart, cEnd] for all sectors
        var checkCoverageOk = function (shiftsArr) {
          var dCountsBySector = {}
          for (var si = 0; si < shiftsArr.length; si++) {
            var sItem = shiftsArr[si]
            var secKey = sItem.sector_id || 'default'
            var d = sItem.date
            if (!dCountsBySector[secKey]) dCountsBySector[secKey] = {}
            dCountsBySector[secKey][d] = (dCountsBySector[secKey][d] || 0) + 1
          }

          var secKeys = Object.keys(sectorMinStaffMap)
          if (secKeys.length === 0) return true

          for (var ski = 0; ski < secKeys.length; ski++) {
            var sId = secKeys[ski]
            var reqMin = sectorMinStaffMap[sId] || 0
            if (reqMin <= 0) continue

            var curDate = normStart
            while (curDate <= normEnd) {
              var count = (dCountsBySector[sId] && dCountsBySector[sId][curDate]) || 0
              if (count < reqMin) {
                return false
              }
              curDate = addDaysDateOnly(curDate, 1)
            }
          }
          return true
        }

        var assignments = {}
        var protectedDatesGen = {}
        var issues = []

        // --- FASE 1: Planejamento per-cycle (round-robin) ---
        var plannedByStaff = {}
        if (cycleWeekends.length > 0) {
          staffList.forEach(function (u, staffIndex) {
            var workH = u.shift_work_hours || 12
            var restH = u.shift_rest_hours || 36
            var is12x36 = workH === 12 && restH >= 36
            var uNatSet = naturalWorkedMapGen[u.id] || {}

            var userCandidates = cycleWeekends.map(function (w) {
              return {
                sat: w.sat,
                sun: w.sun,
                sunIsNat: is12x36 ? !!uNatSet[w.sun] : true,
              }
            })

            var natCandidates = userCandidates.filter(function (w) {
              return w.sunIsNat
            })
            if (natCandidates.length === 0) {
              natCandidates = userCandidates.slice()
            }

            // Round-robin distribution entre os fins de semana candidatos
            var assignedIdx = staffIndex % natCandidates.length
            var orderedCandidates = []
            for (var oi = 0; oi < natCandidates.length; oi++) {
              orderedCandidates.push(natCandidates[(assignedIdx + oi) % natCandidates.length])
            }

            var initialChoice = orderedCandidates[0]
            plannedByStaff[u.id] = {
              orderedCandidates: orderedCandidates,
              currentChoice: initialChoice,
            }

            // Pré-preenche protectedDates imediatamente para TODOS os assignments
            protectedDatesGen[u.id + ':' + initialChoice.sat] = true
            protectedDatesGen[u.id + ':' + initialChoice.sun] = true
          })
        }

        // --- FASE 2: Execução (swaps) ---
        staffList.forEach(function (u) {
          var plan = plannedByStaff[u.id]
          if (!plan) {
            issues.push(
              'Fim de semana obrigatório não atendido: ' +
                u.name +
                ' sem fins de semana candidatos no ciclo.',
            )
            return
          }

          var orderedCandidates = plan.orderedCandidates
          var initialChoice = plan.currentChoice
          var committedWeekend = null

          for (var ci = 0; ci < orderedCandidates.length; ci++) {
            var candidate = orderedCandidates[ci]
            var satStr = candidate.sat
            var sunStr = candidate.sun

            if (!assertWeekendPair(satStr, sunStr)) {
              continue
            }

            // Se mudamos de candidato, atualiza protectedDates
            if (candidate !== initialChoice) {
              delete protectedDatesGen[u.id + ':' + initialChoice.sat]
              delete protectedDatesGen[u.id + ':' + initialChoice.sun]
              protectedDatesGen[u.id + ':' + satStr] = true
              protectedDatesGen[u.id + ':' + sunStr] = true
              initialChoice = candidate
            }

            // Snapshot state for rollback
            var snapshot = cloneState(workingShifts, shiftsByStaff)
            var candidateShifts = snapshot.shifts
            var candidateStaffMap = snapshot.staffMap

            var datesToFree = []
            if (candidateStaffMap[u.id][satStr]) datesToFree.push(satStr)
            if (candidateStaffMap[u.id][sunStr]) datesToFree.push(sunStr)

            var candidatePossible = true

            for (var di = 0; di < datesToFree.length; di++) {
              var dt = datesToFree[di]

              // Find substitute in the same sector (skipping protected dates)
              var candList = staffList.filter(function (cand) {
                return (
                  cand.id !== u.id &&
                  (!u.sector_id || !cand.sector_id || cand.sector_id === u.sector_id) &&
                  !candidateStaffMap[cand.id][dt] &&
                  !protectedDatesGen[cand.id + ':' + dt] &&
                  (timeoffMap[cand.id] || []).indexOf(dt) === -1
                )
              })

              var subFound = null
              for (var sli = 0; sli < candList.length; sli++) {
                var c = candList[sli]
                var cRestH = c.shift_rest_hours || 36
                var cNeedGap = Math.max(1, Math.ceil((cRestH + 0.001) / 24))
                var gapOk = true
                var cDates = Object.keys(candidateStaffMap[c.id]).filter(function (d) {
                  return candidateStaffMap[c.id][d]
                })
                for (var cdi = 0; cdi < cDates.length; cdi++) {
                  var pDt = parseDateOnly(dt)
                  var pCD = parseDateOnly(cDates[cdi])
                  var diffDays = Math.abs(
                    (Date.UTC(pDt.y, pDt.m - 1, pDt.d) - Date.UTC(pCD.y, pCD.m - 1, pCD.d)) /
                      86400000,
                  )
                  if (diffDays < cNeedGap) {
                    gapOk = false
                    break
                  }
                }
                if (gapOk) {
                  subFound = c
                  break
                }
              }

              if (subFound) {
                // Reassign shift from u to subFound
                for (var si = 0; si < candidateShifts.length; si++) {
                  if (candidateShifts[si].user_id === u.id && candidateShifts[si].date === dt) {
                    candidateShifts[si].user_id = subFound.id
                    if (subFound.sector_id) {
                      candidateShifts[si].sector_id = subFound.sector_id
                    }
                    var startTime = subFound.shift_start_time || '07:00'
                    if (startTime.length === 5) startTime += ':00'
                    var start = new Date(dt + 'T' + startTime + '.000Z')
                    var end = new Date(
                      start.getTime() + (subFound.shift_work_hours || 12) * 3600000,
                    )
                    candidateShifts[si].start_time =
                      start.toISOString().replace('T', ' ').substring(0, 23) + 'Z'
                    candidateShifts[si].end_time =
                      end.toISOString().replace('T', ' ').substring(0, 23) + 'Z'
                    candidateStaffMap[u.id][dt] = false
                    candidateStaffMap[subFound.id][dt] = true
                    break
                  }
                }
              } else {
                // Removal as last resort: splice if post-removal coverage on dt >= minStaff of the sector
                var shiftSectorId = u.sector_id || ''
                for (var fsi = 0; fsi < candidateShifts.length; fsi++) {
                  if (candidateShifts[fsi].user_id === u.id && candidateShifts[fsi].date === dt) {
                    shiftSectorId = candidateShifts[fsi].sector_id || shiftSectorId
                    break
                  }
                }
                var sectorMin = sectorMinStaffMap[shiftSectorId] || 0
                var currentDayCount = 0
                for (var csi = 0; csi < candidateShifts.length; csi++) {
                  if (
                    candidateShifts[csi].date === dt &&
                    (!shiftSectorId || candidateShifts[csi].sector_id === shiftSectorId)
                  ) {
                    currentDayCount++
                  }
                }
                if (sectorMin > 0 && currentDayCount - 1 < sectorMin) {
                  candidatePossible = false
                  break
                }
                for (var si2 = 0; si2 < candidateShifts.length; si2++) {
                  if (candidateShifts[si2].user_id === u.id && candidateShifts[si2].date === dt) {
                    candidateShifts.splice(si2, 1)
                    candidateStaffMap[u.id][dt] = false
                    break
                  }
                }
              }
            }

            // Verify both days are free and cycle coverage is maintained
            if (
              candidatePossible &&
              !candidateStaffMap[u.id][satStr] &&
              !candidateStaffMap[u.id][sunStr] &&
              checkCoverageOk(candidateShifts)
            ) {
              // COMMIT state
              workingShifts = candidateShifts
              shiftsByStaff = candidateStaffMap
              committedWeekend = candidate
              break
            }
            // Otherwise ROLLBACK
          }

          if (committedWeekend && assertWeekendPair(committedWeekend.sat, committedWeekend.sun)) {
            assignments[u.id] = [committedWeekend.sat, committedWeekend.sun]
            protectedDatesGen[u.id + ':' + committedWeekend.sat] = true
            protectedDatesGen[u.id + ':' + committedWeekend.sun] = true
          } else {
            issues.push(
              'Fim de semana obrigatório não atendido: ' +
                u.name +
                ' não tem sábado+domingo livres no ciclo.',
            )
          }
        })

        // Check coverage on each day and sector
        var dayCountsBySector = {}
        workingShifts.forEach(function (s) {
          var secKey = s.sector_id || 'default'
          if (!dayCountsBySector[secKey]) dayCountsBySector[secKey] = {}
          dayCountsBySector[secKey][s.date] = (dayCountsBySector[secKey][s.date] || 0) + 1
        })

        var secKeys = Object.keys(sectorMinStaffMap)
        secKeys.forEach(function (sId) {
          var minSt = sectorMinStaffMap[sId] || 0
          if (minSt <= 0) return
          var secName = sId
          if (Array.isArray(sectorsList)) {
            for (var si = 0; si < sectorsList.length; si++) {
              if (
                sectorsList[si] &&
                (sectorsList[si].id === sId ||
                  (typeof sectorsList[si].getId === 'function' && sectorsList[si].getId() === sId))
              ) {
                secName =
                  (typeof sectorsList[si].getString === 'function'
                    ? sectorsList[si].getString('name')
                    : sectorsList[si].name) || sId
                break
              }
            }
          }
          var cCur = new Date(cStart + 'T00:00:00Z')
          var cEndD = new Date(cEnd + 'T00:00:00Z')
          while (cCur <= cEndD) {
            var dStr = cCur.toISOString().split('T')[0]
            var count = (dayCountsBySector[sId] && dayCountsBySector[sId][dStr]) || 0
            if (count < minSt) {
              issues.push(
                'Efetivo insuficiente em ' +
                  secName +
                  ' no dia ' +
                  dStr +
                  ': ' +
                  count +
                  '/' +
                  minSt +
                  '.',
              )
            }
            cCur = new Date(cCur.getTime() + 86400000)
          }
        })

        return {
          shifts: workingShifts,
          assignments: assignments,
          issues: issues,
        }
      }

      var enforcedGenResult = enforceWeekendOffGen(
        completedShifts,
        usersWithContracts,
        generationStart,
        generationEnd,
        sectors,
      )
      completedShifts = enforcedGenResult.shifts
      var weekendOffEnforcementIssuesGen = enforcedGenResult.issues

      generatedShifts = completedShifts

      var userHourMap = {}
      var userContractMap = {}
      usersWithContracts.forEach(function (u) {
        userHourMap[u.id] = 0
        userContractMap[u.id] = u
      })

      var userShiftDates = {}
      var dayAssignments = {}
      var violations = []
      var overrideWarnings = []
      var cycleStart = (cycle.getString('start_date') || '').split(' ')[0]
      var cycleEnd = (cycle.getString('end_date') || '').split(' ')[0]

      // Sort generated shifts by user and start_time for rest-hour validation
      var sortedShifts = generatedShifts.slice().sort(function (a, b) {
        if (a.user_id !== b.user_id) return a.user_id < b.user_id ? -1 : 1
        return a.start_time < b.start_time ? -1 : 1
      })

      sortedShifts.forEach(function (gs) {
        if (!gs.user_id || !gs.sector_id || !gs.start_time || !gs.end_time) {
          violations.push(
            'Plantão com dados incompletos (user_id, sector_id, start_time ou end_time ausente)',
          )
          return
        }

        var sectorExists = false
        for (var si = 0; si < sectors.length; si++) {
          if (sectors[si].id === gs.sector_id) {
            sectorExists = true
            break
          }
        }
        if (!sectorExists) {
          violations.push('Setor inválido no plantão: ' + gs.sector_id)
          return
        }

        var uInfo = userContractMap[gs.user_id]
        if (!uInfo) {
          violations.push('Colaborador inválido ou sem contrato no plantão: ' + gs.user_id)
          return
        }

        var dateStr = gs.start_time.split(' ')[0]
        if (dateStr < cycleStart || dateStr > cycleEnd) {
          violations.push(
            'Plantão de ' + uInfo.name + ' em ' + dateStr + ' está fora do período do ciclo.',
          )
        }

        var dayKey = gs.sector_id + '|' + dateStr
        if (!dayAssignments[dayKey]) dayAssignments[dayKey] = []
        dayAssignments[dayKey].push(uInfo)

        // Check timeoff
        var userTimeoffs = timeoffMap[gs.user_id] || []
        if (userTimeoffs.indexOf(dateStr) !== -1) {
          var userName = userContractMap[gs.user_id] ? userContractMap[gs.user_id].name : gs.user_id
          violations.push(
            'Violação de Folga: ' +
              userName +
              ' alocado em ' +
              dateStr +
              ' (possui folga solicitada neste dia)',
          )
        }

        // Check hour limit
        if (uInfo) {
          var shiftStart = new Date(gs.start_time.replace(' ', 'T'))
          var shiftEnd = new Date(gs.end_time.replace(' ', 'T'))
          var shiftHours = (shiftEnd.getTime() - shiftStart.getTime()) / 3600000
          userHourMap[gs.user_id] += shiftHours

          if (userHourMap[gs.user_id] > uInfo.hour_limit) {
            var hourMessage =
              'Violação de Carga Horária: ' +
              uInfo.name +
              ' excede o limite mensal (' +
              Math.round(userHourMap[gs.user_id]) +
              'h / ' +
              uInfo.hour_limit +
              'h)'
            if (customRuleCount > 0) {
              overrideWarnings.push('Exceção por regra customizada: ' + hourMessage)
            } else {
              violations.push(hourMessage)
            }
          }

          // Check rest hours between consecutive shifts
          if (userShiftDates[gs.user_id]) {
            var prevEnd = userShiftDates[gs.user_id].end
            var currStart = shiftStart
            var gapHours = (currStart.getTime() - prevEnd.getTime()) / 3600000
            if (gapHours < 0) {
              violations.push('Sobreposição de plantões: ' + uInfo.name)
            } else if (gapHours < uInfo.shift_rest_hours) {
              var restMessage =
                'Violação de Descanso: ' +
                uInfo.name +
                ' tem apenas ' +
                Math.round(gapHours) +
                'h de descanso (mínimo: ' +
                uInfo.shift_rest_hours +
                'h)'
              if (customRuleCount > 0) {
                overrideWarnings.push('Exceção por regra customizada: ' + restMessage)
              } else {
                violations.push(restMessage)
              }
            }
          }
          userShiftDates[gs.user_id] = { end: shiftEnd }
        }
      })

      sectors.forEach(function (sectorRecord) {
        var minStaffing = sectorRecord.getInt('min_staffing') || 0
        var idealStaffing = sectorRecord.getInt('ideal_staffing') || minStaffing
        var requiredStaffing = minStaffing
        var bedCapacity = sectorRecord.getInt('bed_capacity') || 0
        var staffingRatio = sectorRecord.getInt('staffing_ratio') || 0
        if (!sectorRecord.getBool('is_critical') && bedCapacity > 0 && staffingRatio > 0) {
          requiredStaffing = Math.max(requiredStaffing, Math.ceil(bedCapacity / staffingRatio), 2)
        }

        var dayCursor = new Date(cycleStart + 'T00:00:00Z')
        var cycleLastDay = new Date(cycleEnd + 'T00:00:00Z')
        while (dayCursor <= cycleLastDay) {
          var dayStr = dayCursor.toISOString().split('T')[0]
          var assignments = dayAssignments[sectorRecord.id + '|' + dayStr] || []
          if (assignments.length < requiredStaffing) {
            violations.push(
              'Efetivo insuficiente em ' +
                sectorRecord.getString('name') +
                ' no dia ' +
                dayStr +
                ': ' +
                assignments.length +
                '/' +
                requiredStaffing,
            )
          }

          assignments.forEach(function (assignment) {
            if (!assignment.requires_supervision) return
            var hasSupervisor = assignments.some(function (candidate) {
              return candidate.id !== assignment.id && candidate.rank > assignment.rank
            })
            if (!hasSupervisor) {
              violations.push(
                'Supervisão ausente em ' +
                  sectorRecord.getString('name') +
                  ' no dia ' +
                  dayStr +
                  ' para ' +
                  assignment.name,
              )
            }
          })
          dayCursor = new Date(dayCursor.getTime() + 86400000)
        }
      })

      // Validação per-cycle de folga de fim de semana (exatamente 1 par sat+sun por colaborador por ciclo)
      var expectedCountGen = 1
      var genAssignmentsMap = enforcedGenResult.assignments || {}

      usersWithContracts.forEach(function (u) {
        var uShifts = generatedShifts
          .filter(function (s) {
            return s.user_id === u.id
          })
          .map(function (s) {
            return s.start_time.split(' ')[0]
          })
        var uShiftSet = {}
        uShifts.forEach(function (d) {
          uShiftSet[d] = true
        })

        var userPair = genAssignmentsMap[u.id]

        if (!userPair || !Array.isArray(userPair) || userPair.length !== 2) {
          violations.push(
            'Fim de semana obrigatório não atendido: ' +
              u.name +
              ' não tem sábado+domingo livres no ciclo.',
          )
        } else {
          var satStr = userPair[0]
          var sunStr = userPair[1]
          if (
            !satStr ||
            !sunStr ||
            !assertWeekendPair(satStr, sunStr) ||
            satStr < cycleStart ||
            sunStr > cycleEnd
          ) {
            violations.push(
              'Fim de semana obrigatório inválido: ' +
                u.name +
                ' possui designação (' +
                satStr +
                ' / ' +
                sunStr +
                ') que não é Sábado + Domingo no ciclo.',
            )
          } else if (uShiftSet[satStr] || uShiftSet[sunStr]) {
            violations.push(
              'Fim de semana obrigatório não atendido: ' +
                u.name +
                ' possui plantão no fim de semana de folga designado (' +
                satStr +
                ' / ' +
                sunStr +
                ').',
            )
          }
        }
      })

      if (weekendOffEnforcementIssuesGen && weekendOffEnforcementIssuesGen.length > 0) {
        violations = violations.concat(weekendOffEnforcementIssuesGen)
      }

      violations = violations.filter(function (item, index, all) {
        return all.indexOf(item) === index
      })

      if (violations.length > 0) {
        logAudit(
          'AI_SHIFT_GENERATION',
          {
            status: 'validation_failed',
            cycle_id: cycleId,
            violations: violations,
            shift_count: generatedShifts.length,
          },
          tokenUsage,
        )

        // Identify bottleneck
        var timeoffViolations = violations.filter(function (v) {
          return v.indexOf('Folga') !== -1
        })
        var hourViolations = violations.filter(function (v) {
          return v.indexOf('Carga Horária') !== -1
        })
        var restViolations = violations.filter(function (v) {
          return v.indexOf('Descanso') !== -1
        })

        var bottleneck = 'A IA gerou plantões que violam restrições críticas:\n'
        if (timeoffViolations.length > 0)
          bottleneck +=
            '\n• Folgas não respeitadas (' +
            timeoffViolations.length +
            ' ocorrências) — considere reduzir o número de setores ou contratar mais colaboradores.\n'
        if (hourViolations.length > 0)
          bottleneck +=
            '\n• Limite de carga horária excedido (' +
            hourViolations.length +
            ' ocorrências) — verifique os contratos ou reduza o período do ciclo.\n'
        if (restViolations.length > 0)
          bottleneck +=
            '\n• Descanso insuficiente entre plantões (' +
            restViolations.length +
            ' ocorrências) — ajuste as regras de descanso ou o tipo de turno.\n'

        return e.json(400, { error: bottleneck, violations: violations })
      }

      // Replace the validated schedule atomically, preserving the previous version on any failure.
      // Also persist/update schedule_drafts with validation_summary (including weekend_off_assignments).
      var validSectorIds = sectors.map(function (s) {
        return s.id
      })
      var savedCount = 0
      var createdDraftIds = {}

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

        // Persistir schedule_drafts para cada setor gerado com validation_summary completo
        var draftsCol = txApp.findCollectionByNameOrId('schedule_drafts')
        validSectorIds.forEach(function (sId) {
          var draftRec = new Record(draftsCol)
          draftRec.set('cycle', cycleId)
          draftRec.set('sector', sId)
          draftRec.set('status', 'draft')
          draftRec.set('version', 1)
          draftRec.set('generation_source', 'ai')
          draftRec.set('generated_by', e.auth ? e.auth.id : '')
          draftRec.set('created_by', e.auth ? e.auth.id : '')
          draftRec.set('validation_summary', {
            violations_count: 0,
            warnings_count: overrideWarnings.length,
            hard_violations: [],
            warnings: overrideWarnings.slice(0, 20),
            weekend_off_assignments: genAssignmentsMap,
            cycle_start: cycleStart,
            cycle_end: cycleEnd,
          })
          txApp.save(draftRec)
          createdDraftIds[sId] = draftRec.id
        })

        var shiftsCol = txApp.findCollectionByNameOrId('shifts')
        for (var gi = 0; gi < generatedShifts.length; gi++) {
          var generated = generatedShifts[gi]
          if (
            !generated.user_id ||
            !generated.sector_id ||
            !generated.start_time ||
            !generated.end_time
          ) {
            continue
          }

          var sectorValid = false
          for (var sj = 0; sj < sectors.length; sj++) {
            if (sectors[sj].id === generated.sector_id) {
              sectorValid = true
              break
            }
          }
          if (!sectorValid) continue

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
        tokenUsage,
      )

      return e.json(200, {
        success: true,
        count: savedCount,
        warnings: overrideWarnings,
        custom_override_applied: customRuleCount > 0,
      })
    } catch (err) {
      var isTimeout =
        err.message &&
        (err.message.toLowerCase().indexOf('timeout') !== -1 ||
          err.message.toLowerCase().indexOf('deadline') !== -1)
      var errorMessage = isTimeout
        ? 'A geração demorou muito e expirou. Tente reduzir o número de setores ou o período.'
        : err.message || 'Falha desconhecida durante a geração de escalas.'

      logAudit('AI_SHIFT_GENERATION', {
        status: 'error',
        cycle_id: cycleId,
        error: errorMessage,
      })

      try {
        var helper = $ai.agent('escala-expert').chat({
          user_id: e.auth ? e.auth.id : 'system',
          message:
            'A geração de escala falhou. Erro: ' +
            errorMessage +
            '. Analise e sugira, de forma concisa, por que contratos e regras de descanso podem ter entrado em conflito com o dimensionamento mínimo.',
        })
        return e.json(400, { error: errorMessage, suggestion: helper.content })
      } catch (_) {}

      return e.json(400, { error: errorMessage })
    }
  },
  $apis.requireAuth(),
)
