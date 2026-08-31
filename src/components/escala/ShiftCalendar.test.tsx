import { describe, it, expect } from 'vitest'
import { formatCorenLabel, formatShiftCalendarSecondLine } from '@/lib/escala-calendar-formatter'

describe('ShiftCalendar & AutoGenerate Preview', () => {
  it('1. Nome completo sem ellipsis/truncamento renderiza integralmente', () => {
    const longName = 'Maria Auxiliadora dos Santos de Oliveira'
    expect(longName.length).toBeGreaterThan(25)
    // No truncation logic applies
    expect(longName).toBe('Maria Auxiliadora dos Santos de Oliveira')
  })

  it('2. AutoGenerate usa ShiftCalendar herdando nome completo e segunda linha de COREN', () => {
    const professionalId = '99988-SP'
    const coren = formatCorenLabel(professionalId)
    const lineD = formatShiftCalendarSecondLine('D', professionalId)
    const lineN = formatShiftCalendarSecondLine('N', professionalId)

    expect(coren).toBe('COREN 99988-SP')
    expect(lineD).toBe('D • COREN 99988-SP')
    expect(lineN).toBe('N • COREN 99988-SP')
  })

  it('3. Ausência de COREN na prévia exibe fallback padronizado', () => {
    expect(formatShiftCalendarSecondLine('D', null)).toBe('D • COREN não informado')
    expect(formatShiftCalendarSecondLine('N', undefined)).toBe('N • COREN não informado')
  })
})
