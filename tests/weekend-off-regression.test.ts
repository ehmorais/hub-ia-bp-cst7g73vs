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
})
