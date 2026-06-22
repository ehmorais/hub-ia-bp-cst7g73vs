migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('shift_types')
    const seeds = [
      {
        name: 'Manhã',
        start_time: '07:00',
        end_time: '13:00',
        code: 'MANHA',
        work_hours: 6,
        rest_hours: 18,
        is_administrative: false,
      },
      {
        name: 'Tarde',
        start_time: '13:00',
        end_time: '19:00',
        code: 'TARDE',
        work_hours: 6,
        rest_hours: 18,
        is_administrative: false,
      },
      {
        name: 'Noite',
        start_time: '19:00',
        end_time: '07:00',
        code: 'NOITE',
        work_hours: 12,
        rest_hours: 36,
        is_administrative: false,
      },
      {
        name: 'Especial',
        start_time: '08:00',
        end_time: '17:00',
        code: 'ESPECIAL',
        work_hours: 9,
        rest_hours: 15,
        is_administrative: false,
      },
    ]

    for (const s of seeds) {
      try {
        const record = app.findFirstRecordByData('shift_types', 'name', s.name)
        record.set('start_time', s.start_time)
        record.set('end_time', s.end_time)
        if (!record.getString('code')) {
          record.set('code', s.code)
        }
        app.save(record)
      } catch (_) {
        const record = new Record(col)
        record.set('name', s.name)
        record.set('code', s.code)
        record.set('work_hours', s.work_hours)
        record.set('rest_hours', s.rest_hours)
        record.set('is_administrative', s.is_administrative)
        record.set('start_time', s.start_time)
        record.set('end_time', s.end_time)
        app.save(record)
      }
    }
  },
  (app) => {
    // down migration is a no-op
  },
)
