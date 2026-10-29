/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Obter todos os colaboradores ativos
    const activeProfiles = app.findRecordsByFilter('staff_profiles', 'active = true', 'id', 100, 0)

    // Agrupar por default_sector
    const adultSectorProfiles = []
    const infantilSectorProfiles = []
    const otherProfiles = []

    for (let i = 0; i < activeProfiles.length; i++) {
      const p = activeProfiles[i]
      const sector = p.getString('default_sector')
      if (sector === 'e8knxl3jy0s5ql5') {
        adultSectorProfiles.push(p)
      } else if (sector === 'i002523ouyotg6f') {
        infantilSectorProfiles.push(p)
      } else {
        otherProfiles.push(p)
      }
    }

    // Ordenação determinística e estável por id
    const sortById = (a, b) => {
      const idA = a.id
      const idB = b.id
      if (idA < idB) return -1
      if (idA > idB) return 1
      return 0
    }

    adultSectorProfiles.sort(sortById)
    infantilSectorProfiles.sort(sortById)
    otherProfiles.sort(sortById)

    const DATE_ODD = '2026-09-26 00:00:00.000Z'
    const DATE_EVEN = '2026-09-27 00:00:00.000Z'

    // Distribuição UTI ADULTO: 43 colaboradores -> 22 odd (índices 0, 2, 4...), 21 even (índices 1, 3, 5...)
    for (let i = 0; i < adultSectorProfiles.length; i++) {
      const p = adultSectorProfiles[i]
      const targetParity = i % 2 === 0 ? 'odd' : 'even'
      const targetDate = targetParity === 'odd' ? DATE_ODD : DATE_EVEN

      const currentParity = p.getString('shift_parity')
      const currentDate = p.getString('cycle_start_date')

      if (currentParity !== targetParity || currentDate !== targetDate) {
        p.set('shift_parity', targetParity)
        p.set('cycle_start_date', targetDate)
        app.save(p)
      }
    }

    // Distribuição UTI INFANTIL: 12 colaboradores -> 6 odd, 6 even
    // Amanda Ribeiro da Silva (id 11u8pfhaetke6xk) está no índice 0 (odd) por ordem alfabética de ID.
    // Preserva a paridade odd e data 2026-09-26 sem mutação desnecessária.
    for (let i = 0; i < infantilSectorProfiles.length; i++) {
      const p = infantilSectorProfiles[i]
      const targetParity = i % 2 === 0 ? 'odd' : 'even'
      const targetDate = targetParity === 'odd' ? DATE_ODD : DATE_EVEN

      const currentParity = p.getString('shift_parity')
      const currentDate = p.getString('cycle_start_date')

      if (currentParity !== targetParity || currentDate !== targetDate) {
        p.set('shift_parity', targetParity)
        p.set('cycle_start_date', targetDate)
        app.save(p)
      }
    }

    // Caso haja outros colaboradores ativos em outros setores futuros, manter distribuição alternada
    for (let i = 0; i < otherProfiles.length; i++) {
      const p = otherProfiles[i]
      const targetParity = i % 2 === 0 ? 'odd' : 'even'
      const targetDate = targetParity === 'odd' ? DATE_ODD : DATE_EVEN

      const currentParity = p.getString('shift_parity')
      const currentDate = p.getString('cycle_start_date')

      if (currentParity !== targetParity || currentDate !== targetDate) {
        p.set('shift_parity', targetParity)
        p.set('cycle_start_date', targetDate)
        app.save(p)
      }
    }
  },
  (app) => {
    // Reversão limpa os campos atribuídos mantendo a integridade
    const activeProfiles = app.findRecordsByFilter('staff_profiles', 'active = true', 'id', 100, 0)
    for (let i = 0; i < activeProfiles.length; i++) {
      const p = activeProfiles[i]
      // Manter Amanda intacta se ela já tinha
      if (p.id === '11u8pfhaetke6xk') {
        continue
      }
      p.set('shift_parity', '')
      p.set('cycle_start_date', '')
      app.save(p)
    }
  },
)
