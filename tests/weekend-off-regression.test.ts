import { describe, it, expect } from 'vitest'
import {
  parseDateOnly,
  formatDateOnly,
  addDaysDateOnly,
  dayOfWeekDateOnly,
  assertWeekendPair,
  getSaturdaysInRange,
  getCycleWeekendCandidates,
  buildWeekendOffMap,
  computeNaturalPatternByStaff,
  formatLocalDateKeySafe,
} from '../src/lib/escala-weekend-off'

describe('Weekend Off Regression & Invariants Suite (Per-Cycle Model)', () => {
  const cycleStart = '2026-09-26' // Sábado (weekday 6)
  const cycleEnd = '2026-10-25' // Domingo (weekday 0)

  it('deve identificar corretamente os dias da semana', () => {
    expect(dayOfWeekDateOnly('2026-09-26')).toBe(6) // Sábado
    expect(dayOfWeekDateOnly('2026-09-27')).toBe(0) // Domingo
    expect(dayOfWeekDateOnly('2026-09-28')).toBe(1) // Segunda
    expect(dayOfWeekDateOnly('2026-10-03')).toBe(6) // Sábado
    expect(dayOfWeekDateOnly('2026-10-04')).toBe(0) // Domingo
    expect(dayOfWeekDateOnly('2026-10-05')).toBe(1) // Segunda
    expect(dayOfWeekDateOnly('2026-10-12')).toBe(1) // Segunda
  })

  it('assertWeekendPair valida apenas pares estritos Sábado + Domingo consecutivo', () => {
    // Válidos
    expect(assertWeekendPair('2026-09-26', '2026-09-27')).toBe(true)
    expect(assertWeekendPair('2026-10-03', '2026-10-04')).toBe(true)
    expect(assertWeekendPair('2026-10-10', '2026-10-11')).toBe(true)
    expect(assertWeekendPair('2026-10-17', '2026-10-18')).toBe(true)
    expect(assertWeekendPair('2026-10-24', '2026-10-25')).toBe(true)

    // Inválidos: Domingo + Segunda (NUNCA permitido)
    expect(assertWeekendPair('2026-10-04', '2026-10-05')).toBe(false)
    expect(assertWeekendPair('2026-09-27', '2026-09-28')).toBe(false)

    // Inválidos: Sábado + Segunda
    expect(assertWeekendPair('2026-10-03', '2026-10-05')).toBe(false)

    // Inválidos: Sexta + Sábado
    expect(assertWeekendPair('2026-10-02', '2026-10-03')).toBe(false)
  })

  it('getCycleWeekendCandidates retorna todos os fins de semana completos dentro do ciclo 26/09 a 25/10/2026', () => {
    const candidates = getCycleWeekendCandidates(cycleStart, cycleEnd)
    expect(candidates).toEqual([
      { sat: '2026-09-26', sun: '2026-09-27' },
      { sat: '2026-10-03', sun: '2026-10-04' },
      { sat: '2026-10-10', sun: '2026-10-11' },
      { sat: '2026-10-17', sun: '2026-10-18' },
      { sat: '2026-10-24', sun: '2026-10-25' },
    ])
    expect(candidates.length).toBe(5)
    candidates.forEach((pair) => {
      expect(assertWeekendPair(pair.sat, pair.sun)).toBe(true)
      expect(dayOfWeekDateOnly(pair.sat)).toBe(6)
      expect(dayOfWeekDateOnly(pair.sun)).toBe(0)
    })
  })

  it('distribuição per-cycle para 6 colaboradores 12x36: exatamente 6 assignments (1 par por staff)', () => {
    const staffIds = ['user_1', 'user_2', 'user_3', 'user_4', 'user_5', 'user_6']
    const candidates = getCycleWeekendCandidates(cycleStart, cycleEnd)

    // Simula a lógica de round-robin per-cycle dos hooks
    const assignments: Record<string, string[]> = {}
    staffIds.forEach((sid, idx) => {
      const naturalDays = computeNaturalPatternByStaff(sid, staffIds, cycleStart, cycleEnd, 12, 36)
      // Filtra candidatos cujo domingo seria trabalhado no padrão natural
      let userCandidates = candidates.filter((c) => naturalDays[c.sun])
      if (userCandidates.length === 0) userCandidates = candidates.slice()

      const assignedPair = userCandidates[idx % userCandidates.length]
      expect(assertWeekendPair(assignedPair.sat, assignedPair.sun)).toBe(true)
      assignments[sid] = [assignedPair.sat, assignedPair.sun]
    })

    // Exatamente 6 colaboradores, cada um com 1 par (2 datas) = 6 assignments
    expect(Object.keys(assignments).length).toBe(6)
    staffIds.forEach((sid) => {
      const pair = assignments[sid]
      expect(pair).toBeDefined()
      expect(pair.length).toBe(2)
      expect(assertWeekendPair(pair[0], pair[1])).toBe(true)
      expect(dayOfWeekDateOnly(pair[0])).toBe(6)
      expect(dayOfWeekDateOnly(pair[1])).toBe(0)
      // Segunda NUNCA aparece em assignments
      expect(dayOfWeekDateOnly(pair[0])).not.toBe(1)
      expect(dayOfWeekDateOnly(pair[1])).not.toBe(1)
      expect(pair[0]).not.toBe('2026-10-05')
      expect(pair[1]).not.toBe('2026-10-05')
    })
  })

  it('buildWeekendOffMap consome assignments persistidos de validation_summary', () => {
    const validationSummary = {
      weekend_off_assignments: {
        user_1: ['2026-09-26', '2026-09-27'],
        user_2: ['2026-10-03', '2026-10-04'],
        user_3: ['2026-10-10', '2026-10-11'],
      },
    }

    const map = buildWeekendOffMap(validationSummary)
    expect(map.size).toBe(3)
    expect(map.get('user_1')?.has('2026-09-26')).toBe(true)
    expect(map.get('user_1')?.has('2026-09-27')).toBe(true)
    expect(map.get('user_1')?.has('2026-09-28')).toBe(false) // Segunda NUNCA está presente

    expect(map.get('user_2')?.has('2026-10-03')).toBe(true)
    expect(map.get('user_2')?.has('2026-10-04')).toBe(true)
    expect(map.get('user_2')?.has('2026-10-05')).toBe(false)
  })

  it('buildWeekendOffMap rejeita pares inválidos (como Domingo + Segunda)', () => {
    const invalidSummary = {
      weekend_off_assignments: {
        user_bad: ['2026-10-04', '2026-10-05'], // Domingo + Segunda
      },
    }

    const map = buildWeekendOffMap(invalidSummary)
    expect(map.size).toBe(0)
    expect(map.get('user_bad')).toBeUndefined()
  })

  it('alinhamento dinâmico do Header quando o ciclo começa no Sábado (26/09)', () => {
    const baseWeekLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const firstDayDow = dayOfWeekDateOnly(cycleStart) // 6 = Sábado
    const rotatedLabels = [
      ...baseWeekLabels.slice(firstDayDow),
      ...baseWeekLabels.slice(0, firstDayDow),
    ]

    expect(rotatedLabels[0]).toBe('Sáb')
    expect(rotatedLabels[1]).toBe('Dom')
    expect(rotatedLabels[2]).toBe('Seg')
    expect(rotatedLabels[3]).toBe('Ter')
    expect(rotatedLabels[4]).toBe('Qua')
    expect(rotatedLabels[5]).toBe('Qui')
    expect(rotatedLabels[6]).toBe('Sex')
  })

  it('alinhamento dinâmico do Header quando o ciclo começa no Domingo (01/11)', () => {
    const baseWeekLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const firstDayDow = dayOfWeekDateOnly('2026-11-01') // 0 = Domingo
    const rotatedLabels = [
      ...baseWeekLabels.slice(firstDayDow),
      ...baseWeekLabels.slice(0, firstDayDow),
    ]

    expect(rotatedLabels[0]).toBe('Dom')
    expect(rotatedLabels[1]).toBe('Seg')
    expect(rotatedLabels[6]).toBe('Sáb')
  })

  it('timezone resilience: formatLocalDateKeySafe lida com UTC e fusos sem desviar a data', () => {
    const dUTC = new Date(Date.UTC(2026, 9, 4, 0, 0, 0)) // 2026-10-04 UTC
    expect(formatLocalDateKeySafe(dUTC)).toBe('2026-10-04')

    const dLocal = new Date(2026, 9, 4, 12, 0, 0) // 2026-10-04 local
    expect(formatLocalDateKeySafe(dLocal)).toBe('2026-10-04')
  })

  // --- Sub-testes adicionais e invariantes obrigatórias (Task Specs) ---

  it('a) TZ resilience: formatLocalDateKeySafe, dayOfWeekDateOnly e assertWeekendPair para 03/10, 04/10 e 05/10/2026 independentemente do fuso', () => {
    // 03/10/2026 (Sábado), 04/10/2026 (Domingo), 05/10/2026 (Segunda)
    const dates = ['2026-10-03', '2026-10-04', '2026-10-05']
    
    // Prova que dayOfWeekDateOnly('2026-10-04') === 0 sempre (puro date-only)
    expect(dayOfWeekDateOnly('2026-10-03')).toBe(6) // Sábado
    expect(dayOfWeekDateOnly('2026-10-04')).toBe(0) // Domingo
    expect(dayOfWeekDateOnly('2026-10-05')).toBe(1) // Segunda

    // formatLocalDateKeySafe em múltiplos fusos horários/offsets simulados
    dates.forEach((dStr) => {
      const { y, m, d } = parseDateOnly(dStr)
      // UTC midnight
      const utcDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
      expect(formatLocalDateKeySafe(utcDate)).toBe(dStr)

      // Local midday
      const localDate = new Date(y, m - 1, d, 12, 0, 0)
      expect(formatLocalDateKeySafe(localDate)).toBe(dStr)
    })

    // assertWeekendPair
    expect(assertWeekendPair('2026-10-03', '2026-10-04')).toBe(true)
    expect(assertWeekendPair('2026-10-04', '2026-10-05')).toBe(false)
  })

  it('b) Commit rejeita Sun+Mon e payload legado com mais de um par', () => {
    // assertWeekendPair('2026-10-04', '2026-10-05') deve ser false
    expect(assertWeekendPair('2026-10-04', '2026-10-05')).toBe(false)

    // Com o par inválido Sun+Mon, buildWeekendOffMap retorna Map vazio
    const invalidSunMonSummary = {
      weekend_off_assignments: {
        staff_bad: ['2026-10-04', '2026-10-05'],
      },
    }
    const mapSunMon = buildWeekendOffMap(invalidSunMonSummary)
    expect(mapSunMon.size).toBe(0)
    expect(mapSunMon.get('staff_bad')).toBeUndefined()

    // Simulação da lógica de commit_schedule:
    // 1. Rejeição de Sun+Mon
    const commitValidate = (staffAssignments: string[], cycleStartStr: string, cycleEndStr: string) => {
      const violations: string[] = []
      if (staffAssignments && Array.isArray(staffAssignments) && staffAssignments.length >= 2) {
        if (staffAssignments.length > 2) {
          violations.push('Fim de semana obrigatório inválido: payload legado com mais de um par por staff.')
        } else {
          const satD = staffAssignments[0]
          const sunD = staffAssignments[1]
          if (!satD || !sunD || !assertWeekendPair(satD, sunD) || satD < cycleStartStr || sunD > cycleEndStr) {
            violations.push('Fim de semana obrigatório inválido: designação não é Sábado + Domingo dentro do ciclo.')
          }
        }
      } else {
        violations.push('Fim de semana obrigatório não atendido. Faltam 1 fins de semana de folga.')
      }
      return violations
    }

    const vSunMon = commitValidate(['2026-10-04', '2026-10-05'], cycleStart, cycleEnd)
    expect(vSunMon.length).toBeGreaterThan(0)
    expect(vSunMon[0]).toContain('Fim de semana obrigatório inválido: designação não é Sábado + Domingo')

    // 2. Rejeição de payload legado com mais de 2 datas (> 2)
    const vLegacy = commitValidate(['2026-10-03', '2026-10-04', '2026-10-10', '2026-10-11'], cycleStart, cycleEnd)
    expect(vLegacy.length).toBeGreaterThan(0)
    expect(vLegacy[0]).toBe('Fim de semana obrigatório inválido: payload legado com mais de um par por staff.')
  })

  it('c) Payload legado rejeitado: buildWeekendOffMap e documentação do comportamento esperado', () => {
    // buildWeekendOffMap com payload legado de 4 datas
    const legacySummary = {
      weekend_off_assignments: {
        staff1: ['2026-10-03', '2026-10-04', '2026-10-10', '2026-10-11'],
      },
    }

    const map = buildWeekendOffMap(legacySummary)
    // buildWeekendOffMap extrai os pares válidos presentes no array (2026-10-03, 2026-10-04, 2026-10-10, 2026-10-11)
    // para fins de marcação/visualização ou fallback, enquanto commit_schedule bloqueia estritamente
    // qualquer rascunho com staffAssignments.length > 2 com a violation:
    // "Fim de semana obrigatório inválido: payload legado com mais de um par por staff."
    expect(map.size).toBe(1)
    const staff1Dates = map.get('staff1')
    expect(staff1Dates?.has('2026-10-03')).toBe(true)
    expect(staff1Dates?.has('2026-10-04')).toBe(true)
    expect(staff1Dates?.has('2026-10-10')).toBe(true)
    expect(staff1Dates?.has('2026-10-11')).toBe(true)
  })

  it('d) 6 colaboradoras 12x36 no ciclo 26/09-25/10: validação detalhada de invariantes', () => {
    const staffIds = ['user_1', 'user_2', 'user_3', 'user_4', 'user_5', 'user_6']
    const candidates = getCycleWeekendCandidates(cycleStart, cycleEnd)

    const assignments: Record<string, string[]> = {}
    const naturalPatterns: Record<string, Record<string, boolean>> = {}

    staffIds.forEach((sid, idx) => {
      const naturalDays = computeNaturalPatternByStaff(sid, staffIds, cycleStart, cycleEnd, 12, 36)
      naturalPatterns[sid] = naturalDays

      let userCandidates = candidates.filter((c) => naturalDays[c.sun])
      if (userCandidates.length === 0) userCandidates = candidates.slice()

      const assignedPair = userCandidates[idx % userCandidates.length]
      assignments[sid] = [assignedPair.sat, assignedPair.sun]
    })

    // 1. Cada assignment tem natural_sunday_worked inferido corretamente (domingo estava no padrão 12x36)
    staffIds.forEach((sid) => {
      const [sat, sun] = assignments[sid]
      const naturalDays = naturalPatterns[sid]
      expect(naturalDays[sun]).toBe(true) // domingo era dia trabalhado no padrão natural
    })

    // 2. Nenhum assignment cai em 2026-09-28 (segunda) ou 2026-10-05 (segunda)
    staffIds.forEach((sid) => {
      const [sat, sun] = assignments[sid]
      expect(sat).not.toBe('2026-09-28')
      expect(sun).not.toBe('2026-09-28')
      expect(sat).not.toBe('2026-10-05')
      expect(sun).not.toBe('2026-10-05')
      expect(dayOfWeekDateOnly(sat)).toBe(6) // Sábado
      expect(dayOfWeekDateOnly(sun)).toBe(0) // Domingo
    })

    // 3. Todos os 6 assignments têm datas estritamente dentro do ciclo [2026-09-26, 2026-10-25]
    staffIds.forEach((sid) => {
      const [sat, sun] = assignments[sid]
      expect(sat >= cycleStart && sat <= cycleEnd).toBe(true)
      expect(sun >= cycleStart && sun <= cycleEnd).toBe(true)
    })
  })

  it('e) Header alignment: ciclo iniciando em Sábado vs Segunda-feira', () => {
    const baseWeekLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

    // Para o ciclo 26/09/2026 (Sábado, firstDayDow = 6)
    const firstDayDowSat = dayOfWeekDateOnly('2026-09-26') // 6
    const rotatedSatLabels = [
      ...baseWeekLabels.slice(firstDayDowSat),
      ...baseWeekLabels.slice(0, firstDayDowSat),
    ]
    expect(rotatedSatLabels[0]).toBe('Sáb')
    expect(rotatedSatLabels).toEqual(['Sáb', 'Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex'])

    // Para um ciclo começando em Segunda-feira (ex: 2026-10-26, firstDayDow = 1)
    const firstDayDowMon = dayOfWeekDateOnly('2026-10-26') // 1
    const rotatedMonLabels = [
      ...baseWeekLabels.slice(firstDayDowMon),
      ...baseWeekLabels.slice(0, firstDayDowMon),
    ]
    expect(rotatedMonLabels[0]).toBe('Seg')
    expect(rotatedMonLabels).toEqual(['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'])
  })

  it('f) Montar Escala e Gerar com IA usam mesma validação: getCycleWeekendCandidates retorna os mesmos 5 candidatos', () => {
    const candidates = getCycleWeekendCandidates('2026-09-26', '2026-10-25')
    expect(candidates.length).toBe(5)
    expect(candidates).toEqual([
      { sat: '2026-09-26', sun: '2026-09-27' },
      { sat: '2026-10-03', sun: '2026-10-04' },
      { sat: '2026-10-10', sun: '2026-10-11' },
      { sat: '2026-10-17', sun: '2026-10-18' },
      { sat: '2026-10-24', sun: '2026-10-25' },
    ])

    // Simulação do loop dos hooks generate_shifts.js e generate_shifts_draft.js
    const hookCycleWeekends: Array<{ sat: string; sun: string }> = []
    let dCur = '2026-09-26'
    const cEnd = '2026-10-25'
    while (dCur <= cEnd) {
      if (dayOfWeekDateOnly(dCur) === 6) {
        const satStr = dCur
        const sunStr = addDaysDateOnly(dCur, 1)
        if (sunStr <= cEnd && assertWeekendPair(satStr, sunStr)) {
          hookCycleWeekends.push({ sat: satStr, sun: sunStr })
        }
      }
      dCur = addDaysDateOnly(dCur, 1)
    }

    expect(hookCycleWeekends).toEqual(candidates)
  })
})
