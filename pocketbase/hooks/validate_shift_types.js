onRecordCreateRequest((e) => {
  const body = e.requestInfo().body || {}
  const code = body.code
  const isAdministrative =
    body.is_administrative !== undefined
      ? Boolean(body.is_administrative)
      : e.record.getBool('is_administrative')
  const startTime =
    body.start_time !== undefined ? body.start_time : e.record.getString('start_time')
  const endTime = body.end_time !== undefined ? body.end_time : e.record.getString('end_time')

  if (!isAdministrative && (!startTime || !endTime)) {
    throw new BadRequestError(
      'Horário de início e horário de fim são obrigatórios para turnos operacionais (não administrativos).',
      {
        start_time: new ValidationError(
          'validation_required',
          'Horário de início é obrigatório para turnos operacionais.',
        ),
        end_time: new ValidationError(
          'validation_required',
          'Horário de fim é obrigatório para turnos operacionais.',
        ),
      },
    )
  }

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

onRecordUpdateRequest((e) => {
  const body = e.requestInfo().body || {}
  const code = body.code
  const isAdministrative =
    body.is_administrative !== undefined
      ? Boolean(body.is_administrative)
      : e.record.getBool('is_administrative')
  const startTime =
    body.start_time !== undefined ? body.start_time : e.record.getString('start_time')
  const endTime = body.end_time !== undefined ? body.end_time : e.record.getString('end_time')

  if (!isAdministrative && (!startTime || !endTime)) {
    throw new BadRequestError(
      'Horário de início e horário de fim são obrigatórios para turnos operacionais (não administrativos).',
      {
        start_time: new ValidationError(
          'validation_required',
          'Horário de início é obrigatório para turnos operacionais.',
        ),
        end_time: new ValidationError(
          'validation_required',
          'Horário de fim é obrigatório para turnos operacionais.',
        ),
      },
    )
  }

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

onRecordDeleteRequest((e) => {
  const linked = $app.findRecordsByFilter(
    'staff_contracts',
    `shift_type = '${e.record.id}'`,
    '',
    1,
    0,
  )
  if (linked && linked.length > 0) {
    throw new BadRequestError(
      'Não é possível excluir este turno pois está vinculado a contratos ativos ou plantões gerados.',
      {
        shift_type: new ValidationError(
          'validation_linked',
          'Turno em uso por contratos/plantões.',
        ),
      },
    )
  }
  e.next()
}, 'shift_types')
