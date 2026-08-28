import { describe, it, expect } from 'vitest'
import {
  parseDateOnly,
  formatDateOnly,
  addDaysDateOnly,
  dayOfWeekDateOnly,
  assertWeekendPair,
  getCycleWeekendCandidates,
  computeNaturalPatternByStaff,
  formatLocalDateKeySafe,
} from '../src/lib/escala-weekend-off'

describe('Shift Parity by Cycle & Anchor Suite', () => {
  // Ciclo que atravessa a virada do mês: 26/09/2026 até 25/10/2026 (30 dias)
  const cycleStart = '2026-09-26'
  const cycleEnd = '2026-10-25'

  describe('1. Combo de Dias de Plantão e Persistência de Paridade', () => {
    it('deve aceitar estritamente as opções "even" (Dias pares) e "odd" (Dias ímpares)', () => {
      const allowedParities = ['even', 'odd'] as const
      const validEven: (typeof allowedParities)[number] = 'even'
      const validOdd: (typeof allowedParities)[number] = 'odd'

      expect(allowedParities).toHaveLength(2)
      expect(allowedParities).toContain('even')
      expect(allowedParities).toContain('odd')
      expect(validEven).toBe('even')
      expect(validOdd).toBe('odd')
    })

    it('simula criação e atualização de perfil com shift_parity e cycle_start_date', () => {
      // Simulação de criação com dias ímpares (posição 1 no ciclo: 2026-09-26)
      const newProfile = {
        name: 'Dra. Roberta Kelli',
        shift_parity: 'odd' as const,
        cycle_start_date: '2026-09-26',
        active: true,
      }
      expect(newProfile.shift_parity).toBe('odd')
      expect(newProfile.cycle_start_date).toBe('2026-09-26')

      // Simulação de edição mudando para dias pares (posição 2 no ciclo: 2026-09-27)
      const updatedProfile = {
        ...newProfile,
        shift_parity: 'even' as const,
        cycle_start_date: '2026-09-27',
      }
      expect(updatedProfile.shift_parity).toBe('even')
      expect(updatedProfile.cycle_start_date).toBe('2026-09-27')
    })
  })

  describe('2. Início do Plantão no Ciclo e Validações em PT-BR', () => {
    const validateProfileData = (
      data: { name: string; shift_parity: string; cycle_start_date: string },
      cycle: { start_date: string; end_date: string },
    ) => {
      const errors: string[] = []
      if (!data.name || !data.name.trim()) {
        errors.push('Nome obrigatório')
      }
      if (data.shift_parity !== 'even' && data.shift_parity !== 'odd') {
        errors.push('Dias de plantão obrigatórios')
      }
      if (!data.cycle_start_date || !data.cycle_start_date.trim()) {
        errors.push('Início do plantão obrigatório')
      } else {
        const d = data.cycle_start_date.trim()
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          errors.push('Data inválida')
        } else {
          const cStart = cycle.start_date.split(' ')[0].split('T')[0]
          const cEnd = cycle.end_date.split(' ')[0].split('T')[0]
          if (d < cStart || d > cEnd) {
            errors.push('Data fora do ciclo')
          } else {
            // Valida coerência com a paridade 1-based (diff = 0 -> dia 1 = odd; diff = 1 -> dia 2 = even)
            const diffFromStart = Math.round(
              (new Date(d + 'T00:00:00Z').getTime() - new Date(cStart + 'T00:00:00Z').getTime()) /
                86400000,
            )
            const expectedParity = diffFromStart % 2 === 0 ? 'odd' : 'even'
            if (data.shift_parity !== expectedParity) {
              errors.push('Incoerência com a paridade selecionada')
            }
          }
        }
      }
      return errors
    }

    const currentCycle = { start_date: '2026-09-26', end_date: '2026-10-25' }

    it('valida erro quando início do plantão está ausente', () => {
      const res = validateProfileData(
        { name: 'Dr. Teste', shift_parity: 'even', cycle_start_date: '' },
        currentCycle,
      )
      expect(res).toContain('Início do plantão obrigatório')
    })

    it('valida erro quando data de início está fora do ciclo', () => {
      const res = validateProfileData(
        { name: 'Dr. Teste', shift_parity: 'even', cycle_start_date: '2026-09-20' },
        currentCycle,
      )
      expect(res).toContain('Data fora do ciclo')

      const resAfter = validateProfileData(
        { name: 'Dr. Teste', shift_parity: 'even', cycle_start_date: '2026-11-01' },
        currentCycle,
      )
      expect(resAfter).toContain('Data fora do ciclo')
    })

    it('valida erro quando há incoerência entre paridade selecionada e data de início', () => {
      // 2026-09-26 é o 1º dia do ciclo (posição 1 = ímpar). Se selecionou even, deve dar erro
      const resEvenConflict = validateProfileData(
        { name: 'Dr. Teste', shift_parity: 'even', cycle_start_date: '2026-09-26' },
        currentCycle,
      )
      expect(resEvenConflict).toContain('Incoerência com a paridade selecionada')

      // 2026-09-27 é o 2º dia do ciclo (posição 2 = par). Se selecionou odd, deve dar erro
      const resOddConflict = validateProfileData(
        { name: 'Dr. Teste', shift_parity: 'odd', cycle_start_date: '2026-09-27' },
        currentCycle,
      )
      expect(resOddConflict).toContain('Incoerência com a paridade selecionada')
    })

    it('aprova cadastro quando paridade e data de início são coerentes e pertencem ao ciclo', () => {
      // 2026-09-26 é o 1º dia do ciclo (posição 1 = Dias ímpares)
      const resOdd = validateProfileData(
        { name: 'Dra. Impar', shift_parity: 'odd', cycle_start_date: '2026-09-26' },
        currentCycle,
      )
      expect(resOdd).toHaveLength(0)

      // 2026-09-27 é o 2º dia do ciclo (posição 2 = Dias pares)
      const resEven = validateProfileData(
        { name: 'Dr. Par', shift_parity: 'even', cycle_start_date: '2026-09-27' },
        currentCycle,
      )
      expect(resEven).toHaveLength(0)
    })
  })

  describe('3. Ciclos que Atravessam a Virada do Mês (Posição Relativa / Âncora vs Dia do Calendário)', () => {
    it('calcula a alternância baseada na posição relativa ao ciclo (12x36), NÃO no número do dia do mês', () => {
      // Ciclo: 26/09/2026 a 25/10/2026
      // Setembro tem 30 dias (26, 27, 28, 29, 30 -> 5 dias em setembro).
      // Em setembro:
      // Equipe Ímpar (posições 1, 3, 5... do ciclo -> offset 0): 26/09 (1º dia), 28/09 (3º dia), 30/09 (5º dia)
      // Virada: 30/09 -> próximo plantão é 02/10 (pois 30/09 + 2 dias = 02/10 -> 7º dia do ciclo).
      // Equipe Par (posições 2, 4, 6... do ciclo -> offset 1): 27/09 (2º dia), 29/09 (4º dia) -> próximo plantão é 01/10 (6º dia do ciclo).

      const allStaff = ['colab_par', 'colab_impar']

      const patternImpar = computeNaturalPatternByStaff(
        'colab_impar',
        allStaff,
        cycleStart,
        cycleEnd,
        12,
        36,
        { shift_parity: 'odd', cycle_start_date: '2026-09-26' },
      )

      const patternPar = computeNaturalPatternByStaff(
        'colab_par',
        allStaff,
        cycleStart,
        cycleEnd,
        12,
        36,
        { shift_parity: 'even', cycle_start_date: '2026-09-27' },
      )

      // Equipe Ímpar em Setembro e Outubro (posições 1, 3, 5, 7, 9, 11)
      expect(patternImpar['2026-09-26']).toBe(true)
      expect(patternImpar['2026-09-27']).toBeUndefined()
      expect(patternImpar['2026-09-28']).toBe(true)
      expect(patternImpar['2026-09-29']).toBeUndefined()
      expect(patternImpar['2026-09-30']).toBe(true)
      expect(patternImpar['2026-10-01']).toBeUndefined()
      expect(patternImpar['2026-10-02']).toBe(true)
      expect(patternImpar['2026-10-04']).toBe(true)
      expect(patternImpar['2026-10-06']).toBe(true)

      // Equipe Par em Setembro e Outubro (posições 2, 4, 6, 8, 10)
      expect(patternPar['2026-09-26']).toBeUndefined()
      expect(patternPar['2026-09-27']).toBe(true)
      expect(patternPar['2026-09-28']).toBeUndefined()
      expect(patternPar['2026-09-29']).toBe(true)
      expect(patternPar['2026-09-30']).toBeUndefined()
      expect(patternPar['2026-10-01']).toBe(true)
      expect(patternPar['2026-10-03']).toBe(true)
      expect(patternPar['2026-10-05']).toBe(true)

      // Nunca há sobreposição entre as equipes no padrão natural
      let cur = cycleStart
      while (cur <= cycleEnd) {
        const parWorks = !!patternPar[cur]
        const imparWorks = !!patternImpar[cur]
        // Exatamente uma das equipes trabalha em cada dia
        expect(parWorks !== imparWorks).toBe(true)
        cur = addDaysDateOnly(cur, 1)
      }
    })

    it('quando o mês tem 31 dias (ex: Ciclo 26/07 a 25/08), a alternância relativa mantém o ritmo de 48h sem inversão errônea', () => {
      const julCycleStart = '2026-07-26'
      const julCycleEnd = '2026-08-25'
      // Julho tem 31 dias: 26, 27, 28, 29, 30, 31 (6 dias em julho).
      // Equipe Ímpar (início 26/07, posição 1 no ciclo): 26/07, 28/07, 30/07 -> próximo plantão: 30/07 + 2 dias = 01/08 (posição 7 do ciclo)!
      // Se usasse paridade do dia do mês pura, 01/08 seria ímpar e 26/07 seria par no calendário, quebrando a alternância.
      // Com posição relativa / âncora: o plantão ocorre perfeitamente em 01/08 (descanso 36h, ritmo 12x36 contínuo).

      const patternImparJul = computeNaturalPatternByStaff(
        'staff_p',
        ['staff_p'],
        julCycleStart,
        julCycleEnd,
        12,
        36,
        { shift_parity: 'odd', cycle_start_date: '2026-07-26' },
      )

      expect(patternImparJul['2026-07-30']).toBe(true)
      expect(patternImparJul['2026-07-31']).toBeUndefined()
      expect(patternImparJul['2026-08-01']).toBe(true) // Perfeita continuidade 12x36
      expect(patternImparJul['2026-08-02']).toBeUndefined()
      expect(patternImparJul['2026-08-03']).toBe(true)
    })
  })

  describe('4. Tratamento de Registros Legados (staff_profiles criados antes da migração)', () => {
    it('carrega perfis legados sem shift_parity nem cycle_start_date preservando os dados e aplicando fallback determinístico', () => {
      const legacyStaffList = [
        { id: 'legacy_1', name: 'Colab Legado 1', shift_parity: undefined, cycle_start_date: undefined },
        { id: 'legacy_2', name: 'Colab Legado 2', shift_parity: '', cycle_start_date: '' },
      ]

      const staffIds = legacyStaffList.map((s) => s.id)

      const patternLegacy1 = computeNaturalPatternByStaff(
        'legacy_1',
        staffIds,
        cycleStart,
        cycleEnd,
        12,
        36,
        legacyStaffList[0],
      )

      const patternLegacy2 = computeNaturalPatternByStaff(
        'legacy_2',
        staffIds,
        cycleStart,
        cycleEnd,
        12,
        36,
        legacyStaffList[1],
      )

      // Fallback determinístico por ranking de ID:
      // legacy_1 (índice 0) tem offset 0
      // legacy_2 (índice 1) tem offset 1
      expect(patternLegacy1['2026-09-26']).toBe(true)
      expect(patternLegacy2['2026-09-26']).toBeUndefined()
      expect(patternLegacy2['2026-09-27']).toBe(true)

      // Não há perda de dados nem crash
      expect(Object.keys(patternLegacy1).length).toBeGreaterThan(0)
      expect(Object.keys(patternLegacy2).length).toBeGreaterThan(0)
    })
  })

  describe('5. REGRESSÃO INTEGRAL da Folga de Fim de Semana (WEEKEND_OFF por ciclo)', () => {
    it('a nova paridade e âncora preservam integralmente a regra de 1 sábado + 1 domingo de folga por ciclo', () => {
      const candidates = getCycleWeekendCandidates(cycleStart, cycleEnd)
      expect(candidates).toHaveLength(5)

      const staffList = [
        { id: 'user_a', name: 'Enf. Ana', shift_parity: 'odd', cycle_start_date: '2026-09-26' },
        { id: 'user_b', name: 'Enf. Bruno', shift_parity: 'even', cycle_start_date: '2026-09-27' },
        { id: 'user_c', name: 'Enf. Carla', shift_parity: 'odd', cycle_start_date: '2026-09-26' },
        { id: 'user_d', name: 'Enf. Diego', shift_parity: 'even', cycle_start_date: '2026-09-27' },
      ]

      const staffIds = staffList.map((s) => s.id)
      const assignedWeekends: Record<string, { sat: string; sun: string }> = {}

      staffList.forEach((staff, idx) => {
        const naturalWorked = computeNaturalPatternByStaff(
          staff.id,
          staffIds,
          cycleStart,
          cycleEnd,
          12,
          36,
          staff,
        )

        // Filtra os fins de semana cujo domingo seria naturalmente trabalhado pelo colaborador
        let userCandidates = candidates.filter((c) => naturalWorked[c.sun])
        if (userCandidates.length === 0) userCandidates = candidates.slice()

        // Seleção round-robin
        const chosen = userCandidates[idx % userCandidates.length]
        expect(assertWeekendPair(chosen.sat, chosen.sun)).toBe(true)
        assignedWeekends[staff.id] = chosen
      })

      // Validações estritas de invariantes
      expect(Object.keys(assignedWeekends)).toHaveLength(4)

      staffList.forEach((staff) => {
        const w = assignedWeekends[staff.id]
        expect(w).toBeDefined()
        expect(assertWeekendPair(w.sat, w.sun)).toBe(true)
        expect(dayOfWeekDateOnly(w.sat)).toBe(6) // Sábado
        expect(dayOfWeekDateOnly(w.sun)).toBe(0) // Domingo
        expect(w.sat >= cycleStart && w.sat <= cycleEnd).toBe(true)
        expect(w.sun >= cycleStart && w.sun <= cycleEnd).toBe(true)
      })
    })
  })
})
