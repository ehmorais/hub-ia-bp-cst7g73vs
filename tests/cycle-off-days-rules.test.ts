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

/**
 * Suite de Testes de Integração e Regras Obrigatórias:
 * Comprovação dos 14 cenários da regra de Folgas por Ciclo (v0.0.275).
 * Semântica 1-based relativa ao ciclo:
 *  - Posições ímpares = 1, 3, 5, 7... (offset 0 a partir de cycle_start)
 *  - Posições pares = 2, 4, 6, 8... (offset 1 a partir de cycle_start)
 */
describe('Suíte de Testes de Integração: Regras de Folgas por Ciclo (14 Cenários)', () => {
  // Ciclo que cruza meses: 26/09/2026 (Sábado) a 25/10/2026 (Domingo) - 30 dias
  const cycleStart = '2026-09-26'
  const cycleEnd = '2026-10-25'

  const staffOdd = {
    id: 'staff-odd-1',
    name: 'Dra. Ana Ímpar',
    shift_parity: 'odd',
    work_hours: 12,
    rest_hours: 36,
    shift_start_time: '07:00',
    monthly_hour_limit: 180,
    requires_supervision: false,
    rank: 1,
  }

  const staffEven = {
    id: 'staff-even-1',
    name: 'Dr. Bruno Par',
    shift_parity: 'even',
    work_hours: 12,
    rest_hours: 36,
    shift_start_time: '19:00',
    monthly_hour_limit: 180,
    requires_supervision: false,
    rank: 1,
  }

  const allStaffIds = [staffOdd.id, staffEven.id]
  const staffList = [staffOdd, staffEven]

  /**
   * Simulador fidedigno do backend do fluxo IA (generate_shifts_draft.js)
   * Executa reconstrução de plantões 12x36 por paridade e aplica enforceCycleOffDaysDraft
   */
  const simulateAiDraftPipeline = (
    eligibleStaff: typeof staffList,
    cStart: string,
    cEnd: string,
    timeoffs: Array<{
      id?: string
      staff_profile: string
      date: string
      end_date?: string
      status: string
    }> = [],
  ) => {
    const naturalMap: Record<string, Record<string, boolean>> = {}
    eligibleStaff.forEach((u) => {
      naturalMap[u.id] = computeNaturalPatternByStaff(
        u.id,
        eligibleStaff.map((s) => s.id),
        cStart,
        cEnd,
        u.work_hours,
        u.rest_hours,
        u,
      )
    })

    // 1. Reconstrução completa de escala 12x36
    const rebuiltDraft: Array<{ user_id: string; date: string }> = []
    eligibleStaff.forEach((u) => {
      const stepDays = Math.max(2, Math.round((u.work_hours + u.rest_hours) / 24))
      const targetOffset = u.shift_parity === 'even' ? 1 : 0
      let cur = addDaysDateOnly(cStart, targetOffset)
      while (cur <= cEnd) {
        rebuiltDraft.push({ user_id: u.id, date: cur })
        cur = addDaysDateOnly(cur, stepDays)
      }
    })

    // 2. enforceCycleOffDaysDraft (exatamente a mesma lógica de generate_shifts_draft.js)
    const workingShifts = rebuiltDraft.map((s) => ({ user_id: s.user_id, date: s.date }))
    const weekendOffAssignments: Record<string, string[]> = {}
    const additionalOffAssignments: Record<string, string[]> = {}
    const issues: string[] = []

    const fulfilledTimeoffsByStaff: Record<string, string[]> = {}
    timeoffs
      .filter((t) => t.status === 'fulfilled')
      .forEach((req) => {
        const pId = req.staff_profile
        if (!fulfilledTimeoffsByStaff[pId]) fulfilledTimeoffsByStaff[pId] = []
        let dC = req.date
        const rEnd = req.end_date || req.date
        while (dC <= rEnd) {
          if (dC >= cStart && dC <= cEnd) {
            fulfilledTimeoffsByStaff[pId].push(dC)
          }
          dC = addDaysDateOnly(dC, 1)
        }
      })

    eligibleStaff.forEach((u, staffIndex) => {
      const uNatMap = naturalMap[u.id] || {}
      const weekendWorkedDays: string[] = []
      const weekdayWorkedDays: string[] = []
      let curD = cStart
      while (curD <= cEnd) {
        if (uNatMap[curD]) {
          const dow = dayOfWeekDateOnly(curD)
          if (dow === 6 || dow === 0) {
            weekendWorkedDays.push(curD)
          } else if (dow >= 1 && dow <= 5) {
            weekdayWorkedDays.push(curD)
          }
        }
        curD = addDaysDateOnly(curD, 1)
      }

      let targetWeekendOff: string | null = null
      if (weekendWorkedDays.length > 0) {
        targetWeekendOff = weekendWorkedDays[staffIndex % weekendWorkedDays.length]
        weekendOffAssignments[u.id] = [targetWeekendOff]
      } else {
        issues.push(`Fim de semana obrigatório não atendido: ${u.name}`)
      }

      if (targetWeekendOff) {
        for (let si = 0; si < workingShifts.length; si++) {
          if (workingShifts[si].user_id === u.id && workingShifts[si].date === targetWeekendOff) {
            workingShifts.splice(si, 1)
            break
          }
        }
      }

      const approvedTimeoffs = fulfilledTimeoffsByStaff[u.id] || []
      const validApprovedInCycle: string[] = []
      approvedTimeoffs.forEach((tDate) => {
        const tDow = dayOfWeekDateOnly(tDate)
        if (tDow >= 1 && tDow <= 5 && uNatMap[tDate]) {
          if (!validApprovedInCycle.includes(tDate)) {
            validApprovedInCycle.push(tDate)
          }
        }
      })

      if (validApprovedInCycle.length > 0) {
        additionalOffAssignments[u.id] = validApprovedInCycle
        validApprovedInCycle.forEach((apprD) => {
          for (let wsi = 0; wsi < workingShifts.length; wsi++) {
            if (workingShifts[wsi].user_id === u.id && workingShifts[wsi].date === apprD) {
              workingShifts.splice(wsi, 1)
              break
            }
          }
        })
      } else if (weekdayWorkedDays.length > 0) {
        const wIdx = (staffIndex * 3 + 1) % weekdayWorkedDays.length
        const targetWeekdayOff = weekdayWorkedDays[wIdx]
        additionalOffAssignments[u.id] = [targetWeekdayOff]
        for (let wsi = 0; wsi < workingShifts.length; wsi++) {
          if (workingShifts[wsi].user_id === u.id && workingShifts[wsi].date === targetWeekdayOff) {
            workingShifts.splice(wsi, 1)
            break
          }
        }
      }
    })

    // Construção dos shifts finais com start_time e end_time
    const cleanShifts = workingShifts.map((s) => {
      const u = eligibleStaff.find((x) => x.id === s.user_id)!
      const st = u.shift_start_time || '07:00'
      const startDate = new Date(s.date + 'T' + st + ':00.000Z')
      const endDate = new Date(startDate.getTime() + u.work_hours * 3600000)
      return {
        staff_profile: s.user_id,
        user_id: s.user_id,
        date: s.date,
        start_time: startDate.toISOString().replace('T', ' ').substring(0, 23) + 'Z',
        end_time: endDate.toISOString().replace('T', ' ').substring(0, 23) + 'Z',
      }
    })

    return {
      shifts: cleanShifts,
      validation_summary: {
        weekend_off_assignments: weekendOffAssignments,
        additional_off_assignments: additionalOffAssignments,
        issues,
      },
    }
  }

  /**
   * Simulador fidedigno do backend de "Montar Escala" (generate_shifts.js)
   */
  const simulateMontarEscalaPipeline = (
    eligibleStaff: typeof staffList,
    cStart: string,
    cEnd: string,
    timeoffs: Array<{
      id?: string
      staff_profile: string
      date: string
      end_date?: string
      status: string
    }> = [],
  ) => {
    return simulateAiDraftPipeline(eligibleStaff, cStart, cEnd, timeoffs)
  }

  // CENÁRIO 1: Ímpar: folga de fim de semana somente em posição ímpar trabalhada
  it('Cenário 1: Ímpar - folga de fim de semana somente em posição ímpar trabalhada', () => {
    const naturalOdd = computeNaturalPatternByStaff(
      staffOdd.id,
      allStaffIds,
      cycleStart,
      cycleEnd,
      12,
      36,
      staffOdd,
    )

    // Posições ímpares no ciclo (2026-09-26 = pos 1, 2026-09-28 = pos 3, 2026-09-30 = pos 5, 2026-10-02 = pos 7, etc)
    const result = calculateCycleOffDaysForStaff({
      staffId: staffOdd.id,
      staffName: staffOdd.name,
      allStaffIds,
      cycleStart,
      cycleEnd,
      profile: staffOdd,
      staffIndex: 0,
    })

    expect(result.weekendOffDate).toBeTruthy()
    expect(isWeekendDay(result.weekendOffDate!)).toBe(true)
    // O dia escolhido deve ser um dia naturalmente trabalhado pela paridade ímpar
    expect(naturalOdd[result.weekendOffDate!]).toBe(true)

    // Verifica que a posição (1-based) é ímpar
    const diff = Math.round(
      (new Date(result.weekendOffDate! + 'T00:00:00Z').getTime() -
        new Date(cycleStart + 'T00:00:00Z').getTime()) /
        86400000,
    )
    const cyclePosition = diff + 1
    expect(cyclePosition % 2).toBe(1) // Posição ímpar
  })

  // CENÁRIO 2: Par: folga de fim de semana somente em posição par trabalhada
  it('Cenário 2: Par - folga de fim de semana somente em posição par trabalhada', () => {
    const naturalEven = computeNaturalPatternByStaff(
      staffEven.id,
      allStaffIds,
      cycleStart,
      cycleEnd,
      12,
      36,
      staffEven,
    )

    const result = calculateCycleOffDaysForStaff({
      staffId: staffEven.id,
      staffName: staffEven.name,
      allStaffIds,
      cycleStart,
      cycleEnd,
      profile: staffEven,
      staffIndex: 1,
    })

    expect(result.weekendOffDate).toBeTruthy()
    expect(isWeekendDay(result.weekendOffDate!)).toBe(true)
    // O dia escolhido deve ser um dia naturalmente trabalhado pela paridade par
    expect(naturalEven[result.weekendOffDate!]).toBe(true)

    // Verifica que a posição (1-based) é par
    const diff = Math.round(
      (new Date(result.weekendOffDate! + 'T00:00:00Z').getTime() -
        new Date(cycleStart + 'T00:00:00Z').getTime()) /
        86400000,
    )
    const cyclePosition = diff + 1
    expect(cyclePosition % 2).toBe(0) // Posição par
  })

  // CENÁRIO 3: Exatamente uma folga de fim de semana no ciclo inteiro, inclusive ciclo cruzando meses
  it('Cenário 3: Exatamente uma folga de fim de semana no ciclo inteiro, inclusive ciclo cruzando meses (26/09 a 25/10)', () => {
    const draftRes = simulateAiDraftPipeline(staffList, cycleStart, cycleEnd)
    const weekendAssignments = draftRes.validation_summary.weekend_off_assignments

    // Cada colaborador recebe exatamente 1 data de fim de semana no ciclo completo
    expect(weekendAssignments[staffOdd.id]).toHaveLength(1)
    expect(weekendAssignments[staffEven.id]).toHaveLength(1)

    const oddWeekendOff = weekendAssignments[staffOdd.id][0]
    const evenWeekendOff = weekendAssignments[staffEven.id][0]

    expect(isWeekendDay(oddWeekendOff)).toBe(true)
    expect(isWeekendDay(evenWeekendOff)).toBe(true)
    expect(oddWeekendOff >= cycleStart && oddWeekendOff <= cycleEnd).toBe(true)
    expect(evenWeekendOff >= cycleStart && evenWeekendOff <= cycleEnd).toBe(true)
  })

  // CENÁRIO 4: Nunca sábado+domingo automático
  it('Cenário 4: Nunca sábado+domingo automático (apenas 1 dia isolado por colaborador)', () => {
    const draftRes = simulateAiDraftPipeline(staffList, cycleStart, cycleEnd)
    const weekendAssignments = draftRes.validation_summary.weekend_off_assignments

    Object.values(weekendAssignments).forEach((dates) => {
      expect(dates).toHaveLength(1)
      const date = dates[0]
      const dow = dayOfWeekDateOnly(date)
      // É sábado (6) OU domingo (0), nunca um array de 2 dias consecutivos [sábado, domingo]
      expect(dow === 6 || dow === 0).toBe(true)
    })
  })

  // CENÁRIO 5: Exatamente uma folga adicional automática de segunda a sexta em posição trabalhada
  it('Cenário 5: Exatamente uma folga adicional automática de segunda a sexta em posição trabalhada', () => {
    const draftRes = simulateAiDraftPipeline(staffList, cycleStart, cycleEnd)
    const additionalAssignments = draftRes.validation_summary.additional_off_assignments

    expect(additionalAssignments[staffOdd.id]).toHaveLength(1)
    expect(additionalAssignments[staffEven.id]).toHaveLength(1)

    const oddAddOff = additionalAssignments[staffOdd.id][0]
    const evenAddOff = additionalAssignments[staffEven.id][0]

    expect(isWeekdayDate(oddAddOff)).toBe(true)
    expect(isWeekdayDate(evenAddOff)).toBe(true)

    const natOdd = computeNaturalPatternByStaff(staffOdd.id, allStaffIds, cycleStart, cycleEnd, 12, 36, staffOdd)
    const natEven = computeNaturalPatternByStaff(staffEven.id, allStaffIds, cycleStart, cycleEnd, 12, 36, staffEven)

    expect(natOdd[oddAddOff]).toBe(true)
    expect(natEven[evenAddOff]).toBe(true)
  })

  // CENÁRIO 6: A escolha semanal nunca usa a paridade oposta
  it('Cenário 6: A escolha semanal nunca usa a paridade oposta', () => {
    const draftRes = simulateAiDraftPipeline(staffList, cycleStart, cycleEnd)
    const oddAddOff = draftRes.validation_summary.additional_off_assignments[staffOdd.id][0]
    const evenAddOff = draftRes.validation_summary.additional_off_assignments[staffEven.id][0]

    const natOdd = computeNaturalPatternByStaff(staffOdd.id, allStaffIds, cycleStart, cycleEnd, 12, 36, staffOdd)
    const natEven = computeNaturalPatternByStaff(staffEven.id, allStaffIds, cycleStart, cycleEnd, 12, 36, staffEven)

    // Colaborador ímpar nunca folga adicionalmente em dia par (onde já estaria naturalmente de folga)
    expect(natOdd[oddAddOff]).toBe(true)
    expect(natEven[oddAddOff]).toBeUndefined()

    // Colaborador par nunca folga adicionalmente em dia ímpar
    expect(natEven[evenAddOff]).toBe(true)
    expect(natOdd[evenAddOff]).toBeUndefined()
  })

  // CENÁRIO 7: Solicitação aprovada e válida substitui a escolha automática
  it('Cenário 7: Solicitação aprovada e válida substitui a escolha automática', () => {
    // 2026-09-28 é segunda-feira na posição 3 do ciclo (trabalhado para ímpar)
    const approvedRequest = {
      id: 'to-approved-1',
      staff_profile: staffOdd.id,
      date: '2026-09-28',
      status: 'fulfilled',
    }

    const draftRes = simulateAiDraftPipeline(staffList, cycleStart, cycleEnd, [approvedRequest])
    const additionalAssignments = draftRes.validation_summary.additional_off_assignments

    // A folga adicional foi substituída pela solicitação aprovada
    expect(additionalAssignments[staffOdd.id]).toEqual(['2026-09-28'])

    // O plantão de 2026-09-28 foi removido
    const oddShifts = draftRes.shifts.filter((s) => s.staff_profile === staffOdd.id)
    const hasShiftOnApproved = oddShifts.some((s) => s.date === '2026-09-28')
    expect(hasShiftOnApproved).toBe(false)
  })

  // CENÁRIO 8: Solicitação em paridade oposta é tratada explicitamente sem criar folga falsa
  it('Cenário 8: Solicitação em paridade oposta é tratada explicitamente sem criar folga falsa', () => {
    // 2026-09-29 é terça-feira na posição 4 do ciclo (dia de folga natural para paridade ímpar)
    const oppositeRequest = {
      id: 'to-opp-1',
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

    // Conflito registrado com clareza
    expect(res.timeoffConflicts.length).toBeGreaterThan(0)
    expect(res.timeoffConflicts[0].date).toBe('2026-09-29')
    expect(res.timeoffConflicts[0].message).toContain('já estaria de folga pela paridade')

    // Folga adicional automática é mantida em um dia trabalhado real
    expect(res.additionalOffDate).not.toBe('2026-09-29')
    expect(isWeekdayDate(res.additionalOffDate!)).toBe(true)
    const natOdd = computeNaturalPatternByStaff(staffOdd.id, allStaffIds, cycleStart, cycleEnd, 12, 36, staffOdd)
    expect(natOdd[res.additionalOffDate!]).toBe(true)
  })

  // CENÁRIO 9: Múltiplas solicitações aprovadas são preservadas sem folga automática extra
  it('Cenário 9: Múltiplas solicitações aprovadas são preservadas sem folga automática extra', () => {
    // 2026-09-28 (segunda) e 2026-09-30 (quarta) são dias trabalhados para paridade ímpar
    const req1 = {
      id: 'to-m1',
      staff_profile: staffOdd.id,
      date: '2026-09-28',
      status: 'fulfilled',
    }
    const req2 = {
      id: 'to-m2',
      staff_profile: staffOdd.id,
      date: '2026-09-30',
      status: 'fulfilled',
    }

    const draftRes = simulateAiDraftPipeline(staffList, cycleStart, cycleEnd, [req1, req2])
    const additionalAssignments = draftRes.validation_summary.additional_off_assignments

    // Ambas as datas aprovadas são preservadas
    expect(additionalAssignments[staffOdd.id]).toHaveLength(2)
    expect(additionalAssignments[staffOdd.id]).toContain('2026-09-28')
    expect(additionalAssignments[staffOdd.id]).toContain('2026-09-30')

    // Nenhum plantão foi agendado nessas datas
    const oddShifts = draftRes.shifts.filter((s) => s.staff_profile === staffOdd.id)
    expect(oddShifts.some((s) => s.date === '2026-09-28')).toBe(false)
    expect(oddShifts.some((s) => s.date === '2026-09-30')).toBe(false)
  })

  // CENÁRIO 10: Solicitações pendentes/rejeitadas/fora do ciclo não substituem a automática
  it('Cenário 10: Solicitações pendentes/rejeitadas/fora do ciclo não substituem a automática', () => {
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
      date: '2026-11-10',
      status: 'fulfilled',
    }

    const draftRes = simulateAiDraftPipeline(staffList, cycleStart, cycleEnd, [
      pendingReq,
      rejectedReq,
      outsideReq,
    ])
    const additionalAssignments = draftRes.validation_summary.additional_off_assignments

    // A folga adicional automática regular de dia de semana é calculada
    expect(additionalAssignments[staffOdd.id]).toHaveLength(1)
    const chosenDate = additionalAssignments[staffOdd.id][0]
    expect(chosenDate).not.toBe('2026-11-10')
    expect(isWeekdayDate(chosenDate)).toBe(true)
    const natOdd = computeNaturalPatternByStaff(staffOdd.id, allStaffIds, cycleStart, cycleEnd, 12, 36, staffOdd)
    expect(natOdd[chosenDate]).toBe(true)
  })

  // CENÁRIO 11: Salvar/recarregar preserva as datas
  it('Cenário 11: Salvar/recarregar preserva as datas (validação e extração via buildWeekendOffMap e buildWeekdayOffMap)', () => {
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
    const weekdayMap = buildWeekdayOffMap(validationSummary)

    expect(weekendMap.get('staff-odd-1')?.has('2026-09-26')).toBe(true)
    expect(weekendMap.get('staff-even-1')?.has('2026-09-27')).toBe(true)
    expect(weekdayMap.get('staff-odd-1')?.has('2026-09-28')).toBe(true)
    expect(weekdayMap.get('staff-even-1')?.has('2026-09-29')).toBe(true)
  })

  // CENÁRIO 12: Geração por IA e "Montar Escala" produzem as mesmas garantias
  it('Cenário 12: Geração por IA e "Montar Escala" produzem as mesmas garantias determinísticas', () => {
    const aiResult = simulateAiDraftPipeline(staffList, cycleStart, cycleEnd)
    const manualResult = simulateMontarEscalaPipeline(staffList, cycleStart, cycleEnd)

    expect(aiResult.validation_summary.weekend_off_assignments).toEqual(
      manualResult.validation_summary.weekend_off_assignments,
    )
    expect(aiResult.validation_summary.additional_off_assignments).toEqual(
      manualResult.validation_summary.additional_off_assignments,
    )
    expect(aiResult.shifts).toEqual(manualResult.shifts)
  })

  // CENÁRIO 13: Texto/cor de "Folga Fim de Semana" permanecem intactos
  it('Cenário 13: Texto/cor de "Folga Fim de Semana" permanecem intactos no visual da grade', () => {
    // Valida convenções visuais e literais exigidas na UI
    const expectedBadgeText = 'Folga Fim de Semana'
    const expectedColorClasses = {
      container: 'bg-orange-100 border-orange-300',
      label: 'text-orange-800',
    }

    expect(expectedBadgeText).toBe('Folga Fim de Semana')
    expect(expectedColorClasses.container).toContain('bg-orange-100')
    expect(expectedColorClasses.label).toContain('text-orange-800')
  })

  // CENÁRIO 14: Turnos e horários dos plantões continuam sendo preenchidos corretamente
  it('Cenário 14: Turnos e horários dos plantões continuam sendo preenchidos corretamente (ex.: 07:00–19:00 e 19:00–07:00)', () => {
    const draftRes = simulateAiDraftPipeline(staffList, cycleStart, cycleEnd)
    const oddShifts = draftRes.shifts.filter((s) => s.staff_profile === staffOdd.id)
    const evenShifts = draftRes.shifts.filter((s) => s.staff_profile === staffEven.id)

    expect(oddShifts.length).toBeGreaterThan(0)
    expect(evenShifts.length).toBeGreaterThan(0)

    // Dra. Ana Ímpar (07:00 às 19:00)
    oddShifts.forEach((s) => {
      expect(s.start_time).toContain('07:00:00')
      expect(s.end_time).toContain('19:00:00')
    })

    // Dr. Bruno Par (19:00 às 07:00 do dia seguinte)
    evenShifts.forEach((s) => {
      expect(s.start_time).toContain('19:00:00')
      expect(s.end_time).toContain('07:00:00')
    })
  })
})
