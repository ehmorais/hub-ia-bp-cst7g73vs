onRecordValidate((e) => {
  const staffProfileId = e.record.get('staff_profile')
  const userId = e.record.get('user')
  const cycleId = e.record.get('cycle')
  const collaboratorId = staffProfileId || userId

  if (!collaboratorId || !cycleId) return e.next()

  const relationField = staffProfileId ? 'staff_profile' : 'user'
  const existing = $app.findRecordsByFilter(
    'timeoff_requests',
    relationField + " = '" + collaboratorId + "' && cycle = '" + cycleId + "'",
    '',
    3,
    0,
  )

  let count = 0
  for (const rec of existing) {
    if (rec.id !== e.record.id) count++
  }

  if (count >= 2) {
    throw new BadRequestError('Limite de 2 folgas por ciclo atingido', {
      date: new ValidationError('limit_reached', 'Limite de 2 folgas por ciclo atingido'),
    })
  }
  e.next()
}, 'timeoff_requests')
