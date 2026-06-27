routerAdd(
  'POST',
  '/backend/v1/escala/generate',
  (e) => {
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
        var userId = c.getString('user')
        if (!userId) return
        var u = $app.findRecordById('users', userId)
        if (u.getString('role') === 'Admin') return

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
          sTypeRest = 36
        var sTypeId = c.getString('shift_type')
        if (sTypeId) {
          for (var j = 0; j < shiftTypes.length; j++) {
            if (shiftTypes[j].id === sTypeId) {
              sTypeName = shiftTypes[j].getString('name')
              sTypeHours = shiftTypes[j].getInt('work_hours')
              sTypeRest = shiftTypes[j].getInt('rest_hours')
              break
            }
          }
        }

        var assignedRulesIds = u.getStringSlice('assigned_rules') || []
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
          contract_type: c.getString('contract_type') || 'Não definido',
          hour_limit: c.getInt('monthly_hour_limit') || 0,
          role: rName,
          role_id: rId,
          rank: rRank,
          requires_supervision: rSup,
          shift_type: sTypeName,
          shift_work_hours: sTypeHours,
          shift_rest_hours: sTypeRest,
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

    var ruleData = dbRules.map(function (r) {
      var type = r.getString('rule_type') || 'other'
      var entry = {
        name: r.getString('name') || 'Regra',
        type: type,
        value: r.getInt('value') || 0,
      }
      if (type === 'custom_prompt') entry.prompt = r.getString('prompt') || ''
      return entry
    })

    var timeoffData = timeoffs.map(function (t) {
      return {
        user: t.getString('user'),
        date: (t.getString('date') || '').split(' ')[0],
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
      '5. Time-off Requests: You MUST NOT schedule a user on a day where they have a time-off request.',
      '6. Hours & Shifts: Respect shift_type work hours and rest hours. Total hours must not exceed hour_limit.',
      '7. Individual Rules: assigned_rules override general department rules for this specific professional.',
      '8. Custom AI Rules: Apply all rules of type "custom_prompt" by following their prompt field precisely.',
      '9. Output strictly a JSON array. Assume default shifts start at 07:00:00.000Z.',
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
        timeoffMap[t.user].push(t.date)
      })

      var userHourMap = {}
      var userContractMap = {}
      usersWithContracts.forEach(function (u) {
        userHourMap[u.id] = 0
        userContractMap[u.id] = u
      })

      var userShiftDates = {}
      var violations = []

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

        var dateStr = gs.start_time.split(' ')[0]

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
        var uInfo = userContractMap[gs.user_id]
        if (uInfo) {
          var shiftStart = new Date(gs.start_time.replace(' ', 'T'))
          var shiftEnd = new Date(gs.end_time.replace(' ', 'T'))
          var shiftHours = (shiftEnd.getTime() - shiftStart.getTime()) / 3600000
          userHourMap[gs.user_id] += shiftHours

          if (userHourMap[gs.user_id] > uInfo.hour_limit) {
            violations.push(
              'Violação de Carga Horária: ' +
                uInfo.name +
                ' excede o limite mensal (' +
                Math.round(userHourMap[gs.user_id]) +
                'h / ' +
                uInfo.hour_limit +
                'h)',
            )
          }

          // Check rest hours between consecutive shifts
          if (userShiftDates[gs.user_id]) {
            var prevEnd = userShiftDates[gs.user_id].end
            var currStart = shiftStart
            var gapHours = (currStart.getTime() - prevEnd.getTime()) / 3600000
            if (gapHours < uInfo.shift_rest_hours && gapHours >= 0) {
              violations.push(
                'Violação de Descanso: ' +
                  uInfo.name +
                  ' tem apenas ' +
                  Math.round(gapHours) +
                  'h de descanso (mínimo: ' +
                  uInfo.shift_rest_hours +
                  'h)',
              )
            }
          }
          userShiftDates[gs.user_id] = { end: shiftEnd }
        }
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

      // Delete existing shifts for selected sectors
      var validSectorIds = sectors.map(function (s) {
        return s.id
      })
      var existingShifts = $app.findRecordsByFilter(
        'shifts',
        'cycle = {:cyc}',
        '-created',
        10000,
        0,
        { cyc: cycleId },
      )
      existingShifts.forEach(function (s) {
        if (validSectorIds.indexOf(s.getString('sector')) !== -1) {
          $app.delete(s)
        }
      })

      // Save new shifts
      var shiftsCol = $app.findCollectionByNameOrId('shifts')
      var savedCount = 0
      for (var gi = 0; gi < generatedShifts.length; gi++) {
        var gs = generatedShifts[gi]
        if (!gs.user_id || !gs.sector_id || !gs.start_time || !gs.end_time) continue

        var sectorValid = false
        for (var sj = 0; sj < sectors.length; sj++) {
          if (sectors[sj].id === gs.sector_id) {
            sectorValid = true
            break
          }
        }
        if (!sectorValid) continue

        var record = new Record(shiftsCol)
        record.set('user', gs.user_id)
        record.set('sector', gs.sector_id)
        record.set('cycle', cycleId)
        record.set('start_time', gs.start_time)
        record.set('end_time', gs.end_time)
        $app.save(record)
        savedCount++
      }

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

      return e.json(200, { success: true, count: savedCount })
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
