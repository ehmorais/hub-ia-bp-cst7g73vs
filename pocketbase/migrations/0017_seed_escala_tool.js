migrate(
  (app) => {
    const toolsCol = app.findCollectionByNameOrId('ia_tools')
    const depts = app.findRecordsByFilter('departments', "name != ''", '', 1, 0)
    const deptId = depts.length > 0 ? depts[0].id : null

    try {
      app.findFirstRecordByData('ia_tools', 'name', 'Escala Expert HBPSCS')
    } catch (_) {
      const record = new Record(toolsCol)
      record.set('name', 'Escala Expert HBPSCS')
      record.set(
        'description',
        'Geração e gestão inteligente de escalas de enfermagem baseada em regras trabalhistas.',
      )
      record.set('model_alias', 'reasoning')
      record.set('status', 'active')
      record.set('version', 'v1.0.0')
      if (deptId) {
        record.set('associated_departments', [deptId])
      }
      app.save(record)
    }

    const staffCol = app.findCollectionByNameOrId('hospital_staff')
    if (deptId) {
      const staffData = [
        { name: 'Ana Silva', registry_id: 'COREN-111', role: 'Nurse', contracted_hours: 180 },
        {
          name: 'Carlos Santos',
          registry_id: 'COREN-222',
          role: 'Supervisor',
          contracted_hours: 180,
        },
        {
          name: 'Mariana Costa',
          registry_id: 'COREN-333',
          role: 'Technician',
          contracted_hours: 180,
        },
      ]

      for (const s of staffData) {
        try {
          app.findFirstRecordByData('hospital_staff', 'registry_id', s.registry_id)
        } catch (_) {
          const record = new Record(staffCol)
          record.set('name', s.name)
          record.set('registry_id', s.registry_id)
          record.set('role', s.role)
          record.set('department', deptId)
          record.set('contracted_hours', s.contracted_hours)
          app.save(record)
        }
      }
    }
  },
  (app) => {
    try {
      const r = app.findFirstRecordByData('ia_tools', 'name', 'Escala Expert HBPSCS')
      app.delete(r)
    } catch (_) {}
  },
)
