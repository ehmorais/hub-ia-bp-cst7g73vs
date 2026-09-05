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

    // --- Generation run tracking (schedule_generation_runs) ---
    // Sanitization helper: strips anything that looks like a name/PII from
    // a free-text detail before persisting to error_detail (cap 500 chars).
    var sanitizeDetail = function (text) {
      var s = typeof text === 'string' ? text : String(text || '')
      try {
        // Drop anything inside quotes ("name" or 'name') and collapse runs.
        s = s.replace(/"[^"]*"/g, '"…"').replace(/'[^']*'/g, "'…'")
      } catch (_) {}
      if (s.length > 500) s = s.substring(0, 500)
      return s
    }

    // Infer a structured {rule_name, code, date, staff_id} from a free-text
    // violation/warning message. Used when persisting validation_issues so the
    // dashboard can filter/group by rule type. Coverage messages produced by
    // this hook use the prefixes "Efetivo insuficiente" (hard, below
    // min_staffing) and "Efetivo abaixo do ideal" (preference, below
    // ideal_staffing but at/above min_staffing). Without this mapping they all
    // came back as rule_name:'other', which hid them from the min_staff view
    // and made them indistinguishable from generic warnings.
    var inferIssue = function (message, profiles) {
      var m = typeof message === 'string' ? message : String(message || '')
      var result = { rule_name: 'other', code: 'OTHER', date: '', staff_id: '' }
      try {
        var dm = m.match(/(\d{4}-\d{2}-\d{2})/)
        if (dm) result.date = dm[1]
      } catch (_) {}

      var lower = m.toLowerCase()
      if (
        lower.indexOf('fim de semana') !== -1 ||
        lower.indexOf('weekend_off') !== -1 ||
        lower.indexOf('weekend') !== -1
      ) {
        result.rule_name = 'weekend_off'
        result.code = 'WEEKEND_OFF'
      } else if (
        lower.indexOf('efetivo insuficiente') !== -1 ||
        lower.indexOf('abaixo do mínimo') !== -1 ||
        lower.indexOf('abaixo do minimo') !== -1
      ) {
        result.rule_name = 'min_staff'
        result.code = 'MIN_STAFF'
      } else if (lower.indexOf('abaixo do ideal') !== -1) {
        // Below ideal but at/above min_staffing → preference, still min_staff
        // family so it groups with the coverage rule on the dashboard.
        result.rule_name = 'min_staff'
        result.code = 'IDEAL_STAFF'
      } else if (
        lower.indexOf('supervisão ausente') !== -1 ||
        lower.indexOf('supervisao ausente') !== -1
      ) {
        result.rule_name = 'professional_mix'
        result.code = 'SUPERVISION'
      } else if (lower.indexOf('descanso') !== -1 || lower.indexOf('mínimo') !== -1) {
        if (lower.indexOf('descanso') !== -1) {
          result.rule_name = 'min_rest_hours'
          result.code = 'MIN_REST'
        }
      } else if (lower.indexOf('consecutivos') !== -1 || lower.indexOf('consecutivas') !== -1) {
        result.rule_name = 'max_consecutive'
        result.code = 'MAX_CONSECUTIVE'
      } else if (lower.indexOf('folga') !== -1) {
        result.rule_name = 'timeoff'
        result.code = 'TIMEOFF'
      } else if (lower.indexOf('limite mensal') !== -1 || lower.indexOf('excede') !== -1) {
        result.rule_name = 'max_hours'
        result.code = 'MAX_HOURS'
      } else if (
        lower.indexOf('sobrepostos') !== -1 ||
        lower.indexOf('conflito de horários') !== -1
      ) {
        result.rule_name = 'overlap'
        result.code = 'OVERLAP'
      }
      return result
    }

    // Update an existing run record to a new status/stage. Safe to call
    // before runId is set (no-op). Wrapped so a logging failure never
    // shadows the real error path.
    var runId = ''
    var updateRun = function (patch) {
      if (!runId) return
      try {
        var rec = $app.findRecordById('schedule_generation_runs', runId)
        if (patch.status) rec.set('status', patch.status)
        if (typeof patch.stage === 'string') rec.set('stage', patch.stage)
        if (typeof patch.progress === 'number') rec.set('progress', patch.progress)
        if (typeof patch.generation_source === 'string')
          rec.set('generation_source', patch.generation_source)
        if (typeof patch.error_code === 'string') rec.set('error_code', patch.error_code)
        if (typeof patch.error_detail === 'string')
          rec.set('error_detail', sanitizeDetail(patch.error_detail))
        if (typeof patch.finished_at !== 'undefined') rec.set('finished_at', patch.finished_at)
        if (typeof patch.duration_ms !== 'undefined') rec.set('duration_ms', patch.duration_ms)
        if (typeof patch.metrics !== 'undefined') rec.set('metrics', patch.metrics)
        if (typeof patch.ai_diagnostics !== 'undefined')
          rec.set('ai_diagnostics', patch.ai_diagnostics)
        $app.saveNoValidate(rec)
      } catch (_) {}
    }

    // Create the run now (after cycleId/sectorId validated) so every later
    // step is traceable. Concurrency & Stale Lock Management:
    // If a non-terminal run exists for this cycle+sector pair:
    //  - If it is older than 5 minutes (300.000 ms), treat as stale lock/orphan:
    //    mark it atomically as failed (stage: 'lock_timeout', error_code: 'ORPHAN_LOCK_EXPIRED')
    //    and allow the new generation to proceed, notifying the UI.
    //  - If it is active (< 5 minutes), reject with 409.
    var LOCK_TTL_MS = 300000 // 5 minutes
    var recoveredStaleLock = false
    var recoveredRunId = ''
    var nowTs = new Date().getTime()

    try {
      var inFlightRuns = $app.findRecordsByFilter(
        'schedule_generation_runs',
        'cycle={:cyc} && sector={:sec}',
        '-created',
        100,
        0,
        { cyc: cycleId, sec: sectorId },
      )
      for (var ri = 0; ri < inFlightRuns.length; ri++) {
        var existingRec = inFlightRuns[ri]
        var st = existingRec.getString('status')
        if (st !== 'failed' && st !== 'cancelled' && st !== 'completed') {
          var existingRunId = existingRec.id
          var rawTimestamp =
            existingRec.getString('started_at') ||
            existingRec.getString('updated') ||
            existingRec.getString('created') ||
            ''
          var recordTime = rawTimestamp ? new Date(rawTimestamp.replace(' ', 'T')).getTime() : 0
          var ageMs = recordTime > 0 ? nowTs - recordTime : Number.MAX_SAFE_INTEGER

          if (ageMs > LOCK_TTL_MS) {
            // Lock stale/órfão: finalizar atomicamente como failed
            try {
              existingRec.set('status', 'failed')
              existingRec.set('stage', 'lock_timeout')
              existingRec.set('error_code', 'ORPHAN_LOCK_EXPIRED')
              existingRec.set(
                'error_detail',
                'Execução anterior sem resposta expirou após 5 minutos e foi encerrada.',
              )
              existingRec.set('finished_at', new Date().toISOString())
              $app.saveNoValidate(existingRec)
              recoveredStaleLock = true
              recoveredRunId = existingRunId
            } catch (_) {}
          } else {
            // Lock ativo recente (< 5 min)
            return e.json(409, {
              draft_exists: true,
              existing_run_id: existingRunId,
              run_id: existingRunId,
              message: 'Geração em andamento para este ciclo/setor. Aguarde…',
            })
          }
        }
      }
    } catch (_) {}

    var idempotencyKey = cycleId + '|' + sectorId + '|' + nowTs
    try {
      var runsCol = $app.findCollectionByNameOrId('schedule_generation_runs')
      var runRec = new Record(runsCol)
      runRec.set('cycle', cycleId)
      runRec.set('sector', sectorId)
      runRec.set('requested_by', e.auth ? e.auth.id : '')
      runRec.set('status', 'validating')
      runRec.set('stage', 'Iniciando validação de pré-requisitos')
      runRec.set('progress', 0)
      runRec.set('model', 'fast')
      runRec.set('generation_source', 'ai')
      runRec.set('priority', priority)
      runRec.set('strictness', strictness)
      runRec.set('idempotency_key', idempotencyKey)
      runRec.set('started_at', new Date().toISOString())
      $app.saveNoValidate(runRec)
      runId = runRec.id
    } catch (runErr) {
      // If we cannot create the run, we still proceed with the legacy
      // behavior (no tracking) rather than blocking generation entirely.
      console.log('[escala/draft] failed to create generation_run: ' + (runErr.message || runErr))
    }

    logAudit('AI_SHIFT_DRAFT_GENERATION', {
      status: 'started',
      cycle_id: cycleId,
      sector_id: sectorId,
      is_refinement: !!additionalPrompt,
      replace: replace,
      run_id: runId || undefined,
    })

    // --- Load cycle + sector (authoritative) ---
    var cycle
    var sector
    try {
      cycle = $app.findRecordById('shift_cycles', cycleId)
      sector = $app.findRecordById('hospital_sectors', sectorId)
    } catch (_) {
      updateRun({
        status: 'failed',
        stage: 'invalid_cycle_or_sector',
        error_code: 'INVALID_CYCLE_OR_SECTOR',
        error_detail: 'Ciclo ou setor inválido.',
        finished_at: new Date().toISOString(),
      })
      return e.badRequestError('Ciclo ou setor inválido.')
    }

    var cycleStart = (cycle.getString('start_date') || '').split(' ')[0]
    var cycleEnd = (cycle.getString('end_date') || '').split(' ')[0]
    if (!cycleStart || !cycleEnd || cycleStart > cycleEnd) {
      updateRun({
        status: 'failed',
        stage: 'invalid_cycle_dates',
        error_code: 'INVALID_CYCLE_DATES',
        error_detail: 'O ciclo selecionado possui datas inválidas.',
        finished_at: new Date().toISOString(),
      })
      return e.badRequestError('O ciclo selecionado possui datas inválidas.')
    }
    if (cycle.getString('status') === 'closed') {
      updateRun({
        status: 'failed',
        stage: 'cycle_closed',
        error_code: 'CYCLE_CLOSED',
        error_detail: 'Não é permitido gerar escala para um ciclo encerrado.',
        finished_at: new Date().toISOString(),
      })
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
      // Cancel this run — no work to do, an existing draft is present.
      updateRun({
        status: 'cancelled',
        stage: 'existing_draft',
        error_code: 'EXISTING_DRAFT',
        error_detail: 'Já existe um rascunho para este ciclo/setor.',
        progress: 0,
        finished_at: new Date().toISOString(),
      })
      // Try to surface the run/draft the existing shifts belong to.
      var existingRunId2 = ''
      var existingDraftId = ''
      try {
        existingRunId2 = existingShifts[0].getString('generation_run') || ''
        existingDraftId = existingShifts[0].getString('draft') || ''
      } catch (_) {}
      return e.json(200, {
        draft_exists: true,
        existing_count: existingShifts.length,
        cycle_id: cycleId,
        sector_id: sectorId,
        run_id: runId || existingRunId2 || undefined,
        existing_run_id: existingRunId2 || undefined,
        existing_draft_id: existingDraftId || undefined,
      })
    }

    updateRun({ stage: 'Verificando elegibilidade dos colaboradores...' })

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
      var wHours = st.getInt('work_hours') || 12
      var rHours = st.getInt('rest_hours') || 36
      var sStart = st.getString('start_time') || ''
      var sEnd = st.getString('end_time') || ''

      // Resiliência para tipos de turno com horários vazios (ex: 12x36 padrão)
      if (!sStart) {
        if (wHours === 12 && rHours >= 36) {
          sStart = '07:00'
        } else {
          sStart = '07:00'
        }
      }
      if (!sEnd) {
        if (wHours === 12 && rHours >= 36 && sStart === '07:00') {
          sEnd = '19:00'
        } else {
          var sHour = parseInt(sStart.split(':')[0], 10) || 7
          var eHour = (sHour + wHours) % 24
          sEnd = (eHour < 10 ? '0' + eHour : '' + eHour) + ':00'
        }
      }

      shiftTypeMap[st.id] = {
        id: st.id,
        name: st.getString('name'),
        code: st.getString('code'),
        work_hours: wHours,
        rest_hours: rHours,
        start_time: sStart,
        end_time: sEnd,
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
      var profileParity = p.getString('shift_parity') || ''
      var profileCycleStart = (p.getString('cycle_start_date') || '').split(' ')[0].split('T')[0]
      var profileVacationEnabled = p.getBool('vacation_enabled')
      var profileVacationStart = (p.getString('vacation_start') || '').split(' ')[0].split('T')[0]
      var profileVacationEnd = (p.getString('vacation_end') || '').split(' ')[0].split('T')[0]
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
        shift_parity: profileParity,
        cycle_start_date: profileCycleStart,
        vacation_enabled: profileVacationEnabled,
        vacation_start: profileVacationStart,
        vacation_end: profileVacationEnd,
      })
    })

    if (eligible.length === 0) {
      var excludedSummary = excluded
        .map(function (item) {
          return item.name + ': ' + item.reason
        })
        .join('; ')
      var detailMsg =
        'Nenhum colaborador elegível para este setor' +
        (excludedSummary ? ' (motivos: ' + excludedSummary + ')' : '.')

      updateRun({
        status: 'failed',
        stage: 'no_eligible_staff',
        error_code: 'NO_ELIGIBLE_STAFF',
        error_detail: detailMsg,
        finished_at: new Date().toISOString(),
      })
      return e.json(400, {
        error: detailMsg,
        stage: 'no_eligible_staff',
        run_id: runId || undefined,
        diagnostics: {
          eligible_count: 0,
          excluded: excluded,
          orphan_contracts_ignored: orphanContractCount,
        },
      })
    }

    updateRun({ stage: 'Classificando regras (duras vs preferenciais)...' })

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
    var customRules = []
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
      if (type === 'custom_prompt') {
        entry.prompt = r.getString('prompt') || ''
        entry.priority = 'override'
        customRules.push(entry)
      } else if (HARD_TYPES[type]) {
        hardRules.push(entry)
        if (type === 'min_rest_hours') restValues[entry.value] = true
        if (type === 'min_staff') minStaffValues[entry.value] = true
        if (type === 'max_hours') maxHoursValues[entry.value] = true
      } else {
        preferredRules.push(entry)
      }
    })

    if (customRules.length > 0) {
      contradictions.push(
        'Há ' +
          customRules.length +
          ' regra(s) customizada(s) de prioridade máxima. Em conflitos, elas prevalecem sobre descanso, carga horária e sequência; a exceção será registrada como aviso.',
      )
    }

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

    // Existing shifts in another sector make the collaborator unavailable on
    // that date. Ignoring them allowed validation to pass and then hit the
    // unique staff_profile+cycle+start_time index during persistence.
    var otherSectorShiftMap = {}
    try {
      var otherSectorShifts = $app.findRecordsByFilter(
        'shifts',
        "cycle={:cyc} && sector!={:sec} && staff_profile!=''",
        'start_time',
        10000,
        0,
        { cyc: cycleId, sec: sectorId },
      )
      otherSectorShifts.forEach(function (shift) {
        var shiftedProfile = shift.getString('staff_profile')
        var shiftedDate = (shift.getString('start_time') || '').split(' ')[0]
        if (!shiftedProfile || !shiftedDate) return
        if (!otherSectorShiftMap[shiftedProfile]) otherSectorShiftMap[shiftedProfile] = []
        if (otherSectorShiftMap[shiftedProfile].indexOf(shiftedDate) === -1) {
          otherSectorShiftMap[shiftedProfile].push(shiftedDate)
        }
      })
    } catch (_) {}

    // --- Férias (staff_profiles: vacation_enabled + vacation_start..vacation_end inclusive) ---
    var vacationMap = {}
    eligible.forEach(function (u) {
      vacationMap[u.id] = []
      if (
        u.vacation_enabled === true &&
        u.vacation_start &&
        u.vacation_end &&
        u.vacation_start <= u.vacation_end
      ) {
        var vCur = new Date(u.vacation_start + 'T00:00:00Z')
        var vLast = new Date(u.vacation_end + 'T00:00:00Z')
        while (vCur <= vLast) {
          vacationMap[u.id].push(vCur.toISOString().split('T')[0])
          vCur = new Date(vCur.getTime() + 86400000)
        }
      }
    })

    var unavailableMap = {}
    eligible.forEach(function (u) {
      unavailableMap[u.id] = []
      ;(timeoffMap[u.id] || []).forEach(function (date) {
        if (unavailableMap[u.id].indexOf(date) === -1) unavailableMap[u.id].push(date)
      })
      ;(otherSectorShiftMap[u.id] || []).forEach(function (date) {
        if (unavailableMap[u.id].indexOf(date) === -1) unavailableMap[u.id].push(date)
      })
      ;(vacationMap[u.id] || []).forEach(function (date) {
        if (unavailableMap[u.id].indexOf(date) === -1) unavailableMap[u.id].push(date)
      })
    })

    // --- Build the prompt ---
    var eligibleForPrompt = eligible.map(function (u) {
      var is12x36 = u.work_hours === 12 && u.rest_hours >= 36
      var weekendOffSundays = []
      if (is12x36) {
        var stepDays = Math.max(2, Math.round((u.work_hours + u.rest_hours) / 24))
        var cursor = new Date(cycleStart + 'T00:00:00Z')
        var end = new Date(cycleEnd + 'T00:00:00Z')
        var dayIdx = 0
        while (cursor <= end) {
          var dow = cursor.getUTCDay() // 0 = Sun
          var dStr = cursor.toISOString().split('T')[0]
          if (dow === 0) {
            // Check if this Sunday falls on an alternating work step from cycleStart
            if (dayIdx % stepDays === 0) {
              weekendOffSundays.push(dStr)
            }
          }
          cursor = new Date(cursor.getTime() + 86400000)
          dayIdx++
        }
      }

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
        weekend_off_sundays: weekendOffSundays,
        timeoffs: timeoffMap[u.id] || [],
        vacations: vacationMap[u.id] || [],
        other_sector_shifts: otherSectorShiftMap[u.id] || [],
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
      'REGRAS CUSTOMIZADAS DE PRIORIDADE MÁXIMA (SOBRESCRITAS EXPLÍCITAS):',
      customRules.length > 0 ? JSON.stringify(customRules, null, 2) : 'nenhuma',
      'Se houver conflito entre uma regra customizada e uma regra geral de descanso, 12x36, ' +
        'carga horária ou sequência, cumpra a regra customizada. Reorganize os demais plantões ' +
        'para reduzir o impacto da exceção.',
      '',
      'REGRAS DURAS DE SEGURANÇA E INTEGRIDADE:',
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
      '0. Regras customizadas têm prioridade máxima. Elas podem sobrescrever descanso, ' +
        'padrão 12x36, carga horária e sequência quando necessário. Nunca invente IDs/datas e ' +
        'mantenha efetivo mínimo, supervisão e folgas formalmente registradas.',
      '1. Cada plantão deve respeitar o tipo de turno do contrato do colaborador ' +
        '(work_hours, rest_hours, shift_start_time). O backend aplicará os horários ' +
        'a partir do contrato — você deve informar apenas user_id e date.',
      '2. Não aloque um colaborador em qualquer dia de folga (timeoffs), férias (vacations) nem em ' +
        'datas já ocupadas em outro setor (other_sector_shifts).',
      '3. Respeite o descanso mínimo entre plantões do mesmo colaborador ' +
        '(' +
        effectiveRestHours +
        'h). Para Plantão Noturno 12x36, o padrão é ' +
        'trabalhar 12h e descansar 36h (plantões a cada 2 dias).',
      '4. Não ultrapasse o monthly_hour_limit de cada colaborador.',
      '5. Garanta o efetivo mínimo diário (min_staffing) no setor.',
      '6. Um colaborador com requires_supervision=true não pode ficar sozinho no turno; ' +
        'deve haver outro colaborador que não exija supervisão no mesmo dia.',
      '7. Para cada colaborador com contrato 12x36, preencha a sequência completa de dias alternados durante todo o ciclo, até o limite mensal. Não pare ao atingir apenas o efetivo mínimo ou ideal do setor.',
      '8. Distribua as duas alternâncias do 12x36 de forma equilibrada entre os dias pares e ímpares.',
      '9. NÃO invente IDs, pessoas, datas ou turnos. Use somente os IDs fornecidos. ' +
        'Datas devem estar dentro do intervalo do ciclo.',
      '10. Cada colaborador deve ter pelo menos 1 fim de semana completo (sábado E domingo consecutivos) de folga em cada mês-calendário. Para colaboradores 12x36, o domingo escolhido deve ser um que seria naturalmente trabalhado na rotação — não vale domingo que já cairia como folga pelo padrão alternado.',
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

    updateRun({ progress: 20 })

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
    //    gateway still times out OR returns an unparseable reply, we fall
    //    through to the deterministic fallback below (no second AI call).
    updateRun({ status: 'generating', stage: 'Consultando IA (modelo fast)...', progress: 40 })

    var aiContent = ''
    var tokenUsage = 0
    var aiCallFailed = false
    var aiCallError = ''
    var aiTimeout = false
    // AI diagnostics (sanitized — structural only, never the prompt or PII).
    var aiDiagnostics = {
      response_type: 'none',
      response_keys: [],
      content_length: 0,
      content_preview: '',
      extraction_method: 'none',
      parse_error_stage: 'none',
    }
    var extractionMethod = 'none'
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

      // --- Instrumentation (sanitized: structure + keys only, never PII) ---
      try {
        aiDiagnostics.response_type = typeof response
        aiDiagnostics.response_keys =
          response && typeof response === 'object' ? Object.keys(response) : []
        console.log(
          '[escala/draft] $ai.chat response typeof=' +
            aiDiagnostics.response_type +
            ' keys=[' +
            aiDiagnostics.response_keys.join(',') +
            ']',
        )
      } catch (_) {}

      if (response && response.usage) tokenUsage = response.usage.total_tokens || 0

      // --- Robust content extraction.
      // The OpenAI-shaped path (choices[0].message.content) is the documented
      // shape, but the gateway/runtime may surface a different object; try
      // every reasonable fallback before treating the reply as empty. If
      // `response.choices` is undefined we used to silently get "" and fail —
      // now we probe alternatives and log what we actually received.
      var extracted = ''
      if (response && typeof response === 'object') {
        try {
          if (
            response.choices &&
            response.choices[0] &&
            response.choices[0].message &&
            response.choices[0].message.content
          ) {
            extracted = response.choices[0].message.content
            extractionMethod = 'choices[0].message.content'
          } else if (response.content) {
            extracted = response.content
            extractionMethod = 'response.content'
          } else if (response.message && response.message.content) {
            extracted = response.message.content
            extractionMethod = 'response.message.content'
          } else if (response.text) {
            extracted = response.text
            extractionMethod = 'response.text'
          }
        } catch (_) {
          extracted = ''
        }
      } else if (typeof response === 'string') {
        extracted = response
        extractionMethod = 'string'
      }
      aiContent = (extracted || '').trim()
      aiDiagnostics.content_length = aiContent.length
      // Sanitized preview — the prompt only asks for {user_id, date} JSON
      // (IDs, not personal data), so a short structural preview is safe.
      aiDiagnostics.content_preview = aiContent.substring(0, 200)
      aiDiagnostics.extraction_method = extractionMethod
      updateRun({ ai_diagnostics: aiDiagnostics })

      // Sanitized preview of the actual content. The prompt only ever asked
      // for {user_id, date} JSON — these are IDs, not personal data — so a
      // short structural preview is safe and essential for debugging.
      try {
        console.log('[escala/draft] aiContent preview (300c): ' + aiContent.substring(0, 300))
      } catch (_) {}
    } catch (aiErr) {
      aiCallFailed = true
      aiCallError = (aiErr && aiErr.message) || String(aiErr)
      aiTimeout = !!(
        aiErr &&
        (aiErr.status === 502 ||
          aiErr.status === 504 ||
          /timeout|timed out|deadline|gateway/i.test(aiCallError))
      )
      console.log('[escala/draft] $ai.chat threw: ' + aiCallError + ' (timeout=' + aiTimeout + ')')
      logAudit('AI_SHIFT_DRAFT_GENERATION', {
        status: 'error',
        cycle_id: cycleId,
        sector_id: sectorId,
        error: 'AI call failed: ' + aiCallError,
        stage: aiTimeout ? 'ai_timeout' : 'ai_call',
      })
      // Record the failure stage on the run diagnostics (no PII).
      aiDiagnostics.parse_error_stage = aiTimeout ? 'ai_timeout' : 'ai_call_failed'
      updateRun({ ai_diagnostics: aiDiagnostics })
      // Do NOT return yet — fall through to the deterministic fallback so the
      // user still gets a usable draft. The fallback warning will surface.
    }

    // --- Robust JSON extraction (only meaningful if we have AI content) ---
    var draft = null
    var parseError = ''
    var source = 'ai' // 'ai' | 'fallback'

    if (aiContent) {
      // 1. Strip <think> blocks and markdown fences.
      var cleanContent = aiContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      cleanContent = cleanContent
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim()

      // 2. Try parsing the whole thing.
      try {
        draft = JSON.parse(cleanContent)
        if (parseError === '') {
          // success on direct parse
        }
      } catch (e1) {
        parseError = e1.message || String(e1)
        aiDiagnostics.parse_error_stage = 'direct_parse'
        // 3. Trim to the first '[' ... last ']' span (drop prose around it).
        var firstBracket = cleanContent.indexOf('[')
        var lastBracket = cleanContent.lastIndexOf(']')
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
          var sliced = cleanContent.substring(firstBracket, lastBracket + 1)
          try {
            draft = JSON.parse(sliced)
            parseError = ''
            aiDiagnostics.parse_error_stage = 'none'
          } catch (e2) {
            parseError = e2.message || String(e2)
            aiDiagnostics.parse_error_stage = 'bracket_slice'
          }
        }
        // 4. Regex match a JSON array anywhere in the text.
        if (!draft) {
          var match = cleanContent.match(/\[[\s\S]*\]/)
          if (match) {
            try {
              draft = JSON.parse(match[0])
              parseError = ''
              aiDiagnostics.parse_error_stage = 'none'
            } catch (e3) {
              parseError = e3.message || String(e3)
              aiDiagnostics.parse_error_stage = 'regex_match'
            }
          }
        }
        // 5. Locate individual shift objects and assemble an array manually.
        if (!draft) {
          var objs = cleanContent.match(/\{[^{}]*"user_id"[^{}]*"date"[^{}]*\}/g)
          if (!objs) objs = cleanContent.match(/\{[^{}]*"date"[^{}]*"user_id"[^{}]*\}/g)
          if (objs && objs.length) {
            var assembled = []
            for (var oi = 0; oi < objs.length; oi++) {
              try {
                assembled.push(JSON.parse(objs[oi]))
              } catch (_) {}
            }
            if (assembled.length) {
              draft = assembled
              parseError = ''
              aiDiagnostics.parse_error_stage = 'none'
            }
          }
        }
        if (!draft) aiDiagnostics.parse_error_stage = 'all_failed'
      }
      updateRun({ ai_diagnostics: aiDiagnostics })
    }

    // A syntactically valid AI array may still be unusable (for example,
    // every date can be outside the selected cycle). Treat a draft with no
    // valid entry or without minimum daily coverage exactly like invalid JSON,
    // so the deterministic fallback can still deliver a usable schedule.
    var preliminaryEligibleIds = {}
    eligible.forEach(function (u) {
      preliminaryEligibleIds[u.id] = true
    })
    var preliminaryDayCounts = {}
    var preliminarySeen = {}
    if (Array.isArray(draft)) {
      draft.forEach(function (entry) {
        if (!entry || typeof entry !== 'object') return
        var preliminaryUid = entry.user_id || entry.staff_profile || ''
        var preliminaryDate = (entry.date || '').split(' ')[0]
        if (!preliminaryEligibleIds[preliminaryUid]) return
        if (!/^\d{4}-\d{2}-\d{2}$/.test(preliminaryDate)) return
        if (preliminaryDate < cycleStart || preliminaryDate > cycleEnd) return
        if ((unavailableMap[preliminaryUid] || []).indexOf(preliminaryDate) !== -1) return
        var preliminaryKey = preliminaryUid + '|' + preliminaryDate
        if (preliminarySeen[preliminaryKey]) return
        preliminarySeen[preliminaryKey] = true
        preliminaryDayCounts[preliminaryDate] = (preliminaryDayCounts[preliminaryDate] || 0) + 1
      })
    }

    var preliminaryCoverageOk = Array.isArray(draft) && Object.keys(preliminarySeen).length > 0
    if (preliminaryCoverageOk && sectorMinStaffing > 0) {
      var preliminaryCursor = new Date(cycleStart + 'T00:00:00Z')
      var preliminaryEnd = new Date(cycleEnd + 'T00:00:00Z')
      while (preliminaryCursor <= preliminaryEnd) {
        var preliminaryDay = preliminaryCursor.toISOString().split('T')[0]
        if ((preliminaryDayCounts[preliminaryDay] || 0) < sectorMinStaffing) {
          preliminaryCoverageOk = false
          break
        }
        preliminaryCursor = new Date(preliminaryCursor.getTime() + 86400000)
      }
    }

    if (!draft || !Array.isArray(draft) || !preliminaryCoverageOk) {
      // --- Deterministic fallback (NO second AI call).
      // Generates a 12x36 night-shift draft directly in the backend,
      // respecting timeoffs, min rest (effectiveRestHours → ~36h ⇒ 2-day
      // gap), monthly hour limit, min staffing and supervision. The result
      // goes through the SAME hard-rule validation below; on success it is
      // returned with a warning so the user knows the AI was bypassed.
      source = 'fallback'
      updateRun({
        status: 'fallback',
        stage: 'IA não retornou JSON válido — usando fallback determinístico',
        generation_source: 'deterministic',
        progress: 50,
      })
      logAudit('AI_SHIFT_DRAFT_GENERATION', {
        status: 'fallback',
        cycle_id: cycleId,
        sector_id: sectorId,
        reason: aiCallFailed
          ? 'ai_call_failed'
          : !preliminaryCoverageOk
            ? 'invalid_cycle_coverage'
            : 'invalid_json',
        error: aiCallFailed ? aiCallError : parseError,
        ai_content_preview: aiContent ? aiContent.substring(0, 200) : '',
      })
      console.log(
        '[escala/draft] using deterministic fallback (aiCallFailed=' +
          aiCallFailed +
          ', coverageOk=' +
          preliminaryCoverageOk +
          ', parseError=' +
          parseError +
          ')',
      )

      // Local eligible map (eligibleIds is built further down, so build our
      // own here — hook scoping rules require everything inline).
      var fbEligibleMap = {}
      eligible.forEach(function (u) {
        fbEligibleMap[u.id] = u
      })

      var fbDraft = []
      var fbUserHours = {}
      var fbLastDay = {} // uid -> last worked YYYY-MM-DD
      var fbCursor = new Date(cycleStart + 'T00:00:00Z')
      var fbEnd = new Date(cycleEnd + 'T00:00:00Z')
      // Min calendar-day gap required by effectiveRestHours. 36h ⇒ 2 days,
      // 11h ⇒ 1 day, etc. (ceiling, slightly conservative).
      var fbNeedGap = Math.max(1, Math.ceil((effectiveRestHours + 0.001) / 24))
      var fbTarget = Math.max(sectorMinStaffing, sectorIdealStaffing || sectorMinStaffing)
      var fbRot = 0

      while (fbCursor <= fbEnd) {
        var fbDate = fbCursor.toISOString().split('T')[0]
        var fbAssigned = []

        // Rotating eligible order to spread load across the cycle.
        var fbOrder = eligible.slice()
        if (fbRot > 0 && fbOrder.length > 1) {
          fbOrder = fbOrder.concat(fbOrder.slice(0, fbRot)).slice(fbRot)
        }

        // A candidate is available if: not on timeoff that day, within the
        // monthly hour limit, and the rest gap since their last shift holds.
        var fbAvailable = function (u) {
          var unavailableDays = unavailableMap[u.id] || []
          if (unavailableDays.indexOf(fbDate) !== -1) return false
          if ((fbUserHours[u.id] || 0) + u.work_hours > u.monthly_hour_limit) return false
          var last = fbLastDay[u.id]
          if (last) {
            var gapDays =
              (new Date(fbDate + 'T00:00:00Z').getTime() -
                new Date(last + 'T00:00:00Z').getTime()) /
              86400000
            if (gapDays < fbNeedGap) return false
          }
          return true
        }

        // Pass 1: guarantee supervision — pick at least one independent
        // (non-supervised) professional first, if any is available.
        if (sectorMinStaffing > 0) {
          for (var i = 0; i < fbOrder.length && fbAssigned.length < 1; i++) {
            var u = fbOrder[i]
            if (u.requires_supervision) continue
            if (fbAssigned.indexOf(u.id) !== -1) continue
            if (!fbAvailable(u)) continue
            fbAssigned.push(u.id)
          }
        }
        // Pass 2: fill up to the target staffing with any available person.
        for (var j = 0; j < fbOrder.length && fbAssigned.length < fbTarget; j++) {
          var u2 = fbOrder[j]
          if (fbAssigned.indexOf(u2.id) !== -1) continue
          if (!fbAvailable(u2)) continue
          fbAssigned.push(u2.id)
        }
        // Pass 3: if still below the hard minimum, keep trying anyone
        // available (ignores the ideal cap, still respects all constraints).
        for (var k = 0; k < fbOrder.length && fbAssigned.length < sectorMinStaffing; k++) {
          var u3 = fbOrder[k]
          if (fbAssigned.indexOf(u3.id) !== -1) continue
          if (!fbAvailable(u3)) continue
          fbAssigned.push(u3.id)
        }

        // Commit assignments for this day.
        fbAssigned.forEach(function (uid) {
          var uu = fbEligibleMap[uid]
          fbUserHours[uid] = (fbUserHours[uid] || 0) + uu.work_hours
          fbLastDay[uid] = fbDate
          fbDraft.push({ user_id: uid, date: fbDate })
        })

        fbCursor = new Date(fbCursor.getTime() + 86400000)
        fbRot = (fbRot + Math.max(1, sectorMinStaffing)) % Math.max(1, eligible.length)
      }

      if (fbDraft.length === 0) {
        updateRun({
          status: 'failed',
          stage: 'fallback_empty',
          error_code: 'FALLBACK_EMPTY',
          error_detail:
            'Não foi possível gerar o rascunho: a IA retornou JSON inválido e o ' +
            'fallback determinístico não encontrou colaboradores disponíveis.',
          metrics: {
            eligible_count: eligible.length,
            orphan_contracts_ignored: orphanContractCount,
            hard_rules_count: hardRules.length,
            preferred_rules_count: preferredRules.length,
            contradictions_count: contradictions.length,
            tokens_used: tokenUsage,
            shifts_proposed: 0,
            shifts_accepted: 0,
            shifts_rejected: 0,
          },
          finished_at: new Date().toISOString(),
        })
        return e.json(400, {
          error:
            'Não foi possível gerar o rascunho: a IA retornou JSON inválido e o ' +
            'fallback determinístico não encontrou colaboradores disponíveis.',
          stage: 'fallback_empty',
          detail: aiCallFailed ? aiCallError : parseError,
          run_id: runId || undefined,
          diagnostics: {
            eligible_count: eligible.length,
            excluded: excluded,
            orphan_contracts_ignored: orphanContractCount,
          },
        })
      }

      // --- Fallback determinístico pronto ---
      draft = fbDraft
    }

    // --- Stable anchor natural worked projection helper (v0.0.251) ---
    // Deterministic anchor based on staff ID sorted order (or staff_id alphabetical rank),
    // guaranteeing identical offsets across completion, candidate selection, and validation.
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
          // Fallback determinístico legado por ID estável
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

    var getNaturalWorkedDays = function (staffList, cStart, cEnd) {
      var map = {}
      var normStart = cStart.split(' ')[0].split('T')[0]
      var normEnd = cEnd.split(' ')[0].split('T')[0]
      staffList.forEach(function (u) {
        map[u.id] = computeNaturalPatternByStaff(u.id, staffList, normStart, normEnd)
      })
      return map
    }
    var naturalWorkedMap = getNaturalWorkedDays(eligible, cycleStart, cycleEnd)

    // --- enforceCycleOffDaysDraft: 1 Fim de Semana (Sáb OU Dom na paridade) + 1 Dia de Semana (Seg-Sex na paridade) ---
    var enforceCycleOffDaysDraft = function (currentShifts, staffList, cStart, cEnd, minStaff) {
      var normStart = cStart.split(' ')[0].split('T')[0]
      var normEnd = cEnd.split(' ')[0].split('T')[0]

      var workingShifts = currentShifts.map(function (s) {
        return { user_id: s.user_id || s.staff_profile, date: (s.date || '').split(' ')[0] }
      })

      var shiftsByStaff = {}
      staffList.forEach(function (u) {
        shiftsByStaff[u.id] = {}
      })
      workingShifts.forEach(function (s) {
        if (!shiftsByStaff[s.user_id]) shiftsByStaff[s.user_id] = {}
        shiftsByStaff[s.user_id][s.date] = true
      })

      var weekendOffAssignments = {}
      var additionalOffAssignments = {}
      var issues = []

      // Buscar solicitações de timeoff fulfilled para o ciclo
      var fulfilledTimeoffsByStaff = {}
      var allTimeoffs = []
      try {
        allTimeoffs = $app.findRecordsByFilter(
          'timeoff_requests',
          "cycle={:cyc} && status='fulfilled'",
          'date',
          10000,
          0,
          { cyc: cycleId },
        )
      } catch (_) {}

      allTimeoffs.forEach(function (req) {
        var pId = req.getString('staff_profile') || req.getString('user')
        if (!pId) return
        if (!fulfilledTimeoffsByStaff[pId]) fulfilledTimeoffsByStaff[pId] = []
        var rStart = (req.getString('date') || '').split(' ')[0]
        var rEnd = (req.getString('end_date') || req.getString('date') || '').split(' ')[0]
        var dC = rStart
        while (dC <= rEnd) {
          if (dC >= normStart && dC <= normEnd) {
            fulfilledTimeoffsByStaff[pId].push(dC)
          }
          dC = addDaysDateOnly(dC, 1)
        }
      })

      staffList.forEach(function (u, staffIndex) {
        var uNatMap = naturalWorkedMap[u.id] || {}

        // 1. FOLGA DE FIM DE SEMANA (Sábado OU Domingo na paridade trabalhada e FORA de férias ativas)
        var isVacationActiveStaff =
          u.vacation_enabled === true &&
          u.vacation_start &&
          u.vacation_end &&
          u.vacation_start <= u.vacation_end
        var isDateInStaffVacation = function (dStr) {
          if (!isVacationActiveStaff) return false
          return dStr >= u.vacation_start && dStr <= u.vacation_end
        }

        var weekendWorkedDays = []
        var weekdayWorkedDays = []
        var curD = normStart
        while (curD <= normEnd) {
          if (uNatMap[curD]) {
            var dow = dayOfWeekDateOnly(curD)
            if (dow === 6 || dow === 0) {
              if (!isDateInStaffVacation(curD)) {
                weekendWorkedDays.push(curD)
              }
            } else if (dow >= 1 && dow <= 5) {
              weekdayWorkedDays.push(curD)
            }
          }
          curD = addDaysDateOnly(curD, 1)
        }

        var targetWeekendOff = null
        if (weekendWorkedDays.length > 0) {
          targetWeekendOff = weekendWorkedDays[staffIndex % weekendWorkedDays.length]
          weekendOffAssignments[u.id] = [targetWeekendOff]
        } else {
          // Se o colaborador está de férias cobrindo os fins de semana do ciclo ou todo o ciclo:
          // NÃO cria nem mostra folga de fim de semana no ciclo. Nunca converte para dia útil.
          weekendOffAssignments[u.id] = []
          if (!isVacationActiveStaff) {
            issues.push(
              'Fim de semana obrigatório não atendido: ' +
                u.name +
                ' sem dias de fim de semana na paridade.',
            )
          }
        }

        // Remove plantão na data de folga de fim de semana escolhida
        if (targetWeekendOff) {
          for (var si = 0; si < workingShifts.length; si++) {
            if (workingShifts[si].user_id === u.id && workingShifts[si].date === targetWeekendOff) {
              workingShifts.splice(si, 1)
              shiftsByStaff[u.id][targetWeekendOff] = false
              break
            }
          }
        }

        // 2. FOLGA ADICIONAL DE DIA DE SEMANA (Seg-Sex na paridade ou substituída por solicitação fulfilled)
        var approvedTimeoffs = fulfilledTimeoffsByStaff[u.id] || []
        var validApprovedInCycle = []
        approvedTimeoffs.forEach(function (tDate) {
          var tDow = dayOfWeekDateOnly(tDate)
          if (tDow >= 1 && tDow <= 5) {
            if (uNatMap[tDate]) {
              if (validApprovedInCycle.indexOf(tDate) === -1) {
                validApprovedInCycle.push(tDate)
              }
            }
          }
        })

        var targetWeekdayOff = null
        if (validApprovedInCycle.length > 0) {
          targetWeekdayOff = validApprovedInCycle[0]
          additionalOffAssignments[u.id] = validApprovedInCycle
          validApprovedInCycle.forEach(function (apprD) {
            for (var wsi = 0; wsi < workingShifts.length; wsi++) {
              if (workingShifts[wsi].user_id === u.id && workingShifts[wsi].date === apprD) {
                workingShifts.splice(wsi, 1)
                shiftsByStaff[u.id][apprD] = false
                break
              }
            }
          })
        } else if (weekdayWorkedDays.length > 0) {
          var wIdx = (staffIndex * 3 + 1) % weekdayWorkedDays.length
          targetWeekdayOff = weekdayWorkedDays[wIdx]
          additionalOffAssignments[u.id] = [targetWeekdayOff]

          for (var wsi2 = 0; wsi2 < workingShifts.length; wsi2++) {
            if (
              workingShifts[wsi2].user_id === u.id &&
              workingShifts[wsi2].date === targetWeekdayOff
            ) {
              workingShifts.splice(wsi2, 1)
              shiftsByStaff[u.id][targetWeekdayOff] = false
              break
            }
          }
        }
      })

      // Check coverage on each day
      var dayCounts = {}
      workingShifts.forEach(function (s) {
        dayCounts[s.date] = (dayCounts[s.date] || 0) + 1
      })
      var cCur = new Date(cStart + 'T00:00:00Z')
      var cEndD = new Date(cEnd + 'T00:00:00Z')
      while (cCur <= cEndD) {
        var dStr = cCur.toISOString().split('T')[0]
        if (minStaff > 0 && (dayCounts[dStr] || 0) < minStaff) {
          issues.push(
            'Efetivo insuficiente em ' +
              dStr +
              ': ' +
              (dayCounts[dStr] || 0) +
              '/' +
              minStaff +
              '.',
          )
        }
        cCur = new Date(cCur.getTime() + 86400000)
      }

      return {
        shifts: workingShifts,
        weekend_off_assignments: weekendOffAssignments,
        additional_off_assignments: additionalOffAssignments,
        issues: issues,
      }
    }

    // --- Complete every regular 12x36 contract across the whole cycle.
    var customPromptText = customRules
      .map(function (rule) {
        return (rule.prompt || '').toLowerCase()
      })
      .join(' ')
    var rebuiltDraft = []
    var rebuiltDayCount = {}
    var rebuiltIndependentCount = {}

    ;(Array.isArray(draft) ? draft : []).forEach(function (entry) {
      if (!entry || typeof entry !== 'object') return
      var uid = entry.user_id || entry.staff_profile || ''
      var date = (entry.date || '').split(' ')[0]
      var candidate = eligible.filter(function (u) {
        return u.id === uid
      })[0]
      if (!candidate || !date || date < cycleStart || date > cycleEnd) return
      var isRegular12x36 = candidate.work_hours === 12 && candidate.rest_hours >= 36
      var hasNamedOverride =
        customPromptText &&
        candidate.name &&
        customPromptText.indexOf(candidate.name.toLowerCase()) !== -1
      if (isRegular12x36 && !hasNamedOverride) return

      rebuiltDraft.push({ user_id: uid, date: date })
      rebuiltDayCount[date] = (rebuiltDayCount[date] || 0) + 1
      if (!candidate.requires_supervision) {
        rebuiltIndependentCount[date] = (rebuiltIndependentCount[date] || 0) + 1
      }
    })

    var completionOrder = eligible.slice().sort(function (a, b) {
      if (a.requires_supervision === b.requires_supervision) {
        return a.name < b.name ? -1 : 1
      }
      return a.requires_supervision ? 1 : -1
    })

    completionOrder.forEach(function (u) {
      var isRegular12x36 = u.work_hours === 12 && u.rest_hours >= 36
      var hasNamedOverride =
        customPromptText && u.name && customPromptText.indexOf(u.name.toLowerCase()) !== -1
      if (!isRegular12x36 || hasNamedOverride) return

      var stepDays = Math.max(2, Math.round((u.work_hours + u.rest_hours) / 24))
      var maxShifts = Math.floor((u.monthly_hour_limit || 0) / u.work_hours)

      // Resolve offset do colaborador a partir de sua paridade ou âncora
      var uParity = u.shift_parity || ''
      var uCycleStart = u.cycle_start_date
        ? (u.cycle_start_date || '').split(' ')[0].split('T')[0]
        : ''
      var targetOffset = 0
      var fixedOffset = false

      if (uParity === 'even') {
        targetOffset = 1
        fixedOffset = true
      } else if (uParity === 'odd') {
        targetOffset = 0
        fixedOffset = true
      } else if (uCycleStart && uCycleStart >= cycleStart && uCycleStart <= cycleEnd) {
        var diffFromCycleStart = Math.round(
          (new Date(uCycleStart + 'T00:00:00Z').getTime() -
            new Date(cycleStart + 'T00:00:00Z').getTime()) /
            86400000,
        )
        targetOffset = ((diffFromCycleStart % stepDays) + stepDays) % stepDays
        fixedOffset = true
      } else {
        var sortedEligibleIds = eligible
          .map(function (c) {
            return c.id
          })
          .filter(Boolean)
          .sort()
        var stableIdx = sortedEligibleIds.indexOf(u.id)
        if (stableIdx === -1) stableIdx = 0
        targetOffset = stableIdx % stepDays
      }

      var bestDates = []
      var bestScore = Number.MAX_SAFE_INTEGER

      // Se o colaborador tem paridade/âncora definida, usa estritamente esse offset
      var offsetRangeStart = fixedOffset ? targetOffset : 0
      var offsetRangeEnd = fixedOffset ? targetOffset + 1 : stepDays

      for (var offset = offsetRangeStart; offset < offsetRangeEnd; offset++) {
        var dates = []
        var offsetCursor = new Date(cycleStart + 'T00:00:00Z')
        offsetCursor = new Date(offsetCursor.getTime() + offset * 86400000)
        while (offsetCursor <= new Date(cycleEnd + 'T00:00:00Z') && dates.length < maxShifts) {
          var offsetDate = offsetCursor.toISOString().split('T')[0]
          if ((unavailableMap[u.id] || []).indexOf(offsetDate) === -1) {
            dates.push(offsetDate)
          }
          offsetCursor = new Date(offsetCursor.getTime() + stepDays * 86400000)
        }

        var score = -dates.length * 1000
        if (offset === targetOffset) score -= 500
        dates.forEach(function (date) {
          score += (rebuiltDayCount[date] || 0) * 10
          if (u.requires_supervision && !(rebuiltIndependentCount[date] > 0)) {
            score += 100
          }
        })
        if (score < bestScore) {
          bestScore = score
          bestDates = dates
        }
      }

      bestDates.forEach(function (date) {
        rebuiltDraft.push({ user_id: u.id, date: date })
        rebuiltDayCount[date] = (rebuiltDayCount[date] || 0) + 1
        if (!u.requires_supervision) {
          rebuiltIndependentCount[date] = (rebuiltIndependentCount[date] || 0) + 1
        }
      })
    })

    // Enforce cycle off-days on the generated/rebuilt shifts
    var enforcedResult = enforceCycleOffDaysDraft(
      rebuiltDraft,
      eligible,
      cycleStart,
      cycleEnd,
      sectorMinStaffing,
    )
    draft = enforcedResult.shifts
    var backendWeekendOffAssignments = enforcedResult.weekend_off_assignments
    var backendAdditionalOffAssignments = enforcedResult.additional_off_assignments
    var weekendOffEnforcementIssues = enforcedResult.issues

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
      updateRun({
        status: 'failed',
        stage: 'no_valid_shifts',
        error_code: 'NO_VALID_SHIFTS',
        error_detail: 'A IA não retornou nenhum plantão válido.',
        metrics: {
          eligible_count: eligible.length,
          orphan_contracts_ignored: orphanContractCount,
          hard_rules_count: hardRules.length,
          preferred_rules_count: preferredRules.length,
          contradictions_count: contradictions.length,
          tokens_used: tokenUsage,
          shifts_proposed: draft ? draft.length : 0,
          shifts_accepted: 0,
          shifts_rejected: draft ? draft.length : 0,
        },
        finished_at: new Date().toISOString(),
      })
      return e.json(400, {
        error: 'A IA não retornou nenhum plantão válido.',
        violations: schemaErrors,
        run_id: runId || undefined,
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
      // Vacation check
      var vdays = vacationMap[u.id] || []
      if (vdays.indexOf(entry.date) !== -1) {
        violations.push(
          'Colaborador está de férias no período: ' + u.name + ' em ' + entry.date + '.',
        )
      }
      var occupiedDays = otherSectorShiftMap[u.id] || []
      if (occupiedDays.indexOf(entry.date) !== -1) {
        violations.push(u.name + ' já possui plantão em outro setor em ' + entry.date + '.')
      }

      // Hours accumulation
      userHours[u.id] = (userHours[u.id] || 0) + u.work_hours
      if (userHours[u.id] > u.monthly_hour_limit) {
        var hoursMessage =
          u.name +
          ' excede o limite mensal: ' +
          userHours[u.id] +
          'h de ' +
          u.monthly_hour_limit +
          'h.'
        if (customRules.length > 0) {
          warnings.push('Exceção por regra customizada: ' + hoursMessage)
        } else {
          violations.push(hoursMessage)
        }
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
            var restMessage =
              u.name +
              ' tem apenas ' +
              Math.round(gap * 10) / 10 +
              'h de descanso (mínimo ' +
              effectiveRestHours +
              'h).'
            if (customRules.length > 0) {
              warnings.push('Exceção por regra customizada: ' + restMessage)
            } else {
              violations.push(restMessage)
            }
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
          var consecutiveMessage =
            u.name + ' excede ' + effectiveMaxConsecutive + ' plantões consecutivos.'
          if (customRules.length > 0) {
            warnings.push('Exceção por regra customizada: ' + consecutiveMessage)
          } else {
            violations.push(consecutiveMessage)
          }
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

    // Validação per-cycle de folgas (1 Fim de Semana Sáb OU Dom + 1 Dia de Semana Seg-Sex)
    var weekendOffAssignments = backendWeekendOffAssignments
      ? JSON.parse(JSON.stringify(backendWeekendOffAssignments))
      : {}
    var additionalOffAssignments = backendAdditionalOffAssignments
      ? JSON.parse(JSON.stringify(backendAdditionalOffAssignments))
      : {}

    eligible.forEach(function (u) {
      var uNatSet = naturalWorkedMap[u.id] || {}
      var uShifts = cleanDraft
        .filter(function (s) {
          return s.user_id === u.id
        })
        .map(function (s) {
          return s.date
        })
      var uShiftSet = {}
      uShifts.forEach(function (d) {
        uShiftSet[d] = true
      })

      // 1. Validação de Fim de Semana (apenas exigida se o colaborador não estiver com todos os fins de semana em férias)
      var isVacationActiveStaff =
        u.vacation_enabled === true &&
        u.vacation_start &&
        u.vacation_end &&
        u.vacation_start <= u.vacation_end
      var userWeekendOffs = weekendOffAssignments[u.id] || []
      if (!userWeekendOffs || userWeekendOffs.length === 0) {
        if (!isVacationActiveStaff) {
          violations.push(
            'Fim de semana obrigatório não atendido: ' +
              u.name +
              ' não tem folga de fim de semana no ciclo.',
          )
        }
      } else {
        var wOffDate = userWeekendOffs[0]
        var dow = dayOfWeekDateOnly(wOffDate)
        if (dow !== 6 && dow !== 0) {
          violations.push('Folga de fim de semana inválida para ' + u.name + ': ' + wOffDate)
        } else if (!uNatSet[wOffDate]) {
          violations.push('Folga de fim de semana para ' + u.name + ' está em paridade oposta.')
        } else if (uShiftSet[wOffDate]) {
          violations.push(
            'Fim de semana obrigatório não atendido: ' + u.name + ' possui plantão em ' + wOffDate,
          )
        }
      }

      // 2. Validação de Dia de Semana
      var userAddOffs = additionalOffAssignments[u.id] || []
      if (userAddOffs && Array.isArray(userAddOffs)) {
        userAddOffs.forEach(function (addDate) {
          var addDow = dayOfWeekDateOnly(addDate)
          if (addDow < 1 || addDow > 5) {
            violations.push(
              'Folga adicional inválida para ' + u.name + ': ' + addDate + ' não é dia de semana.',
            )
          } else if (!uNatSet[addDate]) {
            violations.push(
              'Folga adicional inválida para ' +
                u.name +
                ': ' +
                addDate +
                ' está em paridade oposta.',
            )
          } else if (uShiftSet[addDate]) {
            violations.push(
              'Folga adicional não atendida: ' + u.name + ' possui plantão em ' + addDate,
            )
          }
        })
      }
    })
    if (weekendOffEnforcementIssues && weekendOffEnforcementIssues.length > 0) {
      violations = violations.concat(weekendOffEnforcementIssues)
    }

    violations = violations.filter(function (item, index, all) {
      return all.indexOf(item) === index
    })
    warnings = warnings.filter(function (item, index, all) {
      return all.indexOf(item) === index
    })

    // When the draft came from the deterministic fallback, non-weekend-off
    // violations are surfaced as non-blocking warnings. WEEKEND_OFF violations
    // must remain hard/blocking.
    if (source === 'fallback') {
      var weekendOffViolations = []
      var otherViolations = []
      violations.forEach(function (v) {
        if (v && v.indexOf('Fim de semana obrigatório') !== -1) {
          weekendOffViolations.push(v)
        } else {
          otherViolations.push(v)
        }
      })
      warnings = warnings.concat(otherViolations)
      violations = weekendOffViolations
      warnings.unshift(
        'Rascunho gerado por fallback determinístico (a IA não retornou JSON válido). Revise antes de publicar.',
      )
    }

    var diagnostics = {
      eligible_count: eligible.length,
      excluded: excluded,
      orphan_contracts_ignored: orphanContractCount,
      hard_rules: hardRules,
      preferred_rules: preferredRules,
      custom_rules: customRules,
      contradictions: contradictions,
      effective_rest_hours: effectiveRestHours,
      effective_min_staffing: sectorMinStaffing,
      cycle_start: cycleStart,
      cycle_end: cycleEnd,
    }

    if (violations.length > 0) {
      // AI path with hard violations: DO NOT save a draft. Finalize the
      // run as failed (stage validation_failed, error_code VIOLATIONS).
      var firstViolations = violations.slice(0, 3)
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

      // Persist validation_issues even though no draft was saved, so the
      // violations are traceable. draft is empty here; run carries them.
      try {
        var issuesCol = $app.findCollectionByNameOrId('schedule_validation_issues')
        for (var vi = 0; vi < violations.length; vi++) {
          try {
            var issue = new Record(issuesCol)
            issue.set('run', runId)
            issue.set('severity', 'hard')
            issue.set('message', sanitizeDetail(violations[vi]))
            var inferred = inferIssue(violations[vi], eligible)
            issue.set('rule_name', inferred.rule_name)
            issue.set('code', inferred.code)
            if (inferred.date) issue.set('issue_date', inferred.date)
            if (inferred.staff_id) issue.set('staff_profile', inferred.staff_id)
            issue.set('resolved', false)
            $app.saveNoValidate(issue)
          } catch (_) {}
        }
      } catch (_) {}

      updateRun({
        status: 'failed',
        stage: 'validation_failed',
        error_code: 'VIOLATIONS',
        error_detail: firstViolations.join(' | '),
        metrics: {
          eligible_count: eligible.length,
          orphan_contracts_ignored: orphanContractCount,
          hard_rules_count: hardRules.length,
          preferred_rules_count: preferredRules.length,
          contradictions_count: contradictions.length,
          tokens_used: tokenUsage,
          shifts_proposed: draft.length,
          shifts_accepted: cleanDraft.length,
          shifts_rejected: draft.length - cleanDraft.length,
        },
        finished_at: new Date().toISOString(),
      })

      return e.json(400, {
        error: 'O rascunho viola regras obrigatórias e não foi salvo.',
        violations: violations,
        warnings: warnings,
        run_id: runId || undefined,
        diagnostics: diagnostics,
        suggestion: suggestion || undefined,
      })
    }

    // --- Create the schedule_draft (before shifts, so shifts can link to it) ---
    updateRun({ status: 'saving', stage: 'Persistindo rascunho...', progress: 90 })

    var draftId = ''
    try {
      var draftsCol = $app.findCollectionByNameOrId('schedule_drafts')
      var draftRec = new Record(draftsCol)
      draftRec.set('cycle', cycleId)
      draftRec.set('sector', sectorId)
      draftRec.set('generation_run', runId)
      draftRec.set('status', 'draft')
      draftRec.set('version', 1)
      draftRec.set('generation_source', source === 'fallback' ? 'deterministic' : 'ai')
      draftRec.set('generated_by', e.auth ? e.auth.id : '')
      draftRec.set('created_by', e.auth ? e.auth.id : '')
      draftRec.set('validation_summary', {
        violations_count: violations.length,
        warnings_count: warnings.length,
        hard_violations: [],
        warnings: warnings.slice(0, 20),
        weekend_off_assignments: weekendOffAssignments,
        additional_off_assignments: additionalOffAssignments,
      })
      $app.saveNoValidate(draftRec)
      draftId = draftRec.id
    } catch (draftErr) {
      console.log(
        '[escala/draft] failed to create schedule_draft: ' + (draftErr.message || draftErr),
      )
    }

    // --- Persist shifts (linked to draft + run). Cycle status is NEVER changed. ---
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
          if (draftId) record.set('draft', draftId)
          if (runId) record.set('generation_run', runId)
          txApp.save(record)
          persisted.push({
            staff_profile: entry.user_id,
            name: u.name,
            sector: sectorId,
            cycle: cycleId,
            start_time: startStr,
            end_time: endStr,
            draft: draftId,
            generation_run: runId,
          })
        })
      })
    } catch (persistErr) {
      console.log('[escala/draft] persist failed: ' + (persistErr.message || String(persistErr)))
      logAudit('AI_SHIFT_DRAFT_GENERATION', {
        status: 'error',
        cycle_id: cycleId,
        sector_id: sectorId,
        error: 'Persist failed: ' + (persistErr.message || String(persistErr)),
      })
      updateRun({
        status: 'failed',
        stage: 'persist_failed',
        error_code: 'PERSIST_FAILED',
        error_detail: 'Falha ao salvar o rascunho. Nenhum dado anterior foi alterado.',
        finished_at: new Date().toISOString(),
      })
      return e.json(500, {
        error: 'Falha ao salvar o rascunho. Nenhum dado anterior foi alterado.',
        detail: persistErr.message || String(persistErr),
        run_id: runId || undefined,
      })
    }

    // --- Persist validation_issues (warnings + any violations already recorded) ---
    try {
      var issuesCol2 = $app.findCollectionByNameOrId('schedule_validation_issues')
      for (var wi = 0; wi < warnings.length; wi++) {
        try {
          var issue2 = new Record(issuesCol2)
          issue2.set('draft', draftId)
          issue2.set('run', runId)
          issue2.set('severity', 'preference')
          issue2.set('message', sanitizeDetail(warnings[wi]))
          var inferred2 = inferIssue(warnings[wi], eligible)
          issue2.set('rule_name', inferred2.rule_name)
          issue2.set('code', inferred2.code)
          if (inferred2.date) issue2.set('issue_date', inferred2.date)
          if (inferred2.staff_id) issue2.set('staff_profile', inferred2.staff_id)
          issue2.set('resolved', false)
          $app.saveNoValidate(issue2)
        } catch (_) {}
      }
    } catch (_) {}

    // --- Finalize the run: completed + metrics + ai_diagnostics ---
    var runDurationMs = 0
    try {
      var startedRec = $app.findRecordById('schedule_generation_runs', runId)
      var startedIso = startedRec.getString('started_at')
      if (startedIso) {
        runDurationMs = new Date().getTime() - new Date(startedIso).getTime()
      }
    } catch (_) {}

    updateRun({
      status: 'completed',
      stage: 'Rascunho gerado e salvo',
      progress: 100,
      generation_source: source === 'fallback' ? 'deterministic' : 'ai',
      finished_at: new Date().toISOString(),
      duration_ms: runDurationMs,
      metrics: {
        eligible_count: eligible.length,
        orphan_contracts_ignored: orphanContractCount,
        hard_rules_count: hardRules.length,
        preferred_rules_count: preferredRules.length,
        contradictions_count: contradictions.length,
        tokens_used: tokenUsage,
        shifts_proposed: draft.length,
        shifts_accepted: cleanDraft.length,
        shifts_rejected: draft.length - cleanDraft.length,
      },
    })

    logAudit(
      'AI_SHIFT_DRAFT_GENERATION',
      {
        status: 'success',
        cycle_id: cycleId,
        sector_id: sectorId,
        draft_count: persisted.length,
        warnings: warnings,
        run_id: runId || undefined,
        draft_id: draftId || undefined,
      },
      tokenUsage,
    )

    return e.json(200, {
      success: true,
      source: source, // 'ai' | 'fallback'
      draft: persisted,
      warnings: warnings.length > 0 ? warnings : undefined,
      diagnostics: diagnostics,
      cycle_id: cycleId,
      sector_id: sectorId,
      run_id: runId || undefined,
      draft_id: draftId || undefined,
      stale_lock_recovered: recoveredStaleLock,
      recovered_run_id: recoveredRunId || undefined,
    })
  },
  $apis.requireAuth(),
)
