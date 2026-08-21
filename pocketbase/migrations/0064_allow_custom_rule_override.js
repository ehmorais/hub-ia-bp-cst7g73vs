migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('shift_rules')
    const valueField = col.fields.getByName('value')
    if (valueField) {
      valueField.required = false
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('shift_rules')
    const customRules = app.findRecordsByFilter(
      'shift_rules',
      "rule_type = 'custom_prompt'",
      '-created',
      10000,
      0,
    )
    customRules.forEach((record) => {
      if (!record.get('value')) {
        record.set('value', 1)
        app.save(record)
      }
    })
    const valueField = col.fields.getByName('value')
    if (valueField) {
      valueField.required = true
    }
    app.save(col)
  },
)
