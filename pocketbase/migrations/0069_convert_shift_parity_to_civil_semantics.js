/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Verificar idempotência via marcador na tabela audit_logs
    const existingLogs = app.findRecordsByFilter(
      'audit_logs',
      "action = 'MIGRATION_0069_CIVIL_PARITY_CONVERTED'",
      '',
      1,
      0,
    )
    if (existingLogs && existingLogs.length > 0) {
      console.log('[0069] Migração já aplicada anteriormente (marcador encontrado). No-op.')
      return
    }

    // 2. Coletar contagens ANTES da migração
    const evenBefore = app.findRecordsByFilter(
      'staff_profiles',
      "shift_parity = 'even'",
      '',
      10000,
      0,
    )
    const oddBefore = app.findRecordsByFilter(
      'staff_profiles',
      "shift_parity = 'odd'",
      '',
      10000,
      0,
    )
    const countEvenBefore = evenBefore ? evenBefore.length : 0
    const countOddBefore = oddBefore ? oddBefore.length : 0

    // 3. Executar a conversão atômica em SQLite:
    // even -> odd, odd -> even, usando valor temporário '__temp__' para segurança absoluta
    app
      .db()
      .newQuery("UPDATE staff_profiles SET shift_parity = '__temp__' WHERE shift_parity = 'even'")
      .execute()
    app
      .db()
      .newQuery("UPDATE staff_profiles SET shift_parity = 'even' WHERE shift_parity = 'odd'")
      .execute()
    app
      .db()
      .newQuery("UPDATE staff_profiles SET shift_parity = 'odd' WHERE shift_parity = '__temp__'")
      .execute()

    // 4. Coletar contagens DEPOIS da migração
    const evenAfter = app.findRecordsByFilter(
      'staff_profiles',
      "shift_parity = 'even'",
      '',
      10000,
      0,
    )
    const oddAfter = app.findRecordsByFilter('staff_profiles', "shift_parity = 'odd'", '', 10000, 0)
    const countEvenAfter = evenAfter ? evenAfter.length : 0
    const countOddAfter = oddAfter ? oddAfter.length : 0

    // 5. Verificar o caso real da colaboradora Laodiceia da Silva Goes Dias
    let laodiceiaParityAfter = ''
    const laoRecords = app.findRecordsByFilter('staff_profiles', "name ~ 'Laodiceia'", '', 1, 0)
    if (laoRecords && laoRecords.length > 0) {
      laodiceiaParityAfter = laoRecords[0].getString('shift_parity')
    }

    const auditDetails = JSON.stringify({
      migration: '0069_convert_shift_parity_to_civil_semantics',
      counts_before: {
        even: countEvenBefore,
        odd: countOddBefore,
      },
      counts_after: {
        even: countEvenAfter,
        odd: countOddAfter,
      },
      laodiceia_parity: laodiceiaParityAfter,
      status: 'success',
    })

    // 6. Registrar marcador auditável em audit_logs
    try {
      const auditCol = app.findCollectionByNameOrId('audit_logs')
      const auditRecord = new Record(auditCol)
      auditRecord.set('action', 'MIGRATION_0069_CIVIL_PARITY_CONVERTED')
      auditRecord.set('department', 'Enfermagem')
      auditRecord.set('token_usage', 0)
      auditRecord.set('details', auditDetails)
      app.save(auditRecord)
    } catch (e) {
      console.log('[0069] Falha ao gravar log de auditoria: ' + e)
    }

    console.log('[0069] Migração concluída com sucesso: ' + auditDetails)
  },
  (app) => {
    // Reversão segura: desfaz a inversão e remove o marcador de auditoria
    app
      .db()
      .newQuery("UPDATE staff_profiles SET shift_parity = '__temp__' WHERE shift_parity = 'even'")
      .execute()
    app
      .db()
      .newQuery("UPDATE staff_profiles SET shift_parity = 'even' WHERE shift_parity = 'odd'")
      .execute()
    app
      .db()
      .newQuery("UPDATE staff_profiles SET shift_parity = 'odd' WHERE shift_parity = '__temp__'")
      .execute()

    try {
      const markers = app.findRecordsByFilter(
        'audit_logs',
        "action = 'MIGRATION_0069_CIVIL_PARITY_CONVERTED'",
        '',
        100,
        0,
      )
      if (markers && markers.length > 0) {
        markers.forEach((m) => {
          try {
            app.delete(m)
          } catch (_) {}
        })
      }
    } catch (_) {}
  },
)
