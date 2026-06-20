onRecordBeforeCreateRequest((e) => {
  const body = e.requestInfo().body || {}
  const code = body.code
  if (code) {
    try {
      $app.findFirstRecordByData('shift_types', 'code', code)
      throw new BadRequestError('Código de turno já existe.', {
        code: new ValidationError('validation_not_unique', 'Código de turno já existe.'),
      })
    } catch (err) {
      if (err instanceof BadRequestError) throw err
    }
  }
  e.next()
}, 'shift_types')

onRecordBeforeUpdateRequest((e) => {
  const body = e.requestInfo().body || {}
  const code = body.code
  if (code && code !== e.record.getString('code')) {
    try {
      $app.findFirstRecordByData('shift_types', 'code', code)
      throw new BadRequestError('Código de turno já existe.', {
        code: new ValidationError('validation_not_unique', 'Código de turno já existe.'),
      })
    } catch (err) {
      if (err instanceof BadRequestError) throw err
    }
  }
  e.next()
}, 'shift_types')

onRecordBeforeDeleteRequest((e) => {
  const linked = $app.findRecordsByFilter(
    'staff_contracts',
    `shift_type = '${e.record.id}'`,
    '',
    1,
    0,
  )
  if (linked && linked.length > 0) {
    throw new BadRequestError(
      'Não é possível excluir este turno pois está vinculado a contratos.',
      { shift_type: new ValidationError('validation_linked', 'Turno em uso por contratos.') },
    )
  }
  e.next()
}, 'shift_types')
