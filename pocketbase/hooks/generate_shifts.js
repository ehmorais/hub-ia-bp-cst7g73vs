routerAdd(
  'POST',
  '/backend/v1/escala/generate',
  (e) => {
    const body = e.requestInfo().body || {}
    const cycleId = body.cycle_id
    const departmentId = body.department_id
    const sectorId = body.sector_id

    if (!cycleId || !departmentId) {
      return e.badRequestError('cycle_id and department_id are required')
    }

    // Gather Data
    const cycle = $app.findRecordById('shift_cycles', cycleId)
    const rules = $app.findRecordsByFilter(
      'shift_rules',
      `department = {:dep}`,
      '-created',
      100,
      0,
      { dep: departmentId },
    )
    let sectors = $app.findRecordsByFilter(
      'hospital_sectors',
      `department = {:dep}`,
      '-created',
      100,
      0,
      { dep: departmentId },
    )
    if (sectorId) {
      sectors = sectors.filter((s) => s.id === sectorId)
    }

    const contracts = $app.findRecordsByFilter('staff_contracts', '', '-created', 1000, 0)
    const roles = $app.findRecordsByFilter('staff_roles', '', '-created', 1000, 0)
    const shiftTypes = $app.findRecordsByFilter('shift_types', '', '-created', 1000, 0)
    const timeoffs = $app.findRecordsByFilter(
      'timeoff_requests',
      `cycle = {:cyc}`,
      '-created',
      1000,
      0,
      { cyc: cycleId },
    )

    const usersWithContracts = []
    contracts.forEach((c) => {
      try {
        const u = $app.findRecordById('users', c.getString('user'))
        const rId = u.getString('staff_role')
        let rName = 'N/A'
        let rRank = 0
        let rSup = false
        if (rId) {
          const r = roles.find((ro) => ro.id === rId)
          if (r) {
            rName = r.getString('name')
            rRank = r.getInt('hierarchy_rank')
            rSup = r.getBool('requires_supervision')
          }
        }

        let sTypeName = null
        let sTypeHours = null
        let sTypeRest = null
        const sTypeId = c.getString('shift_type')
        if (sTypeId) {
          const st = shiftTypes.find((x) => x.id === sTypeId)
          if (st) {
            sTypeName = st.getString('name')
            sTypeHours = st.getInt('work_hours')
            sTypeRest = st.getInt('rest_hours')
          }
        }

        // Individual rules (exceptions/additions)
        const assignedRulesIds = u.getStringSlice('assigned_rules') || []
        const userRules = assignedRulesIds
          .map((rid) => {
            let rule = rules.find((r) => r.id === rid)
            if (!rule) {
              try {
                rule = $app.findRecordById('shift_rules', rid)
              } catch (_) {}
            }
            if (rule) {
              const rType = rule.getString('rule_type')
              return {
                name: rule.getString('name'),
                type: rType,
                value: rule.getInt('value'),
                ...(rType === 'custom_prompt' ? { prompt: rule.getString('prompt') } : {}),
              }
            }
            return null
          })
          .filter(Boolean)

        usersWithContracts.push({
          id: u.id,
          name: u.getString('name'),
          contract_type: c.getString('contract_type'),
          hour_limit: c.getInt('monthly_hour_limit'),
          role: rName,
          role_id: rId,
          rank: rRank,
          requires_supervision: rSup,
          shift_type: sTypeName,
          shift_work_hours: sTypeHours || 12,
          shift_rest_hours: sTypeRest || 36,
          assigned_rules: userRules.length > 0 ? userRules : undefined,
        })
      } catch (_) {}
    })

    const sectorData = sectors.map((s) => ({
      id: s.id,
      name: s.getString('name'),
      min_staff: s.getInt('min_staffing'),
      ideal_staff: s.getInt('ideal_staffing'),
      bed_capacity: s.getInt('bed_capacity'),
      staffing_ratio: s.getInt('staffing_ratio') || 10,
      is_critical: s.getBool('is_critical'),
    }))

    const ruleData = rules.map((r) => {
      const type = r.getString('rule_type')
      return {
        name: r.getString('name'),
        type: type,
        value: r.getInt('value'),
        ...(type === 'custom_prompt' ? { prompt: r.getString('prompt') } : {}),
      }
    })

    const timeoffData = timeoffs.map((t) => ({
      user: t.getString('user'),
      date: t.getString('date').split(' ')[0],
      weight: t.getInt('priority_weight'),
    }))

    // Build the prompt for Skip AI Gateway
    const prompt = `
You are an expert hospital shift scheduling algorithm.
Generate an optimal shift schedule for the following cycle and department.

Cycle Start: ${cycle.getString('start_date')}
Cycle End: ${cycle.getString('end_date')}

Sectors:
${JSON.stringify(sectorData, null, 2)}

Staff:
${JSON.stringify(usersWithContracts, null, 2)}

Rules:
${JSON.stringify(ruleData, null, 2)}

Timeoff Requests:
${JSON.stringify(timeoffData, null, 2)}

Constraints:
1. Operational Cycle: The scale covers strictly the period from the 26th of the start month to the 25th of the end month as defined by Cycle Start/End.
2. Safety Ratios: Non-critical floors must have at least 1 professional per "staffing_ratio" beds (default 10), and a minimum of 2 professionals. Calculate based on 'bed_capacity'.
3. Predictive & Critical: Sectors marked as 'is_critical' (like PSRIO/PSI) should prioritize reaching their 'ideal_staff' (e.g. 3) when allocating.
4. Hierarchical Supervision: A "Técnico de Enfermagem" (or any rank requiring supervision) cannot work alone. They must be paired with at least one "Enfermeiro" (higher hierarchy_rank) in the same sector and shift.
5. Time-off Requests: Honor 'timeoff_requests'. If weight is high, block scheduling. "Dobradinha" (consecutive days off) should be prioritized if minimum staffing is met.
6. Hours & Shifts: Respect the assigned 'shift_type' work hours and rest hours. Total hours must not exceed 'hour_limit'. Do not schedule a shift if the 'shift_rest_hours' from the previous shift has not elapsed.
7. Individual Rules: If a user has 'assigned_rules', these rules override the general department rules for this specific professional.
8. Custom AI Rules: Apply all rules of type "custom_prompt" by following their textual descriptions in the "prompt" field precisely.
9. Output strictly a JSON array, representing the generated shifts. Assume default shifts start at 07:00:00.000Z and last for 'shift_work_hours'.

Output FORMAT (strictly JSON array):
[
  { "user_id": "...", "sector_id": "...", "start_time": "YYYY-MM-DD 07:00:00.000Z", "end_time": "YYYY-MM-DD 19:00:00.000Z" }
]
Only output the JSON array, no markdown or text.
`

    try {
      const res = $ai.chat({
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

      let content = res.choices[0].message.content.trim()
      if (content.startsWith('\`\`\`')) {
        content = content.replace(/^\`\`\`[a-z]*\n/, '').replace(/\n\`\`\`$/, '')
      }

      const generatedShifts = JSON.parse(content)

      // Process existing shifts
      // Delete existing shifts ONLY for the sectors being generated in this run
      const sectorIds = sectors.map((s) => s.id)
      const existingShifts = $app.findRecordsByFilter(
        'shifts',
        `cycle = {:cyc}`,
        '-created',
        10000,
        0,
        { cyc: cycleId },
      )
      existingShifts.forEach((s) => {
        if (sectorIds.includes(s.getString('sector'))) {
          $app.delete(s)
        }
      })

      // Save new shifts
      const shiftsCol = $app.findCollectionByNameOrId('shifts')
      for (const gs of generatedShifts) {
        if (!gs.user_id || !gs.sector_id || !gs.start_time || !gs.end_time) continue
        if (!sectors.find((s) => s.id === gs.sector_id)) continue

        const record = new Record(shiftsCol)
        record.set('user', gs.user_id)
        record.set('sector', gs.sector_id)
        record.set('cycle', cycleId)
        record.set('start_time', gs.start_time)
        record.set('end_time', gs.end_time)
        $app.save(record)
      }

      return e.json(200, { success: true, count: generatedShifts.length })
    } catch (err) {
      if (err.name === 'SyntaxError') {
        return e.json(500, { error: 'AI failed to generate a valid schedule structure.' })
      }
      return e.json(500, { error: err.message || 'Failed to generate shifts.' })
    }
  },
  $apis.requireAuth(),
)
