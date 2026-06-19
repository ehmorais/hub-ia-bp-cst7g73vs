migrate(
  (app) => {
    // Seed Cycles
    try {
      app.findFirstRecordByData('shift_cycles', 'name', 'Ciclo Março/Abril 2026')
    } catch (_) {
      const col = app.findCollectionByNameOrId('shift_cycles')
      const r = new Record(col)
      r.set('name', 'Ciclo Março/Abril 2026')
      r.set('start_date', '2026-03-26 00:00:00.000Z')
      r.set('end_date', '2026-04-25 23:59:59.000Z')
      r.set('request_deadline', '2026-03-15 23:59:59.000Z')
      r.set('status', 'active')
      app.save(r)
    }

    // Seed Sectors
    const depCol = app.findCollectionByNameOrId('departments')
    let depId = null
    try {
      const dep = app.findFirstRecordByData('departments', 'name', 'Projetos Gerais')
      depId = dep.id
    } catch (_) {
      try {
        const dep = app.findFirstRecordByData('departments', 'name', 'Recursos Humanos')
        depId = dep.id
      } catch (_) {}
    }

    if (depId) {
      try {
        app.findFirstRecordByData('hospital_sectors', 'name', 'UTI Adulto')
      } catch (_) {
        const col = app.findCollectionByNameOrId('hospital_sectors')
        const r = new Record(col)
        r.set('name', 'UTI Adulto')
        r.set('department', depId)
        r.set('min_staffing', 5)
        r.set('ideal_staffing', 8)
        app.save(r)
      }

      try {
        app.findFirstRecordByData('hospital_sectors', 'name', 'Pronto Socorro')
      } catch (_) {
        const col = app.findCollectionByNameOrId('hospital_sectors')
        const r = new Record(col)
        r.set('name', 'Pronto Socorro')
        r.set('department', depId)
        r.set('min_staffing', 8)
        r.set('ideal_staffing', 12)
        app.save(r)
      }
    }

    // Seed Roles
    try {
      app.findFirstRecordByData('staff_roles', 'name', 'Enfermeiro')
    } catch (_) {
      const col = app.findCollectionByNameOrId('staff_roles')
      const r = new Record(col)
      r.set('name', 'Enfermeiro')
      r.set('hierarchy_rank', 2)
      r.set('requires_supervision', false)
      app.save(r)
    }

    try {
      app.findFirstRecordByData('staff_roles', 'name', 'Técnico de Enfermagem')
    } catch (_) {
      const col = app.findCollectionByNameOrId('staff_roles')
      const r = new Record(col)
      r.set('name', 'Técnico de Enfermagem')
      r.set('hierarchy_rank', 1)
      r.set('requires_supervision', true)
      app.save(r)
    }

    // Seed Contracts for the admin user
    try {
      const admin = app.findFirstRecordByData('users', 'email', 'eduardo.morais@idcorp.com.br')
      try {
        app.findFirstRecordByData('staff_contracts', 'user', admin.id)
      } catch (_) {
        const col = app.findCollectionByNameOrId('staff_contracts')
        const r = new Record(col)
        r.set('user', admin.id)
        r.set('contract_type', 'CLT 180h')
        r.set('monthly_hour_limit', 180)
        app.save(r)
      }
    } catch (_) {}
  },
  (app) => {
    // Empty down migration
  },
)
