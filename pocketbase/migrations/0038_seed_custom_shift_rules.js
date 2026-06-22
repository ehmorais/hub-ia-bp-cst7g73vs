migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('shift_rules')

    const findDept = (searchName) => {
      try {
        const records = app.findRecordsByFilter('departments', `name ~ '${searchName}'`, '', 1, 0)
        if (records.length > 0) return records[0].id
      } catch (_) {}

      try {
        const fallback = app.findRecordsByFilter('departments', '', '', 1, 0)
        if (fallback.length > 0) return fallback[0].id
      } catch (_) {}

      return null
    }

    const utiDept = findDept('UTI')
    const pedDept = findDept('Pediatria')
    const geralDept = findDept('Geral')

    const rules = [
      {
        name: 'Mínimo de Enfermeiros Seniores - UTI',
        rule_type: 'professional_mix',
        value: 2,
        department: utiDept || geralDept,
      },
      {
        name: 'Limite de Plantões Noturnos Consecutivos',
        rule_type: 'max_consecutive',
        value: 2,
        department: geralDept,
      },
      {
        name: 'Descanso Pós-Plantão 24h',
        rule_type: 'min_rest_hours',
        value: 36,
        department: geralDept,
      },
      {
        name: 'Limite de Fins de Semana por Ciclo',
        rule_type: 'other',
        value: 2,
        department: geralDept,
      },
      {
        name: 'Equipe Especializada em Sazonalidade',
        rule_type: 'custom_prompt',
        value: 1,
        prompt:
          'Durante os meses de inverno, priorizar a escala de fisioterapeutas respiratórios no período da manhã e garantir que nunca haja menos de 2 pediatras plantonistas simultâneos.',
        department: pedDept || geralDept,
      },
    ]

    for (const r of rules) {
      if (!r.department) continue
      try {
        app.findFirstRecordByData('shift_rules', 'name', r.name)
      } catch (_) {
        const record = new Record(col)
        record.set('name', r.name)
        record.set('rule_type', r.rule_type)
        record.set('value', r.value)
        if (r.prompt) record.set('prompt', r.prompt)
        record.set('department', r.department)
        app.save(record)
      }
    }
  },
  (app) => {
    const names = [
      'Mínimo de Enfermeiros Seniores - UTI',
      'Limite de Plantões Noturnos Consecutivos',
      'Descanso Pós-Plantão 24h',
      'Limite de Fins de Semana por Ciclo',
      'Equipe Especializada em Sazonalidade',
    ]
    for (const name of names) {
      try {
        const record = app.findFirstRecordByData('shift_rules', 'name', name)
        app.delete(record)
      } catch (_) {}
    }
  },
)
