import { describe, it, expect } from 'vitest'
import { formatCorenLabel, formatShiftCalendarSecondLine } from './escala-calendar-formatter'

describe('escala-calendar-formatter', () => {
  it('1. nome completo sem ellipsis & helper retorna COREN correto', () => {
    const formatted = formatCorenLabel('12345')
    expect(formatted).toBe('COREN 12345')
  })

  it('2. formata registro que já possui prefixo COREN', () => {
    expect(formatCorenLabel('COREN-SP 123456')).toBe('COREN-SP 123456')
    expect(formatCorenLabel('coren 99999')).toBe('coren 99999')
  })

  it('3. plantão diurno mostra "D"', () => {
    const line = formatShiftCalendarSecondLine('D', '12345')
    expect(line.startsWith('D •')).toBe(true)
    expect(line).toBe('D • COREN 12345')
  })

  it('4. plantão noturno mostra "N"', () => {
    const line = formatShiftCalendarSecondLine('N', '12345')
    expect(line.startsWith('N •')).toBe(true)
    expect(line).toBe('N • COREN 12345')
  })

  it('5. segunda linha mostra COREN e não horário', () => {
    const line = formatShiftCalendarSecondLine('D', '12345')
    expect(line).not.toMatch(/\d{2}:\d{2}/)
    expect(line).toContain('COREN 12345')
  })

  it('6. ausência de COREN mostra "COREN não informado"', () => {
    expect(formatCorenLabel(null)).toBe('COREN não informado')
    expect(formatCorenLabel(undefined)).toBe('COREN não informado')
    expect(formatCorenLabel('')).toBe('COREN não informado')
    expect(formatCorenLabel('   ')).toBe('COREN não informado')
    expect(formatShiftCalendarSecondLine('D', null)).toBe('D • COREN não informado')
    expect(formatShiftCalendarSecondLine('N', '')).toBe('N • COREN não informado')
  })
})
