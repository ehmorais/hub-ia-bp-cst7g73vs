import { describe, it, expect } from 'vitest'
import {
  allocateBalancedWeekendOffDays,
  calculateCycleOffDaysForStaff,
  WeekendOffOverridesMap,
} from './escala-weekend-off'

describe('Distribuição escalonada de folgas de fim de semana (Round-Robin / Menor Impacto)', () => {
  const allStaffIds = ['staff-1', 'staff-2', 'staff-3', 'staff-4']
  const cycleStart = '2025-06-01' // 2025-06-01 é Domingo
  const cycleEnd = '2025-06-30'

  it('1. Folgas espalhadas entre fins de semana (não todas concentradas na mesma data)', () => {
    // 4 colaboradores todos escalados nos mesmos 3 fins de semana
    const candidateDatesByStaff = {
      'staff-1': ['2025-06-01', '2025-06-07', '2025-06-15'],
      'staff-2': ['2025-06-01', '2025-06-07', '2025-06-15'],
      'staff-3': ['2025-06-01', '2025-06-07', '2025-06-15'],
      'staff-4': ['2025-06-01', '2025-06-07', '2025-06-15'],
    }
    const naturalCoverageByDate = {
      '2025-06-01': 4,
      '2025-06-07': 4,
      '2025-06-15': 4,
    }
    const minCoverage = 2

    const result = allocateBalancedWeekendOffDays(
      candidateDatesByStaff,
      naturalCoverageByDate,
      minCoverage,
    )

    const allAssignedDates = Object.values(result.assignments).flat()
    const uniqueDates = new Set(allAssignedDates)

    // Não devem todas estar concentradas em um único dia
    expect(uniqueDates.size).toBeGreaterThan(1)
    // Todos devem receber folga
    expect(result.blockedStaffIds).toEqual([])
    expect(allAssignedDates.length).toBe(4)
  })

  it('2. Nenhum turno com zero ou abaixo do mínimo de cobertura estipulado', () => {
    const candidateDatesByStaff = {
      'staff-1': ['2025-06-01', '2025-06-07'],
      'staff-2': ['2025-06-01', '2025-06-07'],
      'staff-3': ['2025-06-01', '2025-06-07'],
    }
    const naturalCoverageByDate = {
      '2025-06-01': 3,
      '2025-06-07': 3,
    }
    const minCoverage = 2

    const result = allocateBalancedWeekendOffDays(
      candidateDatesByStaff,
      naturalCoverageByDate,
      minCoverage,
    )

    // Cobertura remanescente em cada data deve ser >= minCoverage
    for (const [date, cov] of Object.entries(result.coverageAfter)) {
      expect(cov).toBeGreaterThanOrEqual(minCoverage)
    }
  })

  it('3. Equipe enxuta -> não remove cobertura assistencial e bloqueia/avisa sem violar mínimo', () => {
    // 2 colaboradores disponíveis onde a cobertura mínima exigida é 2
    const candidateDatesByStaff = {
      'staff-1': ['2025-06-01', '2025-06-07'],
      'staff-2': ['2025-06-01', '2025-06-07'],
    }
    const naturalCoverageByDate = {
      '2025-06-01': 2,
      '2025-06-07': 2,
    }
    const minCoverage = 2

    const result = allocateBalancedWeekendOffDays(
      candidateDatesByStaff,
      naturalCoverageByDate,
      minCoverage,
    )

    // Nenhuma folga pode ser concedida sem quebrar a cobertura mínima
    expect(result.assignments['staff-1']).toEqual([])
    expect(result.assignments['staff-2']).toEqual([])
    expect(result.blockedStaffIds).toContain('staff-1')
    expect(result.blockedStaffIds).toContain('staff-2')
    // Cobertura final intacta
    expect(result.coverageAfter['2025-06-01']).toBe(2)
    expect(result.coverageAfter['2025-06-07']).toBe(2)
  })

  it('4. Férias, afastamentos e regime 12x36 respeitados', () => {
    // Colaborador em férias no primeiro fim de semana
    const withVacation = calculateCycleOffDaysForStaff({
      staffId: 'staff-1',
      staffName: 'Maria Silva',
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

    // Não pode receber folga em data que esteja em férias
    expect(withVacation.weekendOffDate).not.toBe('2025-06-01')
    expect(withVacation.weekendOffDate).toBe('2025-06-07')
  })

  it('5. Determinismo estrito: múltiplas execuções com a mesma entrada produzem o mesmo resultado', () => {
    const candidateDatesByStaff = {
      'staff-1': ['2025-06-01', '2025-06-07', '2025-06-15'],
      'staff-2': ['2025-06-01', '2025-06-07', '2025-06-15'],
      'staff-3': ['2025-06-01', '2025-06-07', '2025-06-15'],
    }
    const naturalCoverageByDate = {
      '2025-06-01': 3,
      '2025-06-07': 3,
      '2025-06-15': 3,
    }
    const minCoverage = 1

    const run1 = allocateBalancedWeekendOffDays(
      candidateDatesByStaff,
      naturalCoverageByDate,
      minCoverage,
    )
    const run2 = allocateBalancedWeekendOffDays(
      candidateDatesByStaff,
      naturalCoverageByDate,
      minCoverage,
    )

    expect(run1).toEqual(run2)
  })

  it('6. Overrides manuais pré-existentes preservados com prioridade máxima', () => {
    const candidateDatesByStaff = {
      'staff-1': ['2025-06-01', '2025-06-07', '2025-06-15'],
      'staff-2': ['2025-06-01', '2025-06-07', '2025-06-15'],
    }
    const naturalCoverageByDate = {
      '2025-06-01': 2,
      '2025-06-07': 2,
      '2025-06-15': 2,
    }
    const minCoverage = 1

    // Override manual definindo staff-1 especificamente no dia 2025-06-15
    const existingOverrides: WeekendOffOverridesMap = {
      'staff-1': {
        sunday: {
          source_date: '2025-06-01',
          target_date: '2025-06-15',
          weekday: 0,
          moved_at: '2025-06-01T10:00:00Z',
          moved_by: 'admin-user',
          manual_override: true,
        },
      },
    }

    const result = allocateBalancedWeekendOffDays(
      candidateDatesByStaff,
      naturalCoverageByDate,
      minCoverage,
      existingOverrides,
    )

    // staff-1 deve preservar o override manual de 2025-06-15
    expect(result.assignments['staff-1']).toEqual(['2025-06-15'])
    // staff-2 recebe uma das outras datas elegíveis com menor impacto
    expect(result.assignments['staff-2']).not.toEqual(['2025-06-15'])
    expect(['2025-06-01', '2025-06-07']).toContain(result.assignments['staff-2'][0])
  })
})
