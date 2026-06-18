onRecordAfterUpdateSuccess((e) => {
  const original = e.record.original()
  const current = e.record

  if (original.getString('status') === 'Published') {
    try {
      const log = new Record($app.findCollectionByNameOrId('audit_logs'))
      log.set('action', 'SHIFT_MODIFIED_AFTER_PUBLICATION')
      log.set('user', e.auth ? e.auth.id : null)
      log.set(
        'details',
        `Escala alterada após publicação. Staff ID: ${current.get('staff_id')}, Data: ${current.getString('date')}`,
      )
      $app.save(log)
    } catch (err) {
      console.log('Failed to log audit for shift', err)
    }
  }
  e.next()
}, 'shifts')
