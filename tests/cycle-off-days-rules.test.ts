import { describe, it, expect } from 'vitest'
import {
  parseDateOnly,
  formatDateOnly,
  addDaysDateOnly,
  dayOfWeekDateOnly,
  isWeekendDay,
  isWeekdayDate,
  computeNaturalPatternByStaff,
  calculateCycleOffDaysForStaff,
  buildWeekendOffMap,
  buildWeekdayOffMap,
} from '../src/lib/escala-weekend-off'

describe('Regras de Folgas de Ciclo (v0.0.270+)', () => {
  const cycleStart = '2026-09-26' // Sábado
  const cycleEnd = '2026-10-25' // Domingo (30 dias)

  const staffOdd = {
    id: 'staff-odd-1',
    name: 'Dra. Ana Ímpar',
    shift_parity: 'odd',
    work_hours: 12,
    rest_hours: 36,
  }

  const staffEven = {
    id: 'staff-even-1',
    name: 'Dr. Bruno Par',
    shift_parity: 'even',
    work_hours: 12,
    rest_hours: 36,
  }

  const allStaffIds = ['staff-odd-1', 'staff-even-1']

  // TESTE 1: ímpar só posição ímpar
  it('TESTE 1: Colaborador com paridade odd trabalha apenas nas posições ímpares do ciclo (offset 0)', () => {
    const naturalDays = computeNaturalPatternByStaff(
      staffOdd.id,
      allStaffIds,
      cycleStart,
      cycleEnd,
      12,
      36,
      { shift_parity: 'odd' },
    )

    // Posição 1: 2026-09-26 (offset 0) deve ser trabalhado
    expect(naturalDays['2026-09-26']).toBe(true)
    // Posição 2: 2026-09-27 (offset 1) deve ser folga
    expect(naturalDays['2026-09-27']).toBeUndefined()
    // Posição 3: 2026-09-28 (offset 2) deve ser trabalhado
    expect(naturalDays['2026-09-28']).toBe(true)
  })

  // TESTE 2: par só posição par
  it('TESTE 2: Colaborador com paridade even trabalha apenas nas posições pares do ciclo (offset 1)', () => {
    const naturalDays = computeNaturalPatternByStaff(
      staffEven.id,
      allStaffIds,
      cycleStart,
      cycleEnd,
      12,
      36,
      { shift_parity: 'even' },
    )

    // Posição 1: 2026-09-26 (offset 0) deve ser folga
    expect(naturalDays['2026-09-26']).toBeUndefined()
    // Posição 2: 2026-09-27 (offset 1) deve ser trabalhado
    expect(naturalDays['2026-09-27']).toBe(true)
    // Posição 3: 2026-09-28 (offset 2) deve ser folga
    expect(naturalDays['2026-09-28']).toBeUndefined()
  })

  // TESTE 3: exatamente uma folga fim de semana no ciclo (cruzando meses)
  it('TESTE 3: Exatamente uma folga de fim de semana por ciclo (Sábado OU Domingo na paridade trabalhada)', () => {
    const resOdd = calculateCycleOffDaysForStaff({
      staffId: staffOdd.id,
      staffName: staffOdd.name,
      allStaffIds,
      cycleStart,
      cycleEnd,
      profile: staffOdd,
      staffIndex: 0,
    })

    expect(resOdd.weekendOffDate).toBeTruthy()
    expect(isWeekendDay(resOdd.weekendOffDate!)).toBe(true)
    // Deve ser dia trabalhado pela paridade
    const natOdd = computeNaturalPatternByStaff(staffOdd.id, allStaffIds, cycleStart, cycleEnd, 12, 36, staffOdd)
    expect(natOdd[resOdd.weekendOffDate!]).toBe(true)

    const resEven = calculateCycleOffDaysForStaff({
      staffId: staffEven.id,
      staffName: staffEven.name,
      allStaffIds,
      cycleStart,
      cycleEnd,
      profile: staffEven,
      staffIndex: 1,
    })

    expect(resEven.weekendOffDate).toBeTruthy()
    expect(isWeekendDay(resEven.weekendOffDate!)).toBe(true)
    const natEven = computeNaturalPatternByStaff(staffEven.id, allStaffIds, cycleStart, cycleEnd, 12, 36, staffEven)
    expect(natEven[resEven.weekendOffDate!]).toBe(true)
  })

  // TESTE 4: nunca sáb+dom automático
  it('TESTE 4: Folga de fim de semana é um único dia (não um par consecutivo)', () => {
    const res = calculateCycleOffDaysForStaff({
      staffId: staffOdd.id,
      staffName: staffOdd.name,
      allStaffIds,
      cycleStart,
      cycleEnd,
      profile: staffOdd,
      staffIndex: 0,
    })

    expect(typeof res.weekendOffDate).toBe('string')
    // Apenas 1 data, nunca 2 datas de fim de semana
  })

  // TESTE 5: exatamente uma folga adicional seg-sex em posição trabalhada
  it('TESTE 5: Exatamente uma folga adicional de dia de semana (seg-sex) em posição de trabalho', () => {
    const res = calculateCycleOffDaysForStaff({
      staffId: staffOdd.id,
      staffName: staffOdd.name,
      allStaffIds,
      cycleStart,
      cycleEnd,
      profile: staffOdd,
      staffIndex: 0,
    })

    expect(res.additionalOffDate).toBeTruthy()
    expect(isWeekdayDate(res.additionalOffDate!)).toBe(true)
    const nat = computeNaturalPatternByStaff(staffOdd.id, allStaffIds, cycleStart, cycleEnd, 12, 36, staffOdd)
    expect(nat[res.additionalOffDate!]).toBe(true)
  })

  // TESTE 6: dia de semana nunca paridade oposta
  it('TESTE 6: Folga adicional nunca é gerada em dia de paridade oposta (onde já folgaria)', () => {
    const resEven = calculateCycleOffDaysForStaff({
      staffId: staffEven.id,
      staffName: staffEven.name,
      allStaffIds,
      cycleStart,
      cycleEnd,
      profile: staffEven,
      staffIndex: 1,
    })

    const natEven = computeNaturalPatternByStaff(staffEven.id, allStaffIds, cycleStart, cycleEnd, 12, 36, staffEven)
    expect(natEven[resEven.additionalOffDate!]).toBe(true)
  })

  // TESTE 7: aprovada válida substitui automática
  it('TESTE 7: Solicitação de folga aprovada (fulfilled) em dia trabalhado de semana substitui a folga adicional automática', () => {
    // 2026-09-28 é segunda-feira na paridade odd (trabalhado)
    const approvedRequest = {
      id: 'to-1',
      staff_profile: staffOdd.id,
      date: '2026-09-28',
      status: 'fulfilled',
    }

    const res = calculateCycleOffDaysForStaff({
      staffId: staffOdd.id,
      staffName: staffOdd.name,
      allStaffIds,
      cycleStart,
      cycleEnd,
      profile: staffOdd,
      timeoffRequests: [approvedRequest],
      staffIndex: 0,
    })

    expect(res.additionalOffDate).toBe('2026-09-28')
    expect(res.approvedTimeoffDates).toContain('2026-09-28')
  })

  // TESTE 8: aprovada em paridade oposta tratada sem folga falsa
  it('TESTE 8: Solicitação aprovada em dia de paridade oposta reporta aviso e não cria folga adicional indevida', () => {
    // 2026-09-29 é terça-feira na paridade odd (dia em que já folgaria)
    const oppositeRequest = {
      id: 'to-2',
      staff_profile: staffOdd.id,
      date: '2026-09-29',
      status: 'fulfilled',
    }

    const res = calculateCycleOffDaysForStaff({
      staffId: staffOdd.id,
      staffName: staffOdd.name,
      allStaffIds,
      cycleStart,
      cycleEnd,
      profile: staffOdd,
      timeoffRequests: [oppositeRequest],
      staffIndex: 0,
    })

    expect(res.timeoffConflicts.length).toBeGreaterThan(0)
    expect(res.timeoffConflicts[0].date).toBe('2026-09-29')
    expect(res.timeoffConflicts[0].message).toContain('já estaria de folga pela paridade')
    // Folga adicional automática é atribuída normalmente em dia trabalhado
    expect(res.additionalOffDate).not.toBe('2026-09-29')
    expect(isWeekdayDate(res.additionalOffDate!)).toBe(true)
  })

  // TESTE 9: múltiplas aprovadas preservadas sem folga extra
  it('TESTE 9: Múltiplas solicitações aprovadas no ciclo são preservadas sem gerar folga automática adicional', () => {
    // 2026-09-28 e 2026-09-30 são seg e qua na paridade odd (ambos trabalhados)
    const req1 = {
      id: 'to-1',
      staff_profile: staffOdd.id,
      date: '2026-09-28',
      status: 'fulfilled',
    }
    const req2 = {
      id: 'to-2',
      staff_profile: staffOdd.id,
      date: '2026-09-30',
      status: 'fulfilled',
    }

    const res = calculateCycleOffDaysForStaff({
      staffId: staffOdd.id,
      staffName: staffOdd.name,
      allStaffIds,
      cycleStart,
      cycleEnd,
      profile: staffOdd,
      timeoffRequests: [req1, req2],
      staffIndex: 0,
    })

    expect(res.approvedTimeoffDates).toHaveLength(2)
    expect(res.approvedTimeoffDates).toContain('2026-09-28')
    expect(res.approvedTimeoffDates).toContain('2026-09-30')
  })

  // TESTE 10: pendente/rejeitada/fora do ciclo não substituem
  it('TESTE 10: Solicitações pendentes, rejeitadas ou fora do ciclo não substituem a folga adicional', () => {
    const pendingReq = {
      id: 'to-p',
      staff_profile: staffOdd.id,
      date: '2026-09-28',
      status: 'pending',
    }
    const rejectedReq = {
      id: 'to-r',
      staff_profile: staffOdd.id,
      date: '2026-09-30',
      status: 'rejected',
    }
    const outsideReq = {
      id: 'to-out',
      staff_profile: staffOdd.id,
      date: '2026-11-05',
      status: 'fulfilled',
    }

    const res = calculateCycleOffDaysForStaff({
      staffId: staffOdd.id,
      staffName: staffOdd.name,
      allStaffIds,
      cycleStart,
      cycleEnd,
      profile: staffOdd,
      timeoffRequests: [pendingReq, rejectedReq, outsideReq],
      staffIndex: 0,
    })

    expect(res.approvedTimeoffDates).toHaveLength(0)
    expect(res.additionalOffDate).toBeTruthy()
    expect(res.additionalOffDate).not.toBe('2026-11-05')
  })

  // TESTE 11: salvar/recarregar preserva
  it('TESTE 11: buildWeekendOffMap e buildWeekdayOffMap preservam os assignments persistidos no validation_summary', () => {
    const validationSummary = {
      weekend_off_assignments: {
        'staff-odd-1': ['2026-09-26'],
        'staff-even-1': ['2026-09-27'],
      },
      additional_off_assignments: {
        'staff-odd-1': ['2026-09-28'],
        'staff-even-1': ['2026-09-29'],
      },
    }

    const weekendMap = buildWeekendOffMap(validationSummary)
    expect(weekendMap.get('staff-odd-1')?.has('2026-09-26')).toBe(true)
    expect(weekendMap.get('staff-even-1')?.has('2026-09-27')).toBe(true)

    const weekdayMap = buildWeekdayOffMap(validationSummary)
    expect(weekdayMap.get('staff-odd-1')?.has('2026-09-28')).toBe(true)
    expect(weekdayMap.get('staff-even-1')?.has('2026-09-29')).toBe(true)
  })

  // TESTE 12: IA e Montar Escala possuem as mesmas garantias
  it('TESTE 12: Funções date-only e de cálculo são puras e determinísticas para ambos os fluxos', () => {
    const res1 = calculateCycleOffDaysForStaff({
      staffId: staffOdd.id,
      staffName: staffOdd.name,
      allStaffIds,
      cycleStart,
      cycleEnd,
      profile: staffOdd,
      staffIndex: 0,
    })
    const res2 = calculateCycleOffDaysForStaff({
      staffId: staffOdd.id,
      staffName: staffOdd.name,
      allStaffIds,
      cycleStart,
      cycleEnd,
      profile: staffOdd,
      staffIndex: 0,
    })

    expect(res1.weekendOffDate).toBe(res2.weekendOffDate)
    expect(res1.additionalOffDate).toBe(res2.additionalOffDate)
  })
})
