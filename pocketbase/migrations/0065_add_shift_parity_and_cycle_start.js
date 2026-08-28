/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const profiles = app.findCollectionByNameOrId('staff_profiles')

    if (!profiles.fields.getByName('shift_parity')) {
      profiles.fields.add(
        new SelectField({
          name: 'shift_parity',
          values: ['even', 'odd'],
          maxSelect: 1,
        }),
      )
    }

    if (!profiles.fields.getByName('cycle_start_date')) {
      profiles.fields.add(
        new DateField({
          name: 'cycle_start_date',
        }),
      )
    }

    app.save(profiles)
  },
  (app) => {
    const profiles = app.findCollectionByNameOrId('staff_profiles')
    if (profiles.fields.getByName('shift_parity')) {
      profiles.fields.removeByName('shift_parity')
    }
    if (profiles.fields.getByName('cycle_start_date')) {
      profiles.fields.removeByName('cycle_start_date')
    }
    app.save(profiles)
  },
)
