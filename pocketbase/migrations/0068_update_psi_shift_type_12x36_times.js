/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Atualizar shift_type jjpdawouvsppc8y ("12x36") com start_time='07:00' e end_time='19:00'
    try {
      const shiftType = app.findRecordById('shift_types', 'jjpdawouvsppc8y')
      shiftType.set('start_time', '07:00')
      shiftType.set('end_time', '19:00')
      app.save(shiftType)
    } catch (e) {
      // Caso não encontre por ID direto, busca por código ou nome para resiliência
      try {
        const byCode = app.findFirstRecordByData('shift_types', 'code', '12x36h')
        byCode.set('start_time', '07:00')
        byCode.set('end_time', '19:00')
        app.save(byCode)
      } catch (_) {}
    }

    // 2. Resiliência adicional de dados: qualquer outro shift_type 12x36 com horários vazios
    try {
      app
        .db()
        .newQuery(
          "UPDATE shift_types SET start_time = '07:00', end_time = '19:00' WHERE (start_time IS NULL OR start_time = '') AND work_hours = 12 AND rest_hours >= 36",
        )
        .execute()
    } catch (_) {}
  },
  (app) => {
    // Reversão segura e idempotente: não apaga registros
    try {
      const shiftType = app.findRecordById('shift_types', 'jjpdawouvsppc8y')
      shiftType.set('start_time', '')
      shiftType.set('end_time', '')
      app.save(shiftType)
    } catch (_) {}
  },
)
