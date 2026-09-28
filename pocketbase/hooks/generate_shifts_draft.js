// Simplified schedule draft generator for HUB IA BP
// Only TWO mandatory generation rules:
// 1. 12x36 alternation for 12x36 staff respecting parity/team ("Equipe 1" = even, "Equipe 2" = odd) and parity-inversion
// 2. Exactly ONE weekend day off (Saturday or Sunday) per month in cycle. If no safe date, register warning and proceed (non-blocking).
// No secondary AI call ($ai.agent), no shift_rules, no timeoff/vacation/limits/staffing blocking the draft.

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

    var sanitizeDetail = function (text) {
      var s = typeof text === 'string' ? text : String(text || '')
      try {
        s = s.replace(/"[^"]*"/g, '"…"').replace(/'[^']*'/g, "'…'")
      } catch (_) {}
      if (s.length > 500) s = s.substring(0, 500)
      return s
    }

    var inferIssue = function (message) {
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
      } else if (lower.indexOf('12x36') !== -1 || lower.indexOf('equipe') !== -1) {
        result.rule_name = 'parity'
        result.code = 'PARITY_12X36'
      }
      return result
    }

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
      runRec.set('idempotency_key', idempotencyKey)
      runRec.set('started_at', new Date().toISOString())
      $app.saveNoValidate(runRec)
      runId = runRec.id
    } catch (runErr) {
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

    // Check existing draft unless replace or refinement requested
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
      updateRun({
        status: 'cancelled',
        stage: 'existing_draft',
        error_code: 'EXISTING_DRAFT',
        error_detail: 'Já existe um rascunho para este ciclo/setor.',
        progress: 0,
        finished_at: new Date().toISOString(),
      })
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

    updateRun({ stage: 'Selecionando colaboradores elegíveis...' })

    // Eligible staff: active profiles in this sector with contracts
    var profiles = $app.findRecordsByFilter(
      'staff_profiles',
      'default_sector={:sec} && active=true',
      'name',
      10000,
      0,
      { sec: sectorId },
    )

    var contracts = $app.findRecordsByFilter('staff_contracts', '', '-updated', 10000, 0)
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
      var sStart = st.getString('start_time') || '07:00'
      var sEnd = st.getString('end_time') || '19:00'
      shiftTypeMap[st.id] = {
        id: st.id,
        name: st.getString('name'),
        work_hours: wHours,
        rest_hours: rHours,
        start_time: sStart,
        end_time: sEnd,
      }
    })

    var eligible = []
    var excluded = []
    profiles.forEach(function (p) {
      var profileContracts = contractsByProfile[p.id] || []
      if (profileContracts.length === 0) {
        excluded.push({ name: p.getString('name'), reason: 'sem contrato vinculado' })
        return
      }
      var c = profileContracts[0]
      var st = shiftTypeMap[c.getString('shift_type')]
      var wHours = st ? st.work_hours : 12
      var rHours = st ? st.rest_hours : 36
      var sStart = st ? st.start_time : '07:00'
      var sEnd = st ? st.end_time : '19:00'

      var profileParity = p.getString('shift_parity') || ''
      var profileCycleStart = (p.getString('cycle_start_date') || '').split(' ')[0].split('T')[0]

      eligible.push({
        id: p.id,
        name: p.getString('name'),
        work_hours: wHours,
        rest_hours: rHours,
        shift_start_time: sStart,
        shift_end_time: sEnd,
        shift_parity: profileParity,
        cycle_start_date: profileCycleStart,
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

    // --- Pure date-only and parity helpers ---
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

    // Identifica meses cobertos pelo ciclo
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

    // Compute natural 12x36 pattern for each staff member across cycle
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

      // Default alternation by cycle_start_date or stable index
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
        var sortedIds = eligible
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

    // --- DETERMINISTIC 12x36 GENERATOR (FAST & STABLE) ---
    // If AI is called, we do a single fast pass. If it fails or if not needed, we use the deterministic core.
    updateRun({
      status: 'generating',
      stage: 'Gerando escala (Regras: 12x36 e 1 folga FDS por mês)...',
      progress: 50,
    })

    var initialShiftsByStaff = {}
    eligible.forEach(function (u) {
      initialShiftsByStaff[u.id] = computeStaffNaturalDays(u)
    })

    // Rule 2: Exactly ONE weekend day off (Saturday or Sunday) per month in cycle for each collaborator.
    // If no safe date, register a warning and continue (non-blocking).
    var weekendOffAssignments = {}
    var warnings = []

    eligible.forEach(function (u) {
      var staffDays = initialShiftsByStaff[u.id] || []
      var staffDaysSet = {}
      staffDays.forEach(function (d) {
        staffDaysSet[d] = true
      })

      var assignedWeekendOffs = []

      cycleMonths.forEach(function (mInfo) {
        var monthPrefix = mInfo.key
        // Find weekend days (Sat or Sun) that fall in this month and in the natural work sequence
        var candidateWeekendDays = []
        staffDays.forEach(function (d) {
          if (d.startsWith(monthPrefix)) {
            var dow = dayOfWeekDateOnly(d)
            if (dow === 6 || dow === 0) {
              candidateWeekendDays.push(d)
            }
          }
        })

        if (candidateWeekendDays.length > 0) {
          // Choose one weekend day to be the weekend-off for this month
          var chosenWeekendOff = candidateWeekendDays[0]
          assignedWeekendOffs.push(chosenWeekendOff)
          // Remove shift on this date from the collaborator's shifts
          delete staffDaysSet[chosenWeekendOff]
        } else {
          warnings.push(
            'Colaborador ' +
              u.name +
              ' não possui plantão de fim de semana na paridade para o mês ' +
              mInfo.key +
              '; folga de fim de semana não pôde ser alocada.',
          )
        }
      })

      weekendOffAssignments[u.id] = assignedWeekendOffs
      initialShiftsByStaff[u.id] = Object.keys(staffDaysSet).sort()
    })

    var source = 'deterministic'
    var cleanDraft = []
    eligible.forEach(function (u) {
      var days = initialShiftsByStaff[u.id] || []
      days.forEach(function (date) {
        cleanDraft.push({ user_id: u.id, date: date })
      })
    })

    // Map eligible by id
    var eligibleIds = {}
    eligible.forEach(function (u) {
      eligibleIds[u.id] = u
    })

    updateRun({ status: 'saving', stage: 'Persistindo rascunho consistente...', progress: 85 })

    var draftId = ''
    try {
      var draftsCol = $app.findCollectionByNameOrId('schedule_drafts')
      var draftRec = new Record(draftsCol)
      draftRec.set('cycle', cycleId)
      draftRec.set('sector', sectorId)
      draftRec.set('generation_run', runId)
      draftRec.set('status', 'draft')
      draftRec.set('version', 1)
      draftRec.set('generation_source', source)
      draftRec.set('generated_by', e.auth ? e.auth.id : '')
      draftRec.set('created_by', e.auth ? e.auth.id : '')
      draftRec.set('validation_summary', {
        violations_count: 0,
        warnings_count: warnings.length,
        hard_violations: [],
        warnings: warnings.slice(0, 20),
        weekend_off_assignments: weekendOffAssignments,
        additional_off_assignments: {},
      })
      $app.saveNoValidate(draftRec)
      draftId = draftRec.id
    } catch (draftErr) {
      console.log(
        '[escala/draft] failed to create schedule_draft: ' + (draftErr.message || draftErr),
      )
    }

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

    // Persist warnings in schedule_validation_issues
    try {
      var issuesCol2 = $app.findCollectionByNameOrId('schedule_validation_issues')
      for (var wi = 0; wi < warnings.length; wi++) {
        try {
          var issue2 = new Record(issuesCol2)
          issue2.set('draft', draftId)
          issue2.set('run', runId)
          issue2.set('severity', 'preference')
          issue2.set('message', sanitizeDetail(warnings[wi]))
          var inferred2 = inferIssue(warnings[wi])
          issue2.set('rule_name', inferred2.rule_name)
          issue2.set('code', inferred2.code)
          if (inferred2.date) issue2.set('issue_date', inferred2.date)
          issue2.set('resolved', false)
          $app.saveNoValidate(issue2)
        } catch (_) {}
      }
    } catch (_) {}

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
      generation_source: source,
      finished_at: new Date().toISOString(),
      duration_ms: runDurationMs,
      metrics: {
        eligible_count: eligible.length,
        shifts_proposed: cleanDraft.length,
        shifts_accepted: cleanDraft.length,
        shifts_rejected: 0,
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
      0,
    )

    return e.json(200, {
      success: true,
      source: source,
      draft: persisted,
      warnings: warnings.length > 0 ? warnings : undefined,
      diagnostics: {
        eligible_count: eligible.length,
        cycle_start: cycleStart,
        cycle_end: cycleEnd,
      },
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
