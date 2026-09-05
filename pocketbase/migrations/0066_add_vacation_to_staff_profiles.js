/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('staff_profiles')

    // 1. vacation_enabled: boolean, default false
    if (!collection.fields.getByName('vacation_enabled')) {
      collection.fields.addAt(
        collection.fields.length,
        new BoolField({
          name: 'vacation_enabled',
          required: false,
        }),
      )
    }

    // 2. vacation_start: date
    if (!collection.fields.getByName('vacation_start')) {
      collection.fields.addAt(
        collection.fields.length,
        new DateField({
          name: 'vacation_start',
          required: false,
        }),
      )
    }

    // 3. vacation_end: date
    if (!collection.fields.getByName('vacation_end')) {
      collection.fields.addAt(
        collection.fields.length,
        new DateField({
          name: 'vacation_end',
          required: false,
        }),
      )
    }

    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('staff_profiles')

    if (collection.fields.getByName('vacation_enabled')) {
      collection.fields.removeByName('vacation_enabled')
    }
    if (collection.fields.getByName('vacation_start')) {
      collection.fields.removeByName('vacation_start')
    }
    if (collection.fields.getByName('vacation_end')) {
      collection.fields.removeByName('vacation_end')
    }

    app.save(collection)
  },
)
