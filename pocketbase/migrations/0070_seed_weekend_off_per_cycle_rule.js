migrate(
  (app) => {
    const rules = app.findRecordsByFilter('shift_rules', '', 'name', 10000, 0)
    const departments = app.findRecordsByFilter('departments', '', 'name', 10000, 0)
    const ruleName = 'Folga de sábado ou domingo por ciclo'

    departments.forEach((department) => {
      const exists = rules.some(
        (rule) =>
          rule.getString('name') === ruleName && rule.getString('department') === department.id,
      )
      if (exists) return

      const record = new Record(app.findCollectionByNameOrId('shift_rules'))
      record.set('name', ruleName)
      record.set('rule_type', 'other')
      record.set('value', 1)
      record.set('department', department.id)
      app.save(record)
    })
  },
  (app) => {
    const rules = app.findRecordsByFilter(
      'shift_rules',
      "name = 'Folga de sábado ou domingo por ciclo'",
      '',
      10000,
      0,
    )
    rules.forEach((rule) => app.delete(rule))
  },
)
