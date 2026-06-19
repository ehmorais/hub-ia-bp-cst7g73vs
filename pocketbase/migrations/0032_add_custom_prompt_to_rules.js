migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('shift_rules')

    const ruleTypeField = col.fields.getByName('rule_type')
    if (!ruleTypeField.values.includes('custom_prompt')) {
      ruleTypeField.values.push('custom_prompt')
    }

    if (!col.fields.getByName('prompt')) {
      col.fields.add(
        new TextField({
          name: 'prompt',
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('shift_rules')

    const ruleTypeField = col.fields.getByName('rule_type')
    if (ruleTypeField) {
      ruleTypeField.values = ruleTypeField.values.filter((v) => v !== 'custom_prompt')
    }

    const promptField = col.fields.getByName('prompt')
    if (promptField) {
      col.fields.removeByName('prompt')
    }

    app.save(col)
  },
)
