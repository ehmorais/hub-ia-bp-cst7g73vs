routerAdd(
  'POST',
  '/backend/v1/escala/draft',
  (e) => {
    if (!e.auth || e.auth.getString('role') !== 'Admin') {
      return e.forbiddenError('Apenas administradores podem gerar rascunhos de escala.')
    }

    const body = e.requestInfo().body || {}
    const {
      cycle_id,
      sector_id,
      additional_prompt,
      current_draft,
      context,
      priority = 'staffing',
      strictness = 50,
    } = body

    if (!cycle_id || !sector_id || !context) {
      return e.badRequestError('Missing parameters: cycle_id, sector_id, and context are required.')
    }

    var auditCol = $app.findCollectionByNameOrId('audit_logs')
    var audit = new Record(auditCol)
    audit.set('user', e.auth ? e.auth.id : '')
    audit.set('action', 'AI_SHIFT_DRAFT_GENERATION')
    audit.set(
      'details',
      JSON.stringify({
        status: 'started',
        cycle_id: cycle_id,
        sector_id: sector_id,
        is_refinement: !!additional_prompt,
      }),
    )
    $app.saveNoValidate(audit)

    const prompt = [
      'You are an expert hospital shift scheduler.',
      'Your task is to generate a shift schedule for a specific cycle and sector.',
      '',
      'Context provided:',
      '- Cycle Start/End dates',
      '- Users available (with their contracts, max hours, shift types)',
      '- Timeoff requests (do not assign shifts on these dates for these users)',
      '- Sector minimum/ideal staffing',
      '',
      JSON.stringify(context, null, 2),
      '',
      'Current Draft (if any):',
      current_draft ? JSON.stringify(current_draft, null, 2) : 'None',
      '',
      'User Refinement Request:',
      additional_prompt || 'Generate an optimal schedule covering the entire cycle period.',
      '',
      'AI Strictness and Priority:',
      '- Strictness: ' +
        strictness +
        '% (0% means very flexible, 100% means strictly fail if rules cannot be met).',
      priority === 'timeoff'
        ? '- Priority: Strictly respect time-off over staffing minimums'
        : '- Priority: Ensure minimum staffing even if it means slightly violating secondary rules (but timeoffs still highly prioritized).',
      '',
      'OUTPUT FORMAT INSTRUCTIONS:',
      'Return ONLY a valid JSON array of objects. Do not include markdown formatting, backticks, or explanations.',
      'Each object must represent a shift assignment with the following keys:',
      '- "user_id": string (the ID of the user)',
      '- "date": string (YYYY-MM-DD format)',
      '- "shift": string (use "D" for Day (07-19), "N" for Night (19-07), "M" for Morning (07-13), "T" for Afternoon (13-19))',
      '',
      'Rules to strictly follow:',
      '1. Do NOT output shifts for days a user has timeoff.',
      '2. Ensure minimum staffing per day if possible based on the sector config.',
      '3. Obey standard rest hours (e.g. no Day shift immediately following a Night shift).',
      '4. Do not exceed any user monthly_hour_limit.',
    ].join('\n')

    try {
      const response = $ai.chat({
        model: 'reasoning',
        messages: [
          { role: 'system', content: 'You are a JSON-only API. You output raw JSON arrays only.' },
          { role: 'user', content: prompt },
        ],
      })

      var tokenUsage = 0
      if (response.usage) tokenUsage = response.usage.total_tokens || 0

      let text = response.choices[0].message.content.trim()
      text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      if (text.startsWith('```json')) text = text.replace(/^```json/, '')
      if (text.startsWith('```')) text = text.replace(/^```/, '')
      if (text.endsWith('```')) text = text.replace(/```$/, '')
      text = text.trim()

      let draft = JSON.parse(text)

      // Basic validation
      if (!Array.isArray(draft)) {
        throw new Error('AI returned a non-array response')
      }

      // Validate entries
      var validDraft = draft.filter(function (d) {
        return d && d.user_id && d.date && d.shift
      })

      var validationWarnings = []
      var validationErrors = []
      if (validDraft.length < draft.length) {
        validationErrors.push(
          draft.length - validDraft.length + ' entradas possuem dados ausentes.',
        )
      }

      var contextUsers = {}
      ;(context.users || []).forEach(function (user) {
        contextUsers[user.id] = user
      })
      var cycleStart = ((context.cycle && context.cycle.start_date) || '').split(' ')[0]
      var cycleEnd = ((context.cycle && context.cycle.end_date) || '').split(' ')[0]
      var dailyAssignments = {}
      var allowedShifts = { D: true, N: true, M: true, T: true }

      validDraft.forEach(function (entry) {
        var user = contextUsers[entry.user_id]
        if (!user) {
          validationErrors.push('Colaborador inválido no rascunho: ' + entry.user_id)
          return
        }
        if (!allowedShifts[entry.shift]) {
          validationErrors.push('Tipo de turno inválido para ' + user.name + ': ' + entry.shift)
        }
        if (entry.date < cycleStart || entry.date > cycleEnd) {
          validationErrors.push('Data fora do ciclo para ' + user.name + ': ' + entry.date)
        }

        ;(user.timeoffs || []).forEach(function (request) {
          var start = typeof request === 'string' ? request : request.start_date
          var end = typeof request === 'string' ? request : request.end_date || request.start_date
          if (entry.date >= start && entry.date <= end) {
            validationErrors.push(
              'Folga não respeitada para ' + user.name + ' em ' + entry.date + '.',
            )
          }
        })

        if (!dailyAssignments[entry.date]) dailyAssignments[entry.date] = []
        dailyAssignments[entry.date].push(user)
      })

      var minimum = (context.sector && context.sector.min_staffing) || 0
      var ideal = (context.sector && context.sector.ideal_staffing) || minimum
      var cursor = new Date(cycleStart + 'T00:00:00Z')
      var lastDay = new Date(cycleEnd + 'T00:00:00Z')
      while (cursor <= lastDay) {
        var dateKey = cursor.toISOString().split('T')[0]
        var assignments = dailyAssignments[dateKey] || []
        if (assignments.length < minimum) {
          validationErrors.push(
            'Efetivo insuficiente em ' + dateKey + ': ' + assignments.length + '/' + minimum + '.',
          )
        } else if (assignments.length < ideal) {
          validationWarnings.push(
            'Efetivo abaixo do ideal em ' + dateKey + ': ' + assignments.length + '/' + ideal + '.',
          )
        }

        assignments.forEach(function (assignment) {
          if (!assignment.requires_supervision) return
          var hasSupervisor = assignments.some(function (candidate) {
            return (candidate.hierarchy_rank || 0) > (assignment.hierarchy_rank || 0)
          })
          if (!hasSupervisor) {
            validationErrors.push(
              'Supervisão ausente em ' + dateKey + ' para ' + assignment.name + '.',
            )
          }
        })
        cursor = new Date(cursor.getTime() + 86400000)
      }

      validationErrors = validationErrors.filter(function (item, index, all) {
        return all.indexOf(item) === index
      })
      if (validationErrors.length > 0) {
        throw new Error(
          'O rascunho viola regras obrigatórias: ' + validationErrors.slice(0, 8).join(' | '),
        )
      }

      var successAudit = new Record(auditCol)
      successAudit.set('user', e.auth ? e.auth.id : '')
      successAudit.set('action', 'AI_SHIFT_DRAFT_GENERATION')
      successAudit.set(
        'details',
        JSON.stringify({
          status: 'success',
          cycle_id: cycle_id,
          sector_id: sector_id,
          draft_count: validDraft.length,
          warnings: validationWarnings,
        }),
      )
      successAudit.set('token_usage', tokenUsage)
      $app.saveNoValidate(successAudit)

      return e.json(200, {
        draft: validDraft,
        warnings: validationWarnings.length > 0 ? validationWarnings : undefined,
      })
    } catch (err) {
      var failAudit = new Record(auditCol)
      failAudit.set('user', e.auth ? e.auth.id : '')
      failAudit.set('action', 'AI_SHIFT_DRAFT_GENERATION')
      failAudit.set(
        'details',
        JSON.stringify({
          status: 'error',
          cycle_id: cycle_id,
          sector_id: sector_id,
          error: err.message,
        }),
      )
      $app.saveNoValidate(failAudit)

      return e.badRequestError(
        'AI generation failed or returned invalid JSON. Error: ' + err.message,
      )
    }
  },
  $apis.requireAuth(),
)
