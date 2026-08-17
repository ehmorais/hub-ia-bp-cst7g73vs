// POST /backend/v1/escala/draft
// End-to-end AI draft generation for a single cycle + sector.
//
// Authority: this hook is the single source of truth for eligibility,
// rule classification, prompt construction, JSON validation and draft
// persistence. The formal "escala-expert" agent has NO write permission,
// so it is only consulted (optionally) for a diagnostic suggestion on
// failure; persistence always happens here, in the authorized backend.
//
// Hard guarantees:
//  - Eligibility: only active staff_profiles with a compatible
//    default_sector, a staff_role and EXACTLY ONE staff_contract.
//    Orphan contracts (staff_profile empty) are ignored, never counted.
//  - Contracts drive shift times (start_time + work_hours from the
//    contracted shift_type). The AI only picks user_id + date.
//  - JSON is validated against a strict schema; one repair attempt is
//    made on parse failure, then an actionable error is returned.
//  - The result is persisted as `shifts` records (the draft). The cycle
//    status is NEVER changed here (no auto-publish).
//  - Idempotency: if shifts already exist for cycle+sector and `replace`
//    is not true, the hook returns draft_exists so the UI can prompt.

routerAdd(
  'POST',
  '/backend/v1/escala/draft',
  (e) => {
    if (!e.auth || e.auth.getString('role') !== 'Admin') {
      return e.forbiddenError('Apenas administradores podem gerar rascunhos de escala.')
    }

    const body = e.requestInfo().body || {}
    const cycleId = body.cycle_id
    const sectorId = body.sector_id
    const additionalPrompt = body.additional_prompt || ''
    const currentDraft = body.current_draft || null
    const replace = body.replace === true
    // Priority/strictness may arrive at the top level (authoritative format)
    // or nested under body.context.ai_settings (legacy format the frontend
    // used to send). Resolve both so neither format silently drops values.
    var aiSettings = (body.context && body.context.ai_settings) || {}
    var priority = body.priority || aiSettings.priority || 'timeoff'
    var strictness =
      typeof body.strictness === 'number'
        ? body.strictness
        : typeof aiSettings.strictness === 'number'
          ? aiSettings.strictness
          : parseInt(body.strictness || aiSettings.strictness || '50', 10)

    if (!cycleId || !sectorId) {
      return e.badRequestError('cycle_id e sector_id são obrigatórios.')
    }

    var auditCol = $app.findCollectionByNameOrId('audit_logs')
    var logAudit = function (action, details, tokens) {
      try {
        var audit = new Record(auditCol)
        audit.set('user', e.auth ? e.auth.id : '')
        audit.set('action', action)
        audit.set('details', typeof details === 'string' ? details : JSON.stringify(details))
        if (tokens) audit.set('token_usage', tokens)
        $app.saveNoValidate(audit)
      } catch (_) {}
    }

    logAudit('AI_SHIFT_DRAFT_GENERATION', {
      status: 'started',
      cycle_id: cycleId,
      sector_id: sectorId,
      is_refinement: !!additionalPrompt,
      replace: replace,
    })

    // --- Load cycle + sector (authoritative) ---
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
      return e.badRequestError('O ciclo selecionado possui datas inválidas.')
    }
    if (cycle.getString('status') === 'closed') {
      return e.badRequestError('Não é permitido gerar escala para um ciclo encerrado.')
    }

    // --- Idempotency: existing draft for this cycle+sector ---
    var existingShifts = []
    try {
      existingShifts = $app.findRecordsByFilter(
        'shifts',
        'cycle={:cyc} && sector={:sec}',
        '-created',
        10000,
        0,
        { cyc: cycleId, sec: sectorId },
      )
    } catch (_) {}

    if (existingShifts.length > 0 && !replace && !additionalPrompt) {
      return e.json(200, {
        draft_exists: true,
        existing_count: existingShifts.length,
        cycle_id: cycleId,
        sector_id: sectorId,
      })
    }

    // --- Eligibility: active staff_profiles in this sector ---
    var profiles = $app.findRecordsByFilter(
      'staff_profiles',
      'default_sector={:sec} && active=true',
      'name',
      10000,
      0,
      { sec: sectorId },
    )

    var roles = $app.findRecordsByFilter('staff_roles', '', '-hierarchy_rank', 10000, 0)
    var roleMap = {}
    roles.forEach(function (r) {
      roleMap[r.id] = {
        name: r.getString('name'),
        rank: r.getInt('hierarchy_rank') || 0,
        requires_supervision: r.getBool('requires_supervision'),
      }
    })

    var contracts = $app.findRecordsByFilter('staff_contracts', '', '-updated', 10000, 0)
    // Map staff_profile -> [contracts]. Orphans (staff_profile empty) are
    // silently ignored — they are never treated as eligible.
    var contractsByProfile = {}
    var orphanContractCount = 0
    contracts.forEach(function (c) {
      var pid = c.getString('staff_profile')
      if (!pid) {
        orphanContractCount++
        return
      }
      if (!contractsByProfile[pid]) contractsByProfile[pid] = []
      contractsByProfile[pid].push(c)
    })

    var shiftTypes = $app.findRecordsByFilter('shift_types', '', 'name', 10000, 0)
    var shiftTypeMap = {}
    shiftTypes.forEach(function (st) {
      shiftTypeMap[st.id] = {
        id: st.id,
        name: st.getString('name'),
        code: st.getString('code'),
        work_hours: st.getInt('work_hours') || 12,
        rest_hours: st.getInt('rest_hours') || 36,
        start_time: st.getString('start_time') || '07:00',
        end_time: st.getString('end_time') || '',
        is_administrative: st.getBool('is_administrative'),
      }
    })

    var eligible = []
    var excluded = []
    profiles.forEach(function (p) {
      var roleId = p.getString('staff_role')
      var role = roleId ? roleMap[roleId] : null
      var profileContracts = contractsByProfile[p.id] || []

      if (!role) {
        excluded.push({ name: p.getString('name'), reason: 'sem cargo (staff_role)' })
        return
      }
      if (profileContracts.length === 0) {
        excluded.push({ name: p.getString('name'), reason: 'sem contrato vinculado' })
        return
      }
      if (profileContracts.length > 1) {
        excluded.push({
          name: p.getString('name'),
          reason: profileContracts.length + ' contratos vinculados (esperado exatamente 1)',
        })
        return
      }
      var c = profileContracts[0]
      if (
        !c.getString('contract_type') ||
        !c.getString('shift_type') ||
        (c.getInt('monthly_hour_limit') || 0) <= 0
      ) {
        excluded.push({ name: p.getString('name'), reason: 'contrato incompleto' })
        return
      }
      var st = shiftTypeMap[c.getString('shift_type')]
      if (!st) {
        excluded.push({ name: p.getString('name'), reason: 'tipo de turno inválido no contrato' })
        return
      }
      eligible.push({
        id: p.id,
        name: p.getString('name'),
        professional_id: p.getString('professional_id') || '',
        role: role.name,
        role_id: roleId,
        rank: role.rank,
        requires_supervision: role.requires_supervision,
        contract_type: c.getString('contract_type'),
        monthly_hour_limit: c.getInt('monthly_hour_limit') || 0,
        shift_type: st.name,
        shift_code: st.code,
        work_hours: st.work_hours,
        rest_hours: st.rest_hours,
        shift_start_time: st.start_time,
      })
    })

    if (eligible.length === 0) {
      return e.json(400, {
        error: 'Nenhum colaborador elegível para este setor.',
        diagnostics: {
          eligible_count: 0,
          excluded: excluded,
          orphan_contracts_ignored: orphanContractCount,
        },
      })
    }

    // --- Rules: load + classify (hard vs preferred) + contradictions ---
    var departmentId = sector.getString('department')
    var dbRules = []
    if (departmentId) {
      try {
        dbRules = $app.findRecordsByFilter(
          'shift_rules',
          'department={:dep}',
          '-created',
          10000,
          0,
          { dep: departmentId },
        )
      } catch (_) {}
    }

    var HARD_TYPES = {
      min_staff: true,
      min_rest_hours: true,
      max_hours: true,
      max_consecutive: true,
    }
    var hardRules = []
    var preferredRules = []
    var contradictions = []
    var restValues = {}
    var minStaffValues = {}
    var maxHoursValues = {}

    dbRules.forEach(function (r) {
      var type = r.getString('rule_type') || 'other'
      var entry = {
        id: r.id,
        name: r.getString('name') || 'Regra',
        type: type,
        value: r.getInt('value') || 0,
      }
      if (type === 'custom_prompt') entry.prompt = r.getString('prompt') || ''

      if (HARD_TYPES[type]) {
        hardRules.push(entry)
        if (type === 'min_rest_hours') restValues[entry.value] = true
        if (type === 'min_staff') minStaffValues[entry.value] = true
        if (type === 'max_hours') maxHoursValues[entry.value] = true
      } else {
        preferredRules.push(entry)
      }
    })

    if (Object.keys(restValues).length > 1) {
      contradictions.push(
        'Múltiplas regras de descanso mínimo com valores conflitantes: ' +
          Object.keys(restValues).join(', ') +
          'h. O maior valor será aplicado.',
      )
    }
    if (Object.keys(minStaffValues).length > 1) {
      contradictions.push(
        'Múltiplas regras de efetivo mínimo conflitantes: ' +
          Object.keys(minStaffValues).join(', ') +
          '. O maior valor será aplicado.',
      )
    }

    // Effective hard limits (sector config + rules, take the strictest).
    var sectorMinStaffing = sector.getInt('min_staffing') || 0
    var sectorIdealStaffing = sector.getInt('ideal_staffing') || sectorMinStaffing
    dbRules.forEach(function (r) {
      if (r.getString('rule_type') === 'min_staff') {
        var v = r.getInt('value') || 0
        if (v > sectorMinStaffing) sectorMinStaffing = v
      }
    })
    var effectiveRestHours = 11
    dbRules.forEach(function (r) {
      if (r.getString('rule_type') === 'min_rest_hours') {
        var v = r.getInt('value') || 0
        if (v > effectiveRestHours) effectiveRestHours = v
      }
    })
    // Also respect the contracted rest_hours if larger.
    eligible.forEach(function (u) {
      if (u.rest_hours > effectiveRestHours) effectiveRestHours = u.rest_hours
    })
    var effectiveMaxConsecutive = 0
    dbRules.forEach(function (r) {
      if (r.getString('rule_type') === 'max_consecutive') {
        var v = r.getInt('value') || 0
        if (v > effectiveMaxConsecutive) effectiveMaxConsecutive = v
      }
    })

    // --- Timeoffs for eligible profiles in this cycle ---
    var timeoffs = []
    try {
      timeoffs = $app.findRecordsByFilter(
        'timeoff_requests',
        "cycle={:cyc} && (status='pending' || status='fulfilled')",
        'date',
        10000,
        0,
        { cyc: cycleId },
      )
    } catch (_) {}
    var timeoffMap = {}
    timeoffs.forEach(function (t) {
      var pid = t.getString('staff_profile')
      if (!pid) return
      var start = (t.getString('date') || '').split(' ')[0]
      var end = (t.getString('end_date') || t.getString('date') || '').split(' ')[0]
      if (!start) return
      if (!timeoffMap[pid]) timeoffMap[pid] = []
      var cursor = new Date(start + 'T00:00:00Z')
      var last = new Date((end || start) + 'T00:00:00Z')
      while (cursor <= last) {
        timeoffMap[pid].push(cursor.toISOString().split('T')[0])
        cursor = new Date(cursor.getTime() + 86400000)
      }
    })

    // --- Build the prompt ---
    var eligibleForPrompt = eligible.map(function (u) {
      return {
        id: u.id,
        name: u.name,
        professional_id: u.professional_id,
        role: u.role,
        rank: u.rank,
        requires_supervision: u.requires_supervision,
        contract_type: u.contract_type,
        monthly_hour_limit: u.monthly_hour_limit,
        shift_type: u.shift_type,
        shift_code: u.shift_code,
        work_hours: u.work_hours,
        rest_hours: u.rest_hours,
        shift_start_time: u.shift_start_time,
        timeoffs: timeoffMap[u.id] || [],
      }
    })

    var sectorInfo = {
      id: sector.id,
      name: sector.getString('name'),
      min_staffing: sectorMinStaffing,
      ideal_staffing: sectorIdealStaffing,
      bed_capacity: sector.getInt('bed_capacity') || 0,
      staffing_ratio: sector.getInt('staffing_ratio') || 0,
      is_critical: sector.getBool('is_critical'),
    }

    var prompt = [
      'Você é um algoritmo especializado em escalas hospitalares.',
      'Gere uma escala de plantões para o ciclo e setor abaixo.',
      '',
      'CICLO (datas exatas, inclusivas):',
      '  início: ' + cycleStart,
      '  fim:    ' + cycleEnd,
      '',
      'SETOR:',
      JSON.stringify(sectorInfo, null, 2),
      '',
      'COLABORADORES ELEGÍVEIS (use EXATAMENTE estes IDs; não invente pessoas nem IDs):',
      JSON.stringify(eligibleForPrompt, null, 2),
      '',
      'REGRAS DURAS (NUNCA violar):',
      JSON.stringify(hardRules, null, 2),
      '',
      'REGRAS PREFERENCIAIS (otimizar quando possível):',
      JSON.stringify(preferredRules, null, 2),
      '',
      'PARÂMETROS:',
      '  - Strictness: ' + strictness + '%',
      '  - Prioridade: ' +
        (priority === 'timeoff'
          ? 'respeitar folgas estritamente acima do efetivo mínimo'
          : 'garantir efetivo mínimo, folgas ainda altamente priorizadas'),
      '  - Descanso efetivo mínimo entre plantões de um mesmo colaborador: ' +
        effectiveRestHours +
        'h',
      '  - Efetivo mínimo diário no setor: ' + sectorMinStaffing,
      '',
      'INSTRUÇÕES OBRIGATÓRIAS:',
      '1. Cada plantão deve respeitar o tipo de turno do contrato do colaborador ' +
        '(work_hours, rest_hours, shift_start_time). O backend aplicará os horários ' +
        'a partir do contrato — você deve informar apenas user_id e date.',
      '2. Não aloque um colaborador em qualquer dia de folga (timeoffs).',
      '3. Respeite o descanso mínimo entre plantões do mesmo colaborador ' +
        '(' +
        effectiveRestHours +
        'h). Para Plantão Noturno 12x36, o padrão é ' +
        'trabalhar 12h e descansar 36h (plantões a cada 2 dias).',
      '4. Não ultrapasse o monthly_hour_limit de cada colaborador.',
      '5. Garanta o efetivo mínimo diário (min_staffing) no setor.',
      '6. Um colaborador com requires_supervision=true não pode ficar sozinho no turno; ' +
        'deve haver outro colaborador que não exija supervisão no mesmo dia.',
      '7. Distribua a carga de forma equilibrada entre os elegíveis.',
      '8. NÃO invente IDs, pessoas, datas ou turnos. Use somente os IDs fornecidos. ' +
        'Datas devem estar dentro do intervalo do ciclo.',
      '',
      'RASCUNHO ATUAL (para refinamento, se houver):',
      currentDraft ? JSON.stringify(currentDraft, null, 2) : 'nenhum',
      '',
      'SOLICITAÇÃO DE REFINAMENTO DO USUÁRIO:',
      additionalPrompt || 'Gere uma escala ótima cobrindo todo o ciclo.',
      '',
      'FORMATO DE SAÍDA (estrito):',
      'Retorne SOMENTE um array JSON válido, sem markdown, sem comentários, sem texto adicional.',
      'Cada elemento deve ser exatamente: {"user_id":"<id>","date":"YYYY-MM-DD"}',
      'Onde user_id é um dos IDs elegíveis e date é um dia dentro do ciclo.',
    ].join('\n')

    // --- Call the AI ---
    // NOTE on model choice + timeout:
    //  - We use the `fast` model alias instead of `reasoning`. The `reasoning`
    //    model has a thinking budget and on a prompt this large (all eligible
    //    staff + contracts + rules + timeoffs) it consistently took ~240s,
    //    which the gateway kills with a 502 before the JS try/catch can fire.
    //    `fast` is orders of magnitude quicker and perfectly adequate here:
    //    the heavy correctness enforcement (rest hours, staffing, supervision,
    //    hour limits, timeoffs) is done in JS after the reply, not by the LLM.
    //  - The `$ai.chat` API does not expose a per-call timeout parameter
    //    (see the Skip AI gateway guide); the gateway timeout is fixed. We
    //    therefore rely on the faster model to stay well within it. If the
    //    gateway still times out, the catch below returns a structured error.
    var aiContent = ''
    var tokenUsage = 0
    try {
      var response = $ai.chat({
        model: 'fast',
        messages: [
          {
            role: 'system',
            content:
              'Você é uma API que responde SOMENTE com JSON válido. Sem markdown, sem explicações.',
          },
          { role: 'user', content: prompt },
        ],
      })
      if (response.usage) tokenUsage = response.usage.total_tokens || 0
      aiContent = (response.choices[0].message.content || '').trim()
    } catch (aiErr) {
      var aiErrMsg = (aiErr && aiErr.message) || String(aiErr)
      var isTimeout =
        aiErr &&
        (aiErr.status === 502 ||
          aiErr.status === 504 ||
          /timeout|timed out|deadline|gateway/i.test(aiErrMsg))
      logAudit('AI_SHIFT_DRAFT_GENERATION', {
        status: 'error',
        cycle_id: cycleId,
        sector_id: sectorId,
        error: 'AI call failed: ' + aiErrMsg,
        stage: isTimeout ? 'ai_timeout' : 'ai_call',
      })
      // Structured error so the frontend can show an actionable message.
      // 502 because that is what a gateway timeout surfaces as; the body
      // carries the stage so the UI can detect this specific failure.
      return e.json(502, {
        error: isTimeout
          ? 'A IA excedeu o tempo limite. Tente novamente com um setor menor ou menos colaboradores.'
          : 'A IA não respondeu a tempo. Tente novamente.',
        stage: isTimeout ? 'ai_timeout' : 'ai_call',
        detail: aiErrMsg,
      })
    }

    // --- Parse + one repair attempt ---
    var cleanContent = aiContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    if (cleanContent.startsWith('```json')) cleanContent = cleanContent.replace(/^```json/, '')
    if (cleanContent.startsWith('```')) cleanContent = cleanContent.replace(/^```/, '')
    if (cleanContent.endsWith('```')) cleanContent = cleanContent.replace(/```$/, '')
    cleanContent = cleanContent.trim()

    var draft = null
    var parseError = ''
    try {
      draft = JSON.parse(cleanContent)
    } catch (e1) {
      parseError = e1.message || String(e1)
      // One repair attempt: extract the first JSON array in the text.
      var match = cleanContent.match(/\[[\s\S]*\]/)
      if (match) {
        try {
          draft = JSON.parse(match[0])
          parseError = ''
        } catch (e2) {
          parseError = e2.message || String(e2)
        }
      }
    }

    if (!draft || !Array.isArray(draft)) {
      logAudit('AI_SHIFT_DRAFT_GENERATION', {
        status: 'error',
        cycle_id: cycleId,
        sector_id: sectorId,
        error: 'Invalid JSON: ' + parseError,
        raw_preview: cleanContent.substring(0, 500),
      })
      return e.json(400, {
        error:
          'A IA retornou um JSON inválido e não foi possível repará-lo automaticamente. ' +
          'Tente gerar novamente.',
        detail: parseError,
      })
    }

    // --- Schema validation against eligible set + cycle range ---
    var eligibleIds = {}
    eligible.forEach(function (u) {
      eligibleIds[u.id] = u
    })
    var cleanDraft = []
    var schemaErrors = []
    var seenKeys = {} // dedupe (user_id+date)

    draft.forEach(function (entry, idx) {
      if (!entry || typeof entry !== 'object') {
        schemaErrors.push('Entrada ' + (idx + 1) + ': não é um objeto.')
        return
      }
      var uid = entry.user_id || entry.staff_profile || ''
      var date = (entry.date || '').split(' ')[0]
      if (!uid || !date) {
        schemaErrors.push('Entrada ' + (idx + 1) + ': user_id e date são obrigatórios.')
        return
      }
      if (!eligibleIds[uid]) {
        schemaErrors.push('Entrada ' + (idx + 1) + ': user_id não é elegível: ' + uid)
        return
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        schemaErrors.push('Entrada ' + (idx + 1) + ': data inválida: ' + date)
        return
      }
      if (date < cycleStart || date > cycleEnd) {
        schemaErrors.push('Entrada ' + (idx + 1) + ': data fora do ciclo: ' + date)
        return
      }
      var key = uid + '|' + date
      if (seenKeys[key]) return // dedupe silently
      seenKeys[key] = true
      cleanDraft.push({ user_id: uid, date: date })
    })

    if (cleanDraft.length === 0) {
      return e.json(400, {
        error: 'A IA não retornou nenhum plantão válido.',
        violations: schemaErrors,
        diagnostics: {
          eligible_count: eligible.length,
          excluded: excluded,
          orphan_contracts_ignored: orphanContractCount,
          hard_rules: hardRules,
          preferred_rules: preferredRules,
          contradictions: contradictions,
        },
      })
    }

    // --- Hard-rule validation ---
    var userHours = {}
    var userShifts = {}
    var dayAssignments = {}
    var violations = []
    var warnings = []

    cleanDraft.forEach(function (entry) {
      var u = eligibleIds[entry.user_id]
      var st = u.shift_start_time || '07:00'
      if (st.length === 5) st = st + ':00'
      var startDate = new Date(entry.date + 'T' + st + '.000Z')
      var endDate = new Date(startDate.getTime() + u.work_hours * 3600000)

      // Timeoff check
      var tdays = timeoffMap[u.id] || []
      if (tdays.indexOf(entry.date) !== -1) {
        violations.push('Folga não respeitada: ' + u.name + ' em ' + entry.date + '.')
      }

      // Hours accumulation
      userHours[u.id] = (userHours[u.id] || 0) + u.work_hours
      if (userHours[u.id] > u.monthly_hour_limit) {
        violations.push(
          u.name +
            ' excede o limite mensal: ' +
            userHours[u.id] +
            'h de ' +
            u.monthly_hour_limit +
            'h.',
        )
      }

      if (!userShifts[u.id]) userShifts[u.id] = []
      userShifts[u.id].push({ start: startDate, end: endDate })

      if (!dayAssignments[entry.date]) dayAssignments[entry.date] = []
      dayAssignments[entry.date].push({
        id: u.id,
        name: u.name,
        rank: u.rank,
        requires_supervision: u.requires_supervision,
      })
    })

    // Rest hours + max consecutive
    Object.keys(userShifts).forEach(function (uid) {
      var u = eligibleIds[uid]
      var ordered = userShifts[uid].slice().sort(function (a, b) {
        return a.start.getTime() - b.start.getTime()
      })
      var consecutive = 0
      var prevDate = null
      for (var i = 0; i < ordered.length; i++) {
        if (i > 0) {
          var gap = (ordered[i].start.getTime() - ordered[i - 1].end.getTime()) / 3600000
          if (gap < 0) {
            violations.push(u.name + ' possui plantões sobrepostos.')
          } else if (gap < effectiveRestHours) {
            violations.push(
              u.name +
                ' tem apenas ' +
                Math.round(gap * 10) / 10 +
                'h de descanso (mínimo ' +
                effectiveRestHours +
                'h).',
            )
          }
        }
        // consecutive-day count (calendar days)
        var dStr = ordered[i].start.toISOString().split('T')[0]
        if (prevDate) {
          var diff =
            (new Date(dStr + 'T00:00:00Z').getTime() -
              new Date(prevDate + 'T00:00:00Z').getTime()) /
            86400000
          if (diff === 1) consecutive++
          else consecutive = 1
        } else {
          consecutive = 1
        }
        prevDate = dStr
        if (effectiveMaxConsecutive > 0 && consecutive > effectiveMaxConsecutive) {
          violations.push(u.name + ' excede ' + effectiveMaxConsecutive + ' plantões consecutivos.')
        }
      }
    })

    // Daily staffing + supervision
    var cursor = new Date(cycleStart + 'T00:00:00Z')
    var lastDay = new Date(cycleEnd + 'T00:00:00Z')
    while (cursor <= lastDay) {
      var dateKey = cursor.toISOString().split('T')[0]
      var assigns = dayAssignments[dateKey] || []
      if (assigns.length < sectorMinStaffing) {
        violations.push(
          'Efetivo insuficiente em ' +
            dateKey +
            ': ' +
            assigns.length +
            '/' +
            sectorMinStaffing +
            '.',
        )
      } else if (sectorIdealStaffing > 0 && assigns.length < sectorIdealStaffing) {
        warnings.push(
          'Efetivo abaixo do ideal em ' +
            dateKey +
            ': ' +
            assigns.length +
            '/' +
            sectorIdealStaffing +
            '.',
        )
      }
      assigns.forEach(function (a) {
        if (!a.requires_supervision) return
        var hasIndependent = assigns.some(function (c) {
          return c.id !== a.id && !c.requires_supervision
        })
        if (!hasIndependent) {
          violations.push(
            'Supervisão ausente em ' +
              dateKey +
              ' para ' +
              a.name +
              ' (sem profissional independente no turno).',
          )
        }
      })
      cursor = new Date(cursor.getTime() + 86400000)
    }

    violations = violations.filter(function (item, index, all) {
      return all.indexOf(item) === index
    })
    warnings = warnings.filter(function (item, index, all) {
      return all.indexOf(item) === index
    })

    var diagnostics = {
      eligible_count: eligible.length,
      excluded: excluded,
      orphan_contracts_ignored: orphanContractCount,
      hard_rules: hardRules,
      preferred_rules: preferredRules,
      contradictions: contradictions,
      effective_rest_hours: effectiveRestHours,
      effective_min_staffing: sectorMinStaffing,
      cycle_start: cycleStart,
      cycle_end: cycleEnd,
    }

    if (violations.length > 0) {
      logAudit('AI_SHIFT_DRAFT_GENERATION', {
        status: 'validation_failed',
        cycle_id: cycleId,
        sector_id: sectorId,
        violations: violations,
        draft_count: cleanDraft.length,
      })
      // Optionally ask the formal agent for a concise diagnostic
      // suggestion (read-only; the agent has no write permission).
      var suggestion = ''
      try {
        var helper = $ai.agent('escala-expert').chat({
          user_id: e.auth.id,
          message:
            'A geração de rascunho de escala falhou na validação com estas violações: ' +
            violations.slice(0, 6).join(' | ') +
            '. Sugira, em até 2 frases, uma causa provável e correção.',
        })
        suggestion = helper.content || ''
      } catch (_) {}

      return e.json(400, {
        error: 'O rascunho viola regras obrigatórias e não foi salvo.',
        violations: violations,
        warnings: warnings,
        diagnostics: diagnostics,
        suggestion: suggestion || undefined,
      })
    }

    // --- Persist as draft (shifts). Cycle status is NEVER changed. ---
    var persisted = []
    try {
      $app.runInTransaction(function (txApp) {
        var existing = txApp.findRecordsByFilter(
          'shifts',
          'cycle={:cyc} && sector={:sec}',
          '-created',
          10000,
          0,
          { cyc: cycleId, sec: sectorId },
        )
        existing.forEach(function (rec) {
          txApp.delete(rec)
        })

        var shiftsCol = txApp.findCollectionByNameOrId('shifts')
        cleanDraft.forEach(function (entry) {
          var u = eligibleIds[entry.user_id]
          var st = u.shift_start_time || '07:00'
          if (st.length === 5) st = st + ':00'
          var startDate = new Date(entry.date + 'T' + st + '.000Z')
          var endDate = new Date(startDate.getTime() + u.work_hours * 3600000)
          var startStr = startDate.toISOString().replace('T', ' ').substring(0, 23) + 'Z'
          var endStr = endDate.toISOString().replace('T', ' ').substring(0, 23) + 'Z'

          var record = new Record(shiftsCol)
          record.set('staff_profile', entry.user_id)
          record.set('sector', sectorId)
          record.set('cycle', cycleId)
          record.set('start_time', startStr)
          record.set('end_time', endStr)
          txApp.save(record)
          persisted.push({
            staff_profile: entry.user_id,
            name: u.name,
            sector: sectorId,
            cycle: cycleId,
            start_time: startStr,
            end_time: endStr,
          })
        })
      })
    } catch (persistErr) {
      logAudit('AI_SHIFT_DRAFT_GENERATION', {
        status: 'error',
        cycle_id: cycleId,
        sector_id: sectorId,
        error: 'Persist failed: ' + (persistErr.message || String(persistErr)),
      })
      return e.json(500, {
        error: 'Falha ao salvar o rascunho. Nenhum dado anterior foi alterado.',
        detail: persistErr.message || String(persistErr),
      })
    }

    logAudit(
      'AI_SHIFT_DRAFT_GENERATION',
      {
        status: 'success',
        cycle_id: cycleId,
        sector_id: sectorId,
        draft_count: persisted.length,
        warnings: warnings,
      },
      tokenUsage,
    )

    return e.json(200, {
      success: true,
      draft: persisted,
      warnings: warnings.length > 0 ? warnings : undefined,
      diagnostics: diagnostics,
      cycle_id: cycleId,
      sector_id: sectorId,
    })
  },
  $apis.requireAuth(),
)
