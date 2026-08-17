migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('hospital_sectors')

    // 1. Add `active` bool field (default true) — never required so false is
    //    accepted (PocketBase treats false as the empty value for bools).
    if (!col.fields.getByName('active')) {
      col.fields.add(new BoolField({ name: 'active', required: false }))
    }

    // 2. Index the new flag for list filtering.
    col.addIndex('idx_hospital_sectors_active', false, 'active', '')

    app.save(col)

    // 3. Backfill every existing sector to active = true (idempotent — only
    //    sets rows that are NULL).
    app
      .db()
      .newQuery('UPDATE hospital_sectors SET active = 1 WHERE active IS NULL OR active = 0')
      .execute()
  },
  (app) => {
    const col = app.findCollectionByNameOrId('hospital_sectors')

    if (col.fields.getByName('active')) {
      col.fields.removeByName('active')
    }
    col.removeIndex('idx_hospital_sectors_active')

    app.save(col)
  },
)
