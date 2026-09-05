import { describe, it, expect } from 'vitest'
import {
  calculateCycleOffDaysForStaff,
  validateWeekendOffOverride,
  buildWeekendOffMap,
} from './escala-weekend-off'

describe('Regra de Folga de Fim de Semana x Férias (escala-weekend-off)', () => {
  const allStaffIds = ['staff-1', 'staff-2']
  const cycleStart = '2025-06-01' // 2025-06-01 é Domingo (dow 0)
  const cycleEnd = '2025-06-30'

  it('1. Domingo originalmente escolhido dentro das férias: não recebe folga e outro fim de semana elegível do ciclo é escolhido', () => {
    // Colaborador com paridade 'odd' (trabalha dias 2025-06-01, 03, 05, 07, 09, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29)
    // Dias de fim de semana trabalhados:
    // 2025-06-01 (Domingo), 2025-06-07 (Sábado), 2025-06-15 (Domingo), 2025-06-21 (Sábado), 2025-06-29 (Domingo)
    // Sem férias e com staffIndex = 0, escolheria 2025-06-01 (Domingo).
    const noVacation = calculateCycleOffDaysForStaff({
      staffId: 'staff-1',
      staffName: 'Colaborador Fictício A',
      allStaffIds,
      cycleStart,
      cycleEnd,
      profile: {
        shift_parity: 'odd',
        work_hours: 12,
        rest_hours: 36,
      },
      staffIndex: 0,
    })
    expect(noVacation.weekendOffDate).toBe('2025-06-01')

    // Agora com férias que cobrem o domingo 2025-06-01 (ex: de 2025-06-01 a 2025-06-05)
    const withVacation = calculateCycleOffDaysForStaff({
      staffId: 'staff-1',
      staffName: 'Colaborador Fictício A',
      allStaffIds,
      cycleStart,
      cycleEnd,
      profile: {
        shift_parity: 'odd',
        work_hours: 12,
        rest_hours: 36,
        vacation_enabled: true,
        vacation_start: '2025-06-01',
        vacation_end: '2025-06-05',
      },
      staffIndex: 0,
    })

    // O domingo 2025-06-01 NÃO pode ser a folga. Deve remanejar para outro fim de semana elegível (ex: 2025-06-07).
    expect(withVacation.weekendOffDate).not.toBe('2025-06-01')
    expect(withVacation.weekendOffDate).toBe('2025-06-07')
  })

  it('2. Sábado e domingo de férias não contam como folga', () => {
    // Férias cobrindo um sábado e domingo inteiros (ex: de 2025-06-06 a 2025-06-08)
    const res = calculateCycleOffDaysForStaff({
      staffId: 'staff-1',
      staffName: 'Colaborador Fictício B',
      allStaffIds,
      cycleStart,
      cycleEnd,
      profile: {
        shift_parity: 'odd',
        work_hours: 12,
        rest_hours: 36,
        vacation_enabled: true,
        vacation_start: '2025-06-06',
        vacation_end: '2025-06-08',
      },
      staffIndex: 1, // Sem férias seria index 1 % 5 = 2025-06-07 (sábado)
    })

    // 2025-06-07 está dentro das férias, portanto NÃO pode ser escolhido
    expect(res.weekendOffDate).not.toBe('2025-06-07')
    // Remaneja deterministamente entre os restantes fora de férias (2025-06-01, 15, 21, 29)
    expect(['2025-06-01', '2025-06-15', '2025-06-21', '2025-06-29']).toContain(res.weekendOffDate)
  })

  it('3. Férias cobrindo todos os fins de semana ou todo o ciclo: nenhuma folga de fim de semana é criada (e nunca converte para dia útil)', () => {
    // Férias durante todo o mês
    const fullCycleVacation = calculateCycleOffDaysForStaff({
      staffId: 'staff-1',
      staffName: 'Colaborador Fictício C',
      allStaffIds,
      cycleStart,
      cycleEnd,
      profile: {
        shift_parity: 'odd',
        work_hours: 12,
        rest_hours: 36,
        vacation_enabled: true,
        vacation_start: '2025-06-01',
        vacation_end: '2025-06-30',
      },
      staffIndex: 0,
    })

    // Nenhuma folga de fim de semana é criada
    expect(fullCycleVacation.weekendOffDate).toBeNull()
    // A folga de fim de semana NUNCA é convertida em dia útil para compensar
    expect(fullCycleVacation.weekendOffDate).not.toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('4. Limites De e Até de férias são inclusivos para bloquear a folga de fim de semana', () => {
    // Férias de 2025-06-15 até 2025-06-21
    // 2025-06-15 é domingo (limite inicial) e 2025-06-21 é sábado (limite final)
    const inclusiveVac = calculateCycleOffDaysForStaff({
      staffId: 'staff-1',
      staffName: 'Colaborador Fictício D',
      allStaffIds,
      cycleStart,
      cycleEnd,
      profile: {
        shift_parity: 'odd',
        work_hours: 12,
        rest_hours: 36,
        vacation_enabled: true,
        vacation_start: '2025-06-15',
        vacation_end: '2025-06-21',
      },
      staffIndex: 0,
    })

    // Nem o início (2025-06-15) nem o final (2025-06-21) podem ser atribuídos como folga
    expect(inclusiveVac.weekendOffDate).not.toBe('2025-06-15')
    expect(inclusiveVac.weekendOffDate).not.toBe('2025-06-21')
    expect(['2025-06-01', '2025-06-07', '2025-06-29']).toContain(inclusiveVac.weekendOffDate)
  })

  it('5. Colaborador sem férias mantém o comportamento normal e determinístico', () => {
    const regular = calculateCycleOffDaysForStaff({
      staffId: 'staff-1',
      staffName: 'Colaborador Regular',
      allStaffIds,
      cycleStart,
      cycleEnd,
      profile: {
        shift_parity: 'odd',
        work_hours: 12,
        rest_hours: 36,
        vacation_enabled: false,
        vacation_start: null,
        vacation_end: null,
      },
      staffIndex: 0,
    })

    expect(regular.weekendOffDate).toBe('2025-06-01')
  })

  it('6. validateWeekendOffOverride rejeita mover folga para data que coincida com férias ativas', () => {
    const validation = validateWeekendOffOverride({
      staffId: 'staff-1',
      sourceDate: '2025-06-01',
      targetDate: '2025-06-15', // domingo
      cycleStart,
      cycleEnd,
      currentAssignments: ['2025-06-01'],
      vacation: {
        vacation_enabled: true,
        vacation_start: '2025-06-10',
        vacation_end: '2025-06-20',
      },
    })

    expect(validation.valid).toBe(false)
    expect(validation.error).toMatch(/férias/i)
  })

  it('7. buildWeekendOffMap sanitiza e não retorna folga para datas em período de férias ativo', () => {
    const summary = {
      weekend_off_assignments: {
        'staff-1': ['2025-06-01', '2025-06-15'],
        'staff-2': ['2025-06-07'],
      },
    }

    const vacationsByStaff = {
      'staff-1': {
        vacation_enabled: true,
        vacation_start: '2025-06-01',
        vacation_end: '2025-06-10',
      },
    }

    const map = buildWeekendOffMap(summary, vacationsByStaff)
    const staff1Dates = map.get('staff-1')
    expect(staff1Dates?.has('2025-06-01')).toBe(false)
    expect(staff1Dates?.has('2025-06-15')).toBe(true)

    const staff2Dates = map.get('staff-2')
    expect(staff2Dates?.has('2025-06-07')).toBe(true)
  })
})
