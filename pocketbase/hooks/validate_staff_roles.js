onRecordCreateRequest((e) => {
  const body = e.requestInfo().body || {}
  const rawName = body.name !== undefined ? String(body.name) : e.record.getString('name')
  const trimmedName = (rawName || '').trim()

  if (!trimmedName) {
    throw new BadRequestError('Nome da função é obrigatório.', {
      name: new ValidationError('validation_required', 'Nome da função é obrigatório.'),
    })
  }

  const allRoles = $app.findRecordsByFilter('staff_roles', '', '', 1000, 0)
  const isDuplicate = allRoles.some(
    (r) => r.getString('name').trim().toLowerCase() === trimmedName.toLowerCase(),
  )

  if (isDuplicate) {
    throw new BadRequestError('Já existe uma função cadastrada com este nome.', {
      name: new ValidationError('validation_not_unique', 'Já existe uma função com este nome.'),
    })
  }

  e.record.set('name', trimmedName)
  e.next()
}, 'staff_roles')

onRecordUpdateRequest((e) => {
  const body = e.requestInfo().body || {}
  if (body.name === undefined) {
    return e.next()
  }

  const rawName = String(body.name)
  const trimmedName = rawName.trim()

  if (!trimmedName) {
    throw new BadRequestError('Nome da função é obrigatório.', {
      name: new ValidationError('validation_required', 'Nome da função é obrigatório.'),
    })
  }

  const currentRecordId = e.record.id
  const allRoles = $app.findRecordsByFilter('staff_roles', '', '', 1000, 0)
  const isDuplicate = allRoles.some(
    (r) =>
      r.id !== currentRecordId &&
      r.getString('name').trim().toLowerCase() === trimmedName.toLowerCase(),
  )

  if (isDuplicate) {
    throw new BadRequestError('Já existe uma função cadastrada com este nome.', {
      name: new ValidationError('validation_not_unique', 'Já existe uma função com este nome.'),
    })
  }

  e.record.set('name', trimmedName)
  e.next()
}, 'staff_roles')
