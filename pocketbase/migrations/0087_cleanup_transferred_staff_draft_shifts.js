migrate(
  (app) => {
    app.runInTransaction((txApp) => {
      // Reconciliação idempotente de plantões órfãos/obsoletos:
      // Remove plantões em que o setor do plantão difere do setor padrão atual do colaborador
      // (caso típico: colaborador transferido de setor, ex: ROBERTA KELLI MAURI e VIVIANNE MORENO
      // transferidas para CC - Centro Cirúrgico, mantendo rascunhos anteriores em UTI Adulto).
      const shifts = txApp.findRecordsByFilter(
        'shifts',
        "staff_profile != ''",
        '-created',
        10000,
        0,
      )
      shifts.forEach((s) => {
        try {
          const profile = txApp.findRecordById('staff_profiles', s.getString('staff_profile'))
          const defaultSec = profile.getString('default_sector')
          if (defaultSec && defaultSec !== s.getString('sector')) {
            txApp.delete(s)
          }
        } catch (_) {}
      })
    })
  },
  (app) => {
    // Reconciliação não-destrutiva de dados.
  },
)
