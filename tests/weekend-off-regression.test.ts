import { describe, it, expect } from 'vitest'
import {
  formatLocalDateKey,
  formatLocalDateKeyUTC,
  formatLocalDateKeySafe,
  assertWeekendPair,
  dayOfWeekDateOnly,
  addDaysDateOnly,
  buildWeekendOffMap,
} from '../src/lib/escala-weekend-off'

describe('Weekend Off Date & Timezone Regression Tests', () => {
  it('formatLocalDateKey(new Date(2026, 9, 4)) deve retornar "2026-10-04" (domingo local)', () => {
    // mês 9 em JS = Outubro
    const d = new Date(2026, 9, 4)
    expect(formatLocalDateKey(d)).toBe('2026-10-04')
    expect(formatLocalDateKeySafe(d)).toBe('2026-10-04')
  })

  it('formatLocalDateKey(new Date("2026-10-04")) deve retornar "2026-10-04" (domingo civil em UTC)', () => {
    const d = new Date('2026-10-04')
    expect(formatLocalDateKey(d)).toBe('2026-10-04')
    expect(formatLocalDateKeySafe(d)).toBe('2026-10-04')
  })

  it('formatLocalDateKeyUTC retorna componentes UTC', () => {
    const d = new Date(Date.UTC(2026, 9, 4, 0, 0, 0))
    expect(formatLocalDateKeyUTC(d)).toBe('2026-10-04')
  })

  it('assertWeekendPair valida corretamente sábado e domingo consecutivos', () => {
    // 2026-10-03 é sábado, 2026-10-04 é domingo
    expect(dayOfWeekDateOnly('2026-10-03')).toBe(6) // Saturday
    expect(dayOfWeekDateOnly('2026-10-04')).toBe(0) // Sunday
    expect(assertWeekendPair('2026-10-03', '2026-10-04')).toBe(true)

    // Sábado e segunda NÃO é um par válido
    expect(assertWeekendPair('2026-10-03', '2026-10-05')).toBe(false)
    // Domingo e segunda NÃO é um par válido
    expect(assertWeekendPair('2026-10-04', '2026-10-05')).toBe(false)
    // Sexta e sábado NÃO é um par válido
    expect(assertWeekendPair('2026-10-02', '2026-10-03')).toBe(false)
  })

  it('addDaysDateOnly calcula o dia seguinte sem desvios de timezone', () => {
    expect(addDaysDateOnly('2026-10-03', 1)).toBe('2026-10-04')
    expect(addDaysDateOnly('2026-10-04', 1)).toBe('2026-10-05')
  })

  it('buildWeekendOffMap mapeia sábado e domingo para o staffId e confere com a chave da célula', () => {
    const draftValidation = {
      weekend_off_assignments: [
        {
          staff_profile: 'staff_1',
          saturday: '2026-10-03',
          sunday: '2026-10-04',
          month: '2026-10',
        },
      ],
    }

    const weekendOffMap = buildWeekendOffMap(draftValidation)
    expect(weekendOffMap.has('staff_1')).toBe(true)
    const staffDates = weekendOffMap.get('staff_1')!
    expect(staffDates.has('2026-10-03')).toBe(true)
    expect(staffDates.has('2026-10-04')).toBe(true)
    expect(staffDates.has('2026-10-05')).toBe(false)

    // Comparar chave da célula do calendário com chave do assignment: ambas "2026-10-04" devem bater
    const cellDateLocal = new Date(2026, 9, 4)
    const cellKeyLocal = formatLocalDateKeySafe(cellDateLocal)
    expect(cellKeyLocal).toBe('2026-10-04')
    expect(staffDates.has(cellKeyLocal)).toBe(true)

    const cellDateISO = new Date('2026-10-04')
    const cellKeyISO = formatLocalDateKeySafe(cellDateISO)
    expect(cellKeyISO).toBe('2026-10-04')
    expect(staffDates.has(cellKeyISO)).toBe(true)

    // Segunda-feira 2026-10-05 NUNCA deve bater
    const mondayLocal = new Date(2026, 9, 5)
    expect(staffDates.has(formatLocalDateKeySafe(mondayLocal))).toBe(false)
  })
})
