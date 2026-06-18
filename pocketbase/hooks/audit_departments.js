onRecordCreateRequest((e) => {
  e.next()
  const audit = new Record($app.findCollectionByNameOrId('audit_logs'))
  audit.set('user', e.auth?.id || '')
  audit.set('action', 'Created Department: ' + e.record.getString('name'))
  audit.set('department', e.record.id)
  audit.set('details', JSON.stringify({ id: e.record.id, name: e.record.getString('name') }))
  $app.saveNoValidate(audit)
}, 'departments')

onRecordUpdateRequest((e) => {
  e.next()
  const audit = new Record($app.findCollectionByNameOrId('audit_logs'))
  audit.set('user', e.auth?.id || '')
  audit.set('action', 'Updated Department: ' + e.record.getString('name'))
  audit.set('department', e.record.id)
  audit.set('details', JSON.stringify({ id: e.record.id, name: e.record.getString('name') }))
  $app.saveNoValidate(audit)
}, 'departments')

onRecordDeleteRequest((e) => {
  e.next()
  const audit = new Record($app.findCollectionByNameOrId('audit_logs'))
  audit.set('user', e.auth?.id || '')
  audit.set('action', 'Deleted Department: ' + e.record.getString('name'))
  audit.set('department', e.record.id)
  audit.set('details', JSON.stringify({ id: e.record.id, name: e.record.getString('name') }))
  $app.saveNoValidate(audit)
}, 'departments')
