migrate(
  (app) => {
    const rules = app.findRecordsByFilter(
      'shift_rules',
      "rule_type = 'max_hours' && value = 44",
      'created',
      1000,
      0,
    )

    for (const rule of rules) {
      rule.set('name', 'Limite mensal de horas (contrato CLT 180h)')
      rule.set('value', 180)
      rule.set(
        'prompt',
        'Limite mensal de referência: 180 horas. O limite individual registrado em staff_contracts.monthly_hour_limit é a fonte de verdade.',
      )
      app.save(rule)
    }

    console.log(
      'Normalização max_hours: ' +
        rules.length +
        ' regra(s) de 44h semanais convertida(s) para 180h mensais.',
    )
  },
  (app) => {
    const rules = app.findRecordsByFilter(
      'shift_rules',
      "rule_type = 'max_hours' && name = 'Limite mensal de horas (contrato CLT 180h)'",
      'created',
      1000,
      0,
    )

    for (const rule of rules) {
      rule.set('name', 'Limite semanal de horas')
      rule.set('value', 44)
      rule.set('prompt', '')
      app.save(rule)
    }
  },
)
