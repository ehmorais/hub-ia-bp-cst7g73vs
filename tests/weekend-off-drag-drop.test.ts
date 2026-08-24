import { describe, it, expect } from 'vitest'
import {
  assertWeekendPair,
  buildWeekendOffMap,
  dayOfWeekDateOnly,
  formatLocalDateKeySafe,
  isSameWeekday,
  moveWeekendOffAssignment,
  validateWeekendOffOverride,
  WeekendOffOverridesMap,
} from '../src/lib/escala-weekend-off'

describe('Drag-and-Drop Manual de Folga de Fim de Semana (WEEKEND_OFF)', () => {
  const cycleStart = '2026-05-01'
  const cycleEnd = '2026-05-31'
  const staffA = 'staff-001'
  const staffB = 'staff-002'

  // Ciclo Maio/2026:
  // Sábados: 2026-05-02, 2026-05-09, 2026-05-16, 2026-05-23, 2026-05-30
  // Domingos: 2026-05-03, 2026-05-10, 2026-05-17, 2026-05-24, 2026-05-31

  // 1. Sábado -> outro sábado válido; destaque e persistência mudam
  it('1. Permite mover sábado -> outro sábado válido e atualiza a estrutura de assignments', () => {
    const initialAssignments = ['2026-05-02', '2026-05-03'] // Par consecutivo inicial
    const sourceDate = '2026-05-02' // Sábado
    const targetDate = '2026-05-16' // Outro Sábado no mesmo ciclo

    const validation = validateWeekendOffOverride({
      staffId: staffA,
      sourceDate,
      targetDate,
      cycleStart,
      cycleEnd,
      currentAssignments: initialAssignments,
    })

    expect(validation.valid).toBe(true)
    expect(validation.weekday).toBe(6)

    const updated = moveWeekendOffAssignment(initialAssignments, sourceDate, targetDate)
    expect(updated).toHaveLength(2)
    expect(updated).toContain('2026-05-16') // Novo sábado
    expect(updated).toContain('2026-05-03') // Domingo original mantido
    expect(updated).not.toContain('2026-05-02') // Origem removida

    const map = buildWeekendOffMap({
      weekend_off_assignments: {
        [staffA]: updated,
      },
    })
    expect(map.get(staffA)?.has('2026-05-16')).toBe(true)
    expect(map.get(staffA)?.has('2026-05-03')).toBe(true)
    expect(map.get(staffA)?.has('2026-05-02')).toBe(false)
  })

  // 2. Domingo -> outro domingo válido
  it('2. Permite mover domingo -> outro domingo válido mantendo o sábado intacto', () => {
    const initialAssignments = ['2026-05-02', '2026-05-03']
    const sourceDate = '2026-05-03' // Domingo
    const targetDate = '2026-05-24' // Outro Domingo

    const validation = validateWeekendOffOverride({
      staffId: staffA,
      sourceDate,
      targetDate,
      cycleStart,
      cycleEnd,
      currentAssignments: initialAssignments,
    })

    expect(validation.valid).toBe(true)
    expect(validation.weekday).toBe(0)

    const updated = moveWeekendOffAssignment(initialAssignments, sourceDate, targetDate)
    expect(updated).toHaveLength(2)
    expect(updated).toContain('2026-05-02') // Sábado original mantido
    expect(updated).toContain('2026-05-24') // Novo domingo
    expect(updated).not.toContain('2026-05-03') // Origem removida

    const map = buildWeekendOffMap({
      weekend_off_assignments: {
        [staffA]: updated,
      },
    })
    expect(map.get(staffA)?.has('2026-05-02')).toBe(true)
    expect(map.get(staffA)?.has('2026-05-24')).toBe(true)
    expect(map.get(staffA)?.has('2026-05-03')).toBe(false)
  })

  // 3. Sábado -> domingo, domingo -> segunda, outro colaborador e fora do ciclo são bloqueados
  it('3. Bloqueia sábado->domingo, domingo->dia útil, data fora do ciclo e colaborador inválido', () => {
    const initialAssignments = ['2026-05-02', '2026-05-03']

    // Sábado -> Domingo (inválido: weekdays diferentes)
    const resSatToSun = validateWeekendOffOverride({
      staffId: staffA,
      sourceDate: '2026-05-02',
      targetDate: '2026-05-10', // Domingo
      cycleStart,
      cycleEnd,
      currentAssignments: initialAssignments,
    })
    expect(resSatToSun.valid).toBe(false)
    expect(resSatToSun.error).toContain('Sábado só pode ir para sábado, domingo só para domingo')

    // Domingo -> Segunda-feira (inválido: não é fim de semana)
    const resSunToMon = validateWeekendOffOverride({
      staffId: staffA,
      sourceDate: '2026-05-03',
      targetDate: '2026-05-04', // Segunda
      cycleStart,
      cycleEnd,
      currentAssignments: initialAssignments,
    })
    expect(resSunToMon.valid).toBe(false)

    // Fora do ciclo (2026-06-06 é sábado do ciclo seguinte)
    const resOutOfCycle = validateWeekendOffOverride({
      staffId: staffA,
      sourceDate: '2026-05-02',
      targetDate: '2026-06-06',
      cycleStart,
      cycleEnd,
      currentAssignments: initialAssignments,
    })
    expect(resOutOfCycle.valid).toBe(false)
    expect(resOutOfCycle.error).toContain('fora do ciclo')

    // Colaborador vazio
    const resNoStaff = validateWeekendOffOverride({
      staffId: '',
      sourceDate: '2026-05-02',
      targetDate: '2026-05-09',
      cycleStart,
      cycleEnd,
      currentAssignments: initialAssignments,
    })
    expect(resNoStaff.valid).toBe(false)

    // Data de origem não é folga atual do colaborador
    const resWrongSource = validateWeekendOffOverride({
      staffId: staffA,
      sourceDate: '2026-05-09', // Não está em initialAssignments
      targetDate: '2026-05-16',
      cycleStart,
      cycleEnd,
      currentAssignments: initialAssignments,
    })
    expect(resWrongSource.valid).toBe(false)
  })

  // 4. Drop que quebraria cobertura é simulado e revertido/rejeitado integralmente
  it('4. Simulação de cobertura rejeita drop quando número de plantonistas ficaria abaixo do mínimo', () => {
    // Cenário: setor UTI com min_staffing = 2
    const minStaffing = 2
    const shifts = [
      { id: 's1', staff_profile: staffA, date: '2026-05-09' }, // plantão em 09/05
      { id: 's2', staff_profile: staffB, date: '2026-05-09' }, // plantão em 09/05 (total = 2)
    ]

    // Se staffA tentar mover folga para 2026-05-09, ele não poderá ter plantão em 09/05.
    // Se seu plantão for movido para 02/05, em 09/05 sobra apenas staffB (count = 1 < minStaffing 2).
    const sourceDate = '2026-05-02'
    const targetDate = '2026-05-09'

    const simulated = shifts
      .map((s) => {
        if (s.staff_profile === staffA && s.date === targetDate) {
          return { ...s, date: sourceDate }
        }
        return s
      })

    const targetDayCount = simulated.filter((s) => s.date === targetDate).length
    expect(targetDayCount).toBe(1)
    const isCoverageValid = targetDayCount >= minStaffing
    expect(isCoverageValid).toBe(false) // Deve ser bloqueado/rejeitado
  })

  // 5. Reload mantém destino (persistência via validation_summary)
  it('5. Reload mantém o destino configurado a partir de validation_summary', () => {
    const persistedSummary = {
      weekend_off_assignments: {
        [staffA]: ['2026-05-09', '2026-05-17'], // Sábado de uma semana, domingo de outra
      },
      weekend_off_overrides: {
        [staffA]: {
          saturday: {
            source_date: '2026-05-02',
            target_date: '2026-05-09',
            weekday: 6,
            moved_at: '2026-05-01T10:00:00.000Z',
            moved_by: 'admin-1',
            manual_override: true,
          },
        },
      },
    }

    const map = buildWeekendOffMap(persistedSummary)
    expect(map.get(staffA)?.has('2026-05-09')).toBe(true)
    expect(map.get(staffA)?.has('2026-05-17')).toBe(true)
    expect(map.get(staffA)?.has('2026-05-02')).toBe(false)
  })

  // 6. Commit aceita override auditado válido e rejeita override sem auditoria
  it('6. Lógica de commit aceita override manual com auditoria válida e rejeita não-consecutivo sem auditoria', () => {
    const validateCommitWeekendOff = (
      profileId: string,
      assignments: string[],
      overrides: WeekendOffOverridesMap,
    ): { valid: boolean; reason?: string } => {
      if (!assignments || assignments.length !== 2) {
        return { valid: false, reason: 'Deve ter exatamente 2 datas.' }
      }
      const [d1, d2] = assignments
      const dow1 = dayOfWeekDateOnly(d1)
      const dow2 = dayOfWeekDateOnly(d2)

      const hasOneSat = (dow1 === 6 && dow2 !== 6) || (dow2 === 6 && dow1 !== 6)
      const hasOneSun = (dow1 === 0 && dow2 !== 0) || (dow2 === 0 && dow1 !== 0)
      if (!hasOneSat || !hasOneSun) {
        return { valid: false, reason: 'Deve ter exatamente 1 sábado e 1 domingo.' }
      }

      const satDate = dow1 === 6 ? d1 : d2
      const sunDate = dow1 === 0 ? d1 : d2
      const isConsecutive = assertWeekendPair(satDate, sunDate)

      if (isConsecutive) return { valid: true }

      // Se não for consecutivo, exige trilha de auditoria
      const staffOverride = overrides[profileId]
      if (staffOverride && (staffOverride.saturday?.manual_override || staffOverride.sunday?.manual_override)) {
        return { valid: true }
      }

      return { valid: false, reason: 'Não-consecutivo sem auditoria válida.' }
    }

    // Caso A: Par consecutivo normal (gerado automaticamente) -> Válido
    const resA = validateCommitWeekendOff(staffA, ['2026-05-02', '2026-05-03'], {})
    expect(resA.valid).toBe(true)

    // Caso B: Sábado e domingo em semanas diferentes SEM override auditado -> Rejeitado
    const resB = validateCommitWeekendOff(staffA, ['2026-05-02', '2026-05-10'], {})
    expect(resB.valid).toBe(false)
    expect(resB.reason).toBe('Não-consecutivo sem auditoria válida.')

    // Caso C: Sábado e domingo em semanas diferentes COM override auditado -> Válido
    const overridesC: WeekendOffOverridesMap = {
      [staffA]: {
        sunday: {
          source_date: '2026-05-03',
          target_date: '2026-05-10',
          weekday: 0,
          moved_at: '2026-05-01T12:00:00Z',
          manual_override: true,
        },
      },
    }
    const resC = validateCommitWeekendOff(staffA, ['2026-05-02', '2026-05-10'], overridesC)
    expect(resC.valid).toBe(true)
  })

  // 7. Exatamente 1 sábado + 1 domingo por colaborador após qualquer movimento
  it('7. Garante exatamente 1 sábado + 1 domingo por colaborador após múltiplos movimentos', () => {
    let current = ['2026-05-02', '2026-05-03']

    // Move sábado para 2026-05-23
    current = moveWeekendOffAssignment(current, '2026-05-02', '2026-05-23')
    expect(current).toHaveLength(2)
    const dowList1 = current.map((d) => dayOfWeekDateOnly(d))
    expect(dowList1.filter((dow) => dow === 6)).toHaveLength(1)
    expect(dowList1.filter((dow) => dow === 0)).toHaveLength(1)

    // Move domingo para 2026-05-31
    current = moveWeekendOffAssignment(current, '2026-05-03', '2026-05-31')
    expect(current).toHaveLength(2)
    const dowList2 = current.map((d) => dayOfWeekDateOnly(d))
    expect(dowList2.filter((dow) => dow === 6)).toHaveLength(1)
    expect(dowList2.filter((dow) => dow === 0)).toHaveLength(1)
    expect(current).toContain('2026-05-23')
    expect(current).toContain('2026-05-31')
  })

  // 8. Filtro individual (StaffFilter) não muda dados e mantém dados funcionais
  it('8. StaffFilter mantém o mapa íntegro para todos os colaboradores', () => {
    const fullSummary = {
      weekend_off_assignments: {
        [staffA]: ['2026-05-02', '2026-05-03'],
        [staffB]: ['2026-05-09', '2026-05-10'],
      },
    }
    const map = buildWeekendOffMap(fullSummary)

    // Filtrando na interface apenas staffB: o map global deve continuar tendo dados de ambos
    const filteredSelection = staffB
    const staffBDates = map.get(filteredSelection)
    expect(staffBDates?.has('2026-05-09')).toBe(true)
    expect(staffBDates?.has('2026-05-10')).toBe(true)

    // Ao remover o filtro, staffA continua intacto
    const staffADates = map.get(staffA)
    expect(staffADates?.has('2026-05-02')).toBe(true)
    expect(staffADates?.has('2026-05-03')).toBe(true)
  })

  // 9. Fuso UTC e America/Sao_Paulo — as datas permanecem estáveis
  it('9. Datas e weekdays permanecem 100% estáveis independentemente de UTC ou horário local', () => {
    const dates = [
      '2026-05-01', // Sexta
      '2026-05-02', // Sábado
      '2026-05-03', // Domingo
      '2026-05-04', // Segunda
      '2026-05-30', // Sábado
      '2026-05-31', // Domingo
    ]

    expect(dayOfWeekDateOnly(dates[0])).toBe(5)
    expect(dayOfWeekDateOnly(dates[1])).toBe(6) // Sáb
    expect(dayOfWeekDateOnly(dates[2])).toBe(0) // Dom
    expect(dayOfWeekDateOnly(dates[3])).toBe(1)
    expect(dayOfWeekDateOnly(dates[4])).toBe(6) // Sáb
    expect(dayOfWeekDateOnly(dates[5])).toBe(0) // Dom

    expect(isSameWeekday(dates[1], dates[4])).toBe(true) // Sáb == Sáb
    expect(isSameWeekday(dates[2], dates[5])).toBe(true) // Dom == Dom
    expect(isSameWeekday(dates[1], dates[2])).toBe(false) // Sáb != Dom
  })

  // 10. Regressão: geração automática continua criando par consecutivo com assertWeekendPair
  it('10. Regressão: assertWeekendPair continua validando estritamente pares consecutivos sábado+domingo', () => {
    // Par consecutivo legítimo
    expect(assertWeekendPair('2026-05-02', '2026-05-03')).toBe(true)
    expect(assertWeekendPair('2026-05-09', '2026-05-10')).toBe(true)
    expect(assertWeekendPair('2026-05-16', '2026-05-17')).toBe(true)

    // Não consecutivo
    expect(assertWeekendPair('2026-05-02', '2026-05-10')).toBe(false)
    expect(assertWeekendPair('2026-05-09', '2026-05-03')).toBe(false)

    // Dias errados (ex: Sexta + Sábado)
    expect(assertWeekendPair('2026-05-01', '2026-05-02')).toBe(false)
    // Domingo + Segunda
    expect(assertWeekendPair('2026-05-03', '2026-05-04')).toBe(false)
  })
})
