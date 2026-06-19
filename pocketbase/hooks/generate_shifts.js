routerAdd(
  'POST',
  '/backend/v1/escala/generate',
  (e) => {
    const body = e.requestInfo().body || {}
    const cycleId = body.cycle_id
    const departmentId = body.department_id

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
    const sectors = $app.findRecordsByFilter(
      'hospital_sectors',
      `department = {:dep}`,
      '-created',
      100,
      0,
      { dep: departmentId },
    )

    const contracts = $app.findRecordsByFilter('staff_contracts', '', '-created', 1000, 0)
    const roles = $app.findRecordsByFilter('staff_roles', '', '-created', 1000, 0)
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
        usersWithContracts.push({
          id: u.id,
          name: u.getString('name'),
          contract_type: c.getString('contract_type'),
          hour_limit: c.getInt('monthly_hour_limit'),
          role: rName,
          role_id: rId,
          rank: rRank,
          requires_supervision: rSup,
        })
      } catch (_) {}
    })

    const sectorData = sectors.map((s) => ({
      id: s.id,
      name: s.getString('name'),
      min_staff: s.getInt('min_staffing'),
    }))

    const ruleData = rules.map((r) => ({
      name: r.getString('name'),
      type: r.getString('rule_type'),
      value: r.getInt('value'),
    }))

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
1. Ensure all sectors meet their 'min_staff' requirements per day if possible.
2. Staff cannot work on their requested timeoff dates if priority weight is high.
3. Staff requiring supervision must work in a sector with another staff of higher hierarchy_rank.
4. Total hours must not exceed hour_limit. Each shift is 12 hours long (assume 07:00 to 19:00 for simplicity).
5. Ensure a valid JSON array of shifts is returned.

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
      const existingShifts = $app.findRecordsByFilter(
        'shifts',
        `cycle = {:cyc}`,
        '-created',
        10000,
        0,
        { cyc: cycleId },
      )
      existingShifts.forEach((s) => {
        const sector = sectors.find((sec) => sec.id === s.getString('sector'))
        if (sector) {
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
