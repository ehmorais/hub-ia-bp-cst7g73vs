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

      completionOrder.forEach(function (u) {
        var isRegular12x36 = u.shift_work_hours === 12 && u.shift_rest_hours >= 36
        var namedOverride =
          customPromptText && u.name && customPromptText.indexOf(u.name.toLowerCase()) !== -1
        if (!isRegular12x36 || namedOverride) return

        var stepDays = Math.max(2, Math.round((u.shift_work_hours + u.shift_rest_hours) / 24))
        var maxShifts = Math.floor((u.hour_limit || 0) / u.shift_work_hours)
        var bestDates = []
        var bestScore = Number.MAX_SAFE_INTEGER

        for (var offset = 0; offset < stepDays; offset++) {
          var dates = []
          var dateCursor = new Date(generationStart + 'T00:00:00Z')
          dateCursor = new Date(dateCursor.getTime() + offset * 86400000)
          while (dateCursor <= new Date(generationEnd + 'T00:00:00Z') && dates.length < maxShifts) {
            var candidateDate = dateCursor.toISOString().split('T')[0]
            if ((timeoffMap[u.id] || []).indexOf(candidateDate) === -1) {
              dates.push(candidateDate)
            }
            dateCursor = new Date(dateCursor.getTime() + stepDays * 86400000)
          }

          var score = -dates.length * 1000
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
      var validSectorIds = sectors.map(function (s) {
        return s.id
      })
      var savedCount = 0
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
