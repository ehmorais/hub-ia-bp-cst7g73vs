onRecordValidate((e) => {
  const userId = e.record.get('user')
  const cycleId = e.record.get('cycle')
  if (!userId || !cycleId) return e.next()

  const existing = $app.findRecordsByFilter(
    'timeoff_requests',
    `user = '${userId}' && cycle = '${cycleId}'`,
    '',
    3,
    0,
  )

  let count = 0
  for (const rec of existing) {
    if (rec.id !== e.record.id) {
      count++
    }
  }

  if (count >= 2) {
    throw new BadRequestError('Limite de 2 folgas por ciclo atingido', {
      date: new ValidationError('limit_reached', 'Limite de 2 folgas por ciclo atingido'),
    })
  }
  e.next()
}, 'timeoff_requests')
