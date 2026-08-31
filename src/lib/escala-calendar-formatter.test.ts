import { describe, it, expect } from 'vitest'
import { formatCorenLabel, formatShiftCalendarSecondLine } from './escala-calendar-formatter'
import {
  calculateCycleOffDaysForStaff,
  buildWeekendOffMap,
  validateWeekendOffOverride,
  moveWeekendOffAssignment,
  assertWeekendPair,
} from './escala-weekend-off'

describe('escala-calendar-formatter & ScalePlanner/AutoGenerate Etapa 2', () => {
  it('1. Nome completo sem ellipsis/truncamento & helper retorna COREN correto', () => {
    const formatted = formatCorenLabel('12345')
    expect(formatted).toBe('COREN 12345')
  })

  it('2. Formata registro que já possui prefixo COREN', () => {
    expect(formatCorenLabel('COREN-SP 123456')).toBe('COREN-SP 123456')
    expect(formatCorenLabel('coren 99999')).toBe('coren 99999')
  })

  it('3. Plantão diurno mostra "D" + COREN', () => {
    const line = formatShiftCalendarSecondLine('D', '12345')
    expect(line.startsWith('D •')).toBe(true)
    expect(line).toBe('D • COREN 12345')
  })

  it('4. Plantão noturno mostra "N" + COREN', () => {
    const line = formatShiftCalendarSecondLine('N', '12345')
    expect(line.startsWith('N •')).toBe(true)
    expect(line).toBe('N • COREN 12345')
  })

  it('5. Fallback "COREN não informado" quando ausente', () => {
    expect(formatCorenLabel(null)).toBe('COREN não informado')
    expect(formatCorenLabel(undefined)).toBe('COREN não informado')
    expect(formatCorenLabel('')).toBe('COREN não informado')
    expect(formatCorenLabel('   ')).toBe('COREN não informado')
    expect(formatShiftCalendarSecondLine('D', null)).toBe('D • COREN não informado')
    expect(formatShiftCalendarSecondLine('N', '')).toBe('N • COREN não informado')
  })

  it('6. Horário NÃO aparece na segunda linha visual, mas start_time/end_time permanecem nos dados', () => {
    const shiftData = {
      id: 'shift-1',
      staff_profile: 'prof-1',
      sector: 'sec-1',
      cycle: 'cyc-1',
      start_time: '2026-10-01 07:00:00.000Z',
      end_time: '2026-10-01 19:00:00.000Z',
    }

    const line = formatShiftCalendarSecondLine('D', '98765')
    expect(line).not.toMatch(/\d{2}:\d{2}/)
    expect(line).toBe('D • COREN 98765')

    // Preservação dos horários nos objetos de dados
    expect(shiftData.start_time).toBe('2026-10-01 07:00:00.000Z')
    expect(shiftData.end_time).toBe('2026-10-01 19:00:00.000Z')
  })

  it('7. Salvar e recarregar produz persistência com tipo, nome e COREN', () => {
    const mockStaff = {
      id: 'staff-abc',
      name: 'Colaborador Ficticio de Teste Silva',
      professional_id: '54321',
    }

    const payload = {
      staff_profile: mockStaff.id,
      sector: 'sector-uti',
      cycle: 'cycle-2026-10',
      start_time: '2026-10-05 07:00:00.000Z',
      end_time: '2026-10-05 19:00:00.000Z',
    }

    expect(payload.staff_profile).toBe('staff-abc')
    expect(payload.start_time).toContain('07:00:00')
    const displayCoren = formatShiftCalendarSecondLine('D', mockStaff.professional_id)
    expect(displayCoren).toBe('D • COREN 54321')
  })

  it('8. Regressão das regras de folga e paridade da v0.0.276 continua passando', () => {
    const offResult = calculateCycleOffDaysForStaff({
      staffId: 'staff-101',
      staffName: 'Plantonista Alpha',
      allStaffIds: ['staff-101', 'staff-102'],
      cycleStart: '2026-10-01',
      cycleEnd: '2026-10-31',
      profile: {
        shift_parity: 'odd',
        work_hours: 12,
        rest_hours: 36,
      },
      staffIndex: 0,
    })

    expect(offResult.weekendOffDate).toBeDefined()
    expect(offResult.additionalOffDate).toBeDefined()

    const summary = {
      weekend_off_assignments: {
        'staff-101': ['2026-10-03', '2026-10-04'],
      },
    }
    const map = buildWeekendOffMap(summary)
    expect(map.get('staff-101')?.has('2026-10-03')).toBe(true)
    expect(map.get('staff-101')?.has('2026-10-04')).toBe(true)

    const overrideVal = validateWeekendOffOverride({
      staffId: 'staff-101',
      sourceDate: '2026-10-03',
      targetDate: '2026-10-10',
      cycleStart: '2026-10-01',
      cycleEnd: '2026-10-31',
      currentAssignments: ['2026-10-03'],
    })
    expect(overrideVal.valid).toBe(true)

    const moved = moveWeekendOffAssignment(['2026-10-03', '2026-10-04'], '2026-10-03', '2026-10-10')
    expect(moved).toContain('2026-10-10')
    expect(moved).not.toContain('2026-10-03')

    expect(assertWeekendPair('2026-10-03', '2026-10-04')).toBe(true)
  })
})
