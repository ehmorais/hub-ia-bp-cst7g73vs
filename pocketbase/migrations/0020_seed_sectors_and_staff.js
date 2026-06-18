migrate(
  (app) => {
    const deptsCol = app.findCollectionByNameOrId('departments')
    const staffCol = app.findCollectionByNameOrId('hospital_staff')

    const sectors = [
      'PSI',
      'PSA',
      'PSRIO',
      'SETOR DE IMAGEM',
      'UTI PED',
      '2º ANDAR',
      '3º ANDAR',
      '4º ANDAR',
      '5º ANDAR',
    ]

    let order = 100
    for (const s of sectors) {
      try {
        app.findFirstRecordByData('departments', 'name', s)
      } catch (_) {
        const record = new Record(deptsCol)
        record.set('name', s)
        record.set('sort_order', order++)
        app.save(record)
      }
    }

    const psi = app.findFirstRecordByData('departments', 'name', 'PSI')
    const andar2 = app.findFirstRecordByData('departments', 'name', '2º ANDAR')

    let adminUser = null
    try {
      adminUser = app.findFirstRecordByData('users', 'email', 'eduardo.morais@idcorp.com.br')
    } catch (_) {}

    const staffData = [
      {
        name: 'Viviane Supervisor',
        role: 'Supervisor',
        registry_id: 'SUP001',
        dept: psi.id,
        contract: '5x2',
        user_id: adminUser?.id,
      },
      {
        name: 'Luciene Nurse',
        role: 'Nurse',
        registry_id: 'NUR001',
        dept: psi.id,
        contract: '12x36',
        user_id: null,
      },
      {
        name: 'Henrique Tech',
        role: 'Technician',
        registry_id: 'TEC001',
        dept: psi.id,
        contract: '12x36',
        user_id: null,
      },
      {
        name: 'Ivani Tech',
        role: 'Technician',
        registry_id: 'TEC002',
        dept: andar2.id,
        contract: '12x36',
        user_id: null,
      },
    ]

    for (const s of staffData) {
      try {
        app.findFirstRecordByData('hospital_staff', 'registry_id', s.registry_id)
      } catch (_) {
        const record = new Record(staffCol)
        record.set('name', s.name)
        record.set('role', s.role)
        record.set('registry_id', s.registry_id)
        record.set('department', s.dept)
        record.set('contract_type', s.contract)
        if (s.user_id) record.set('user_id', s.user_id)
        app.save(record)
      }
    }
  },
  (app) => {},
)
