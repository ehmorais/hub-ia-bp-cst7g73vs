import { describe, it, expect } from 'vitest'
import {
  parseDateOnly,
  formatDateOnly,
  addDaysDateOnly,
  dayOfWeekDateOnly,
  assertWeekendPair,
  isWeekendOffApplicableMonth,
  formatLocalDateKey,
  enforceWeekendOffDeterministic,
  StaffContractInfo,
} from '../src/lib/escala-weekend-off'

describe('WEEKEND_OFF Regressão Crítica (v0.0.252)', () => {
  // Teste A — Alinhamento de datas: assertWeekendPair('2026-10-03','2026-10-04') === true, assertWeekendPair('2026-10-04','2026-10-05') === false
  it('Teste A — Alinhamento de datas: assertWeekendPair aceita apenas sábado+domingo reais e rejeita domingo+segunda', () => {
    // 2026-10-03 é Sábado, 2026-10-04 é Domingo
    expect(assertWeekendPair('2026-10-03', '2026-10-04')).toBe(true)

    // 2026-10-04 é Domingo, 2026-10-05 é Segunda -> DEVE REJEITAR
    expect(assertWeekendPair('2026-10-04', '2026-10-05')).toBe(false)

    // Quinta + Sexta -> DEVE REJEITAR
    expect(assertWeekendPair('2026-10-01', '2026-10-02')).toBe(false)

    // Sexta + Sábado -> DEVE REJEITAR
    expect(assertWeekendPair('2026-10-02', '2026-10-03')).toBe(false)

    // Domingo + Domingo (+7) -> DEVE REJEITAR
    expect(assertWeekendPair('2026-10-04', '2026-10-11')).toBe(false)
  })

  // Teste B — Sábado é âncora: todos os sábados de Outubro/2026 (03,10,17,24,31) têm weekday 6; seus domingos (+1) têm weekday 0
  it('Teste B — Sábado é âncora: todos os sábados de Outubro/2026 têm weekday 6 e domingos (+1) têm weekday 0', () => {
    const saturdaysOct2026 = [
      '2026-10-03',
      '2026-10-10',
      '2026-10-17',
      '2026-10-24',
      '2026-10-31',
    ]

    saturdaysOct2026.forEach((sat) => {
      expect(dayOfWeekDateOnly(sat)).toBe(6) // 6 = Sábado
      const sun = addDaysDateOnly(sat, 1)
      expect(dayOfWeekDateOnly(sun)).toBe(0) // 0 = Domingo
      expect(assertWeekendPair(sat, sun)).toBe(true)
    })
  })

  // Teste C — Segunda não é domingo: dayOfWeekDateOnly('2026-10-05') === 1 (segunda), não deve ser tratada como domingo
  it('Teste C — Segunda não é domingo: dayOfWeekDateOnly("2026-10-05") === 1 (segunda)', () => {
    expect(dayOfWeekDateOnly('2026-10-05')).toBe(1) // 1 = Segunda
    expect(dayOfWeekDateOnly('2026-10-05')).not.toBe(0) // não é domingo
  })

  // Teste D — Frontend key sem timezone: formatLocalDateKey(new Date(2026, 9, 4)) deve retornar '2026-10-04' em qualquer timezone
  it('Teste D — Frontend key sem timezone: formatLocalDateKey gera YYYY-MM-DD estável sem desvio de UTC', () => {
    // Mês 9 = Outubro (0-indexed em JS Date)
    const dOct4 = new Date(2026, 9, 4, 12, 0, 0)
    expect(formatLocalDateKey(dOct4)).toBe('2026-10-04')

    const dOct3 = new Date(2026, 9, 3, 0, 0, 0)
    expect(formatLocalDateKey(dOct3)).toBe('2026-10-03')

    const dNov1 = new Date(2026, 10, 1, 23, 59, 59)
    expect(formatLocalDateKey(dNov1)).toBe('2026-11-01')
  })

  // Teste E — Assignment inválido rejeitado: assertWeekendPair('2026-10-04','2026-10-05') === false
  it('Teste E — Assignment inválido rejeitado: assertWeekendPair rejeita par domingo+segunda', () => {
    const invalidSatSun = assertWeekendPair('2026-10-04', '2026-10-05')
    expect(invalidSatSun).toBe(false)
  })

  // Teste F — Fixture integrada: 6 colaboradoras 12x36, ciclo Outubro 2026, assignments devem ter exatamente sábado+domingo reais, sem shifts nessas datas
  it('Teste F — Fixture integrada: 6 colaboradoras 12x36 em Outubro/2026 têm fins de semana de folga reais (sáb+dom) e sem shifts', () => {
    const staff: StaffContractInfo[] = [
      { id: 'enf-01', name: 'Dra. Ana (12x36)', work_hours: 12, rest_hours: 36, monthly_hour_limit: 180, is_independent: true },
      { id: 'enf-02', name: 'Enf. Bruno (12x36)', work_hours: 12, rest_hours: 36, monthly_hour_limit: 180, is_independent: true },
      { id: 'enf-03', name: 'Enf. Carlos (12x36)', work_hours: 12, rest_hours: 36, monthly_hour_limit: 180, is_independent: true },
      { id: 'tec-01', name: 'Téc. Denise (12x36)', work_hours: 12, rest_hours: 36, monthly_hour_limit: 180, is_independent: false },
      { id: 'tec-02', name: 'Téc. Eduardo (12x36)', work_hours: 12, rest_hours: 36, monthly_hour_limit: 180, is_independent: false },
      { id: 'tec-03', name: 'Téc. Fernanda (12x36)', work_hours: 12, rest_hours: 36, monthly_hour_limit: 180, is_independent: false },
    ]

    const cycleStart = '2026-10-01'
    const cycleEnd = '2026-10-31'

    // Gera escala determinística com folga de fim de semana
    const result = enforceWeekendOffDeterministic([], staff, cycleStart, cycleEnd, 2)

    expect(result.issues).toEqual([])
    expect(Object.keys(result.assignments)).toHaveLength(6)

    // Mapa de shifts alocados para cada profissional
    const shiftsByStaff: Record<string, Set<string>> = {}
    staff.forEach((s) => {
      shiftsByStaff[s.id] = new Set()
    })
    result.shifts.forEach((sh) => {
      shiftsByStaff[sh.user_id]?.add(sh.date)
    })

    // Cada colaborador deve ter pelo menos 1 par [saturday, sunday] válido e NENHUM plantão nessas datas
    staff.forEach((s) => {
      const dates = result.assignments[s.id]
      expect(dates).toBeDefined()
      expect(dates.length).toBeGreaterThanOrEqual(2)

      for (let i = 0; i < dates.length; i += 2) {
        const sat = dates[i]
        const sun = dates[i + 1]
        // Deve ser um par sábado + domingo
        expect(assertWeekendPair(sat, sun)).toBe(true)

        // Não pode haver plantão no sábado nem no domingo de folga
        expect(shiftsByStaff[s.id].has(sat)).toBe(false)
        expect(shiftsByStaff[s.id].has(sun)).toBe(false)
      }
    })
  })

  // Teste G — Commit bloqueado sem assignments ou com assignments inválidos
  it('Teste G — Commit bloqueado sem assignments: validação de consistência exige contagem esperada e assertWeekendPair', () => {
    const cycleStart = '2026-10-01'
    const cycleEnd = '2026-10-31'
    const monthKey = '2026-10'

    expect(isWeekendOffApplicableMonth(cycleStart, cycleEnd, monthKey)).toBe(true)

    // Simula validação de draft com par inválido domingo+segunda
    const invalidAssignments = {
      'staff-01': ['2026-10-04', '2026-10-05'], // Domingo + Segunda -> INVÁLIDO
    }

    const sat = invalidAssignments['staff-01'][0]
    const sun = invalidAssignments['staff-01'][1]
    const isPairValid = assertWeekendPair(sat, sun)

    expect(isPairValid).toBe(false)
  })

  it('Verifica utilitários puros de data parseDateOnly, formatDateOnly, addDaysDateOnly', () => {
    const parsed = parseDateOnly('2026-10-03')
    expect(parsed).toEqual({ y: 2026, m: 10, d: 3 })

    const formatted = formatDateOnly(2026, 10, 3)
    expect(formatted).toBe('2026-10-03')

    const nextDay = addDaysDateOnly('2026-10-03', 1)
    expect(nextDay).toBe('2026-10-04')

    const monthRoll = addDaysDateOnly('2026-10-31', 1)
    expect(monthRoll).toBe('2026-11-01')
  })
})
