onRecordCreateRequest((e) => {
  const profileId = e.record.getString('staff_profile')
  const startTime = e.record.getString('start_time')
  if (!profileId || !startTime) {
    return e.next()
  }

  const shiftDate = startTime.split(' ')[0].split('T')[0]
  if (!shiftDate) {
    return e.next()
  }

  try {
    const profile = $app.findRecordById('staff_profiles', profileId)
    const vacEnabled = profile.getBool('vacation_enabled')
    const vacStart = (profile.getString('vacation_start') || '').split(' ')[0].split('T')[0]
    const vacEnd = (profile.getString('vacation_end') || '').split(' ')[0].split('T')[0]

    if (vacEnabled === true && vacStart && vacEnd && vacStart <= vacEnd) {
      if (shiftDate >= vacStart && shiftDate <= vacEnd) {
        throw new BadRequestError('Colaborador está de férias no período.', {
          start_time: new ValidationError(
            'vacation_conflict',
            'Colaborador está de férias no período.',
          ),
        })
      }
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err
  }

  e.next()
}, 'shifts')

onRecordUpdateRequest((e) => {
  const profileId = e.record.getString('staff_profile')
  const startTime = e.record.getString('start_time')
  if (!profileId || !startTime) {
    return e.next()
  }

  const shiftDate = startTime.split(' ')[0].split('T')[0]
  if (!shiftDate) {
    return e.next()
  }

  try {
    const profile = $app.findRecordById('staff_profiles', profileId)
    const vacEnabled = profile.getBool('vacation_enabled')
    const vacStart = (profile.getString('vacation_start') || '').split(' ')[0].split('T')[0]
    const vacEnd = (profile.getString('vacation_end') || '').split(' ')[0].split('T')[0]

    if (vacEnabled === true && vacStart && vacEnd && vacStart <= vacEnd) {
      if (shiftDate >= vacStart && shiftDate <= vacEnd) {
        throw new BadRequestError('Colaborador está de férias no período.', {
          start_time: new ValidationError(
            'vacation_conflict',
            'Colaborador está de férias no período.',
          ),
        })
      }
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err
  }

  e.next()
}, 'shifts')
