onRecordAfterUpdateSuccess((e) => {
  const adminId = e.auth?.id
  if (adminId) {
    const logs = $app.findCollectionByNameOrId('audit_logs')
    const record = new Record(logs)
    record.set('user', adminId)
    record.set('action', 'Scale Override')
    record.set('department', e.record.getString('department') || 'RH')
    record.set('details', `Escala ${e.record.id} alterada manualmente pelo usuário.`)
    $app.save(record)
  }
  e.next()
}, 'hospital_scales')
