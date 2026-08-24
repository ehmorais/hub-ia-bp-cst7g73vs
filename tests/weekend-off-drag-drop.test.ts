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

// Helper que simula a lógica de move_weekend_off do backend (pocketbase/hooks/move_weekend_off.js)
interface BackendMoveWeekendOffParams {
  draftRecord: {
    id: string
    cycle: string
    sector: string
    validation_summary?: {
      weekend_off_assignments?: Record<string, string[]>
      weekend_off_overrides?: Record<string, any>
    }
  } | null
  staffId: string
  sourceDate: string
  targetDate: string
  cycle: {
    start_date: string
    end_date: string
  }
  sector: {
    min_staffing: number
  }
  shifts: Array<{
    id: string
    staff_profile: string
    start_time: string
    end_time: string
    sector: string
    cycle: string
  }>
}

interface BackendMoveResult {
  status: number
  error?: string
  data?: {
    success: boolean
    draft_id: string
    staff_id: string
    source_date: string
    target_date: string
    weekend_off_assignments: Record<string, string[]>
    weekend_off_overrides: Record<string, any>
    shifts: Array<{ id: string; staff_profile: string; start_time: string; end_time: string }>
  }
}

function simulateBackendMoveWeekendOff(params: BackendMoveWeekendOffParams): BackendMoveResult {
  const { draftRecord, staffId, sourceDate, targetDate, cycle, sector, shifts } = params

  if (!draftRecord) {
    return { status: 400, error: 'Rascunho não encontrado.' }
  }
  if (!staffId || !sourceDate || !targetDate) {
    return { status: 400, error: 'draft_id, staff_id, source_date e target_date são obrigatórios.' }
  }
  if (sourceDate === targetDate) {
    return { status: 400, error: 'A data de destino deve ser diferente da data de origem.' }
  }

  const srcDow = dayOfWeekDateOnly(sourceDate)
  const tgtDow = dayOfWeekDateOnly(targetDate)

  if (srcDow !== 6 && srcDow !== 0) {
    return { status: 400, error: 'A data de origem deve ser um sábado ou domingo.' }
  }
  if (srcDow !== tgtDow) {
    return {
      status: 400,
      error: 'Fim de semana incompatível: sábado só pode ser movido para sábado e domingo somente para domingo.',
    }
  }

  const cycleStart = cycle.start_date.split(' ')[0].split('T')[0]
  const cycleEnd = cycle.end_date.split(' ')[0].split('T')[0]

  if (sourceDate < cycleStart || sourceDate > cycleEnd) {
    return { status: 400, error: `A data de origem (${sourceDate}) está fora do ciclo.` }
  }
  if (targetDate < cycleStart || targetDate > cycleEnd) {
    return { status: 400, error: `A data de destino (${targetDate}) está fora do ciclo.` }
  }

  const valSummary = draftRecord.validation_summary || {}
  const assignments: Record<string, string[]> = { ...(valSummary.weekend_off_assignments || {}) }

  const rawStaffDates = assignments[staffId]
  let staffDates: string[] = []
  if (Array.isArray(rawStaffDates)) {
    staffDates = rawStaffDates
      .map((d) => (String(d) || '').split(' ')[0].split('T')[0])
      .filter(Boolean)
  }

  if (staffDates.length === 0) {
    return {
      status: 400,
      error: 'O colaborador não possui folgas de fim de semana registradas no rascunho.',
    }
  }

  const srcIndex = staffDates.indexOf(sourceDate)
  if (srcIndex === -1) {
    return {
      status: 400,
      error: `A data ${sourceDate} não é uma das folgas atuais do colaborador.`,
    }
  }

  for (let j = 0; j < staffDates.length; j++) {
    if (j !== srcIndex && staffDates[j] === targetDate) {
      return {
        status: 400,
        error: 'A data de destino já está designada como folga para este colaborador.',
      }
    }
  }

  // Identifica plantões no destino e na origem
  let targetShift = shifts.find((s) => s.staff_profile === staffId && s.start_time.startsWith(targetDate))
  let sourceShift = shifts.find((s) => s.staff_profile === staffId && s.start_time.startsWith(sourceDate))

  // Simula redistribuição de plantões (swap de targetDate para sourceDate se houver shift no destino)
  const simulatedShifts: Array<{ id: string; staff_profile: string; date: string }> = []
  shifts.forEach((s) => {
    const sDate = s.start_time.split(' ')[0]
    if (s.staff_profile === staffId && sDate === targetDate) {
      simulatedShifts.push({ id: s.id, staff_profile: staffId, date: sourceDate })
    } else if (s.staff_profile === staffId && sDate === sourceDate) {
      // Já existia um na origem
    } else {
      simulatedShifts.push({ id: s.id, staff_profile: s.staff_profile, date: sDate })
    }
  })

  // Validação de cobertura mínima pós-movimento / swap
  const dayCounts: Record<string, number> = {}
  simulatedShifts.forEach((s) => {
    dayCounts[s.date] = (dayCounts[s.date] || 0) + 1
  })

  const minStaff = sector.min_staffing || 0
  let cur = cycleStart
  while (cur <= cycleEnd) {
    const count = dayCounts[cur] || 0
    if (minStaff > 0 && count < minStaff) {
      return {
        status: 400,
        error: `Cobertura insuficiente no setor: o movimento deixaria o dia ${cur} abaixo do efetivo mínimo (${count}/${minStaff}).`,
      }
    }
    // Próximo dia
    const d = new Date(cur + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + 1)
    cur = d.toISOString().split('T')[0]
  }

  // Prepara novos assignments e overrides
  const newStaffDates = staffDates.map((d, idx) => (idx === srcIndex ? targetDate : d))
  newStaffDates.sort((a, b) => {
    const dA = dayOfWeekDateOnly(a)
    const dB = dayOfWeekDateOnly(b)
    if (dA === 6 && dB === 0) return -1
    if (dA === 0 && dB === 6) return 1
    return a.localeCompare(b)
  })

  assignments[staffId] = newStaffDates

  const overrides: Record<string, any> = { ...(valSummary.weekend_off_overrides || {}) }
  if (!overrides[staffId]) overrides[staffId] = {}
  const overrideKey = srcDow === 6 ? 'saturday' : 'sunday'
  overrides[staffId][overrideKey] = {
    source_date: sourceDate,
    target_date: targetDate,
    weekday: srcDow,
    moved_at: new Date().toISOString(),
    manual_override: true,
  }

  // Aplica mutação nos shifts
  const updatedShifts = shifts.map((s) => {
    const sDate = s.start_time.split(' ')[0]
    if (s.staff_profile === staffId && sDate === targetDate) {
      return {
        ...s,
        start_time: s.start_time.replace(targetDate, sourceDate),
        end_time: s.end_time.replace(targetDate, sourceDate),
      }
    }
    return s
  })

  return {
    status: 200,
    data: {
      success: true,
      draft_id: draftRecord.id,
      staff_id: staffId,
      source_date: sourceDate,
      target_date: targetDate,
      weekend_off_assignments: assignments,
      weekend_off_overrides: overrides,
      shifts: updatedShifts,
    },
  }
}

describe('Drag-and-Drop Manual de Folga de Fim de Semana (WEEKEND_OFF)', () => {
  const cycleStart = '2026-05-01'
  const cycleEnd = '2026-05-31'
  const staffA = 'staff-001'
  const staffB = 'staff-002'
  const cycleObj = { start_date: '2026-05-01', end_date: '2026-05-31' }
  const sectorObj = { min_staffing: 1 }

  // Ciclo Maio/2026:
  // Sábados: 2026-05-02, 2026-05-09, 2026-05-16, 2026-05-23, 2026-05-30
  // Domingos: 2026-05-03, 2026-05-10, 2026-05-17, 2026-05-24, 2026-05-31

  // =========================================================================
  // ETAPA 1 - Teste A: Reprodução do bug v0.0.260 (fluxo manual sem assignments)
  // =========================================================================
  describe('Teste A — Reprodução do bug da v0.0.260 (fluxo manual sem assignments)', () => {
    it('Antes da correção: Rascunho manual sem weekend_off_assignments retorna 400 "não possui folgas"', () => {
      // Simulação do draft gerado no fluxo manual ANTERIOR (sem weekend_off_assignments persistido)
      const manualDraftLegacy = {
        id: 'draft-legacy-001',
        cycle: 'cycle-001',
        sector: 'sector-001',
        validation_summary: {
          violations_count: 0,
          warnings_count: 0,
          // weekend_off_assignments ausente!
        },
      }

      const result = simulateBackendMoveWeekendOff({
        draftRecord: manualDraftLegacy,
        staffId: staffA,
        sourceDate: '2026-05-02',
        targetDate: '2026-05-09',
        cycle: cycleObj,
        sector: sectorObj,
        shifts: [],
      })

      expect(result.status).toBe(400)
      expect(result.error).toBe('O colaborador não possui folgas de fim de semana registradas no rascunho.')
    })
  })

  // =========================================================================
  // ETAPA 1 - Teste B: Sucesso após persistência (fluxo manual corrigido)
  // =========================================================================
  describe('Teste B — Sucesso após persistência (fluxo manual corrigido)', () => {
    it('Após persistência: move_weekend_off é aceito com 200 quando destino NÃO tem shift (apenas move folga)', () => {
      // Simulação da saída do generate_shifts.js corrigido, com assignments populados
      const manualDraftFixed = {
        id: 'draft-fixed-001',
        cycle: 'cycle-001',
        sector: 'sector-001',
        validation_summary: {
          violations_count: 0,
          warnings_count: 0,
          weekend_off_assignments: {
            [staffA]: ['2026-05-02', '2026-05-03'],
            [staffB]: ['2026-05-09', '2026-05-10'],
          },
          cycle_start: '2026-05-01',
          cycle_end: '2026-05-31',
        },
      }

      const result = simulateBackendMoveWeekendOff({
        draftRecord: manualDraftFixed,
        staffId: staffA,
        sourceDate: '2026-05-02', // Sábado
        targetDate: '2026-05-16', // Sábado (sem shift do colaborador no destino)
        cycle: cycleObj,
        sector: { min_staffing: 0 },
        shifts: [],
      })

      expect(result.status).toBe(200)
      expect(result.data?.success).toBe(true)
      expect(result.data?.source_date).toBe('2026-05-02')
      expect(result.data?.target_date).toBe('2026-05-16')

      // Assignments atualizados: 2026-05-02 virou 2026-05-16
      const staffAAssignments = result.data?.weekend_off_assignments[staffA]
      expect(staffAAssignments).toContain('2026-05-16')
      expect(staffAAssignments).toContain('2026-05-03')
      expect(staffAAssignments).not.toContain('2026-05-02')

      // Override audit trail registrado
      const staffAOverride = result.data?.weekend_off_overrides[staffA]
      expect(staffAOverride?.saturday).toBeDefined()
      expect(staffAOverride?.saturday.manual_override).toBe(true)
      expect(staffAOverride?.saturday.source_date).toBe('2026-05-02')
      expect(staffAOverride?.saturday.target_date).toBe('2026-05-16')
      expect(staffAOverride?.saturday.weekday).toBe(6)
    })
  })

  // =========================================================================
  // ETAPA 1 - Teste C: Destino com shift (swap atômico)
  // =========================================================================
  describe('Teste C — Destino com shift (swap atômico)', () => {
    it('Quando colaborador possui plantão no destino, realiza swap atômico para a data de origem', () => {
      const manualDraft = {
        id: 'draft-swap-001',
        cycle: 'cycle-001',
        sector: 'sector-001',
        validation_summary: {
          weekend_off_assignments: {
            [staffA]: ['2026-05-02', '2026-05-03'],
          },
        },
      }

      // Plantão no sábado destino (2026-05-09)
      const shifts = [
        {
          id: 'shift-1',
          staff_profile: staffA,
          start_time: '2026-05-09 07:00:00.000Z',
          end_time: '2026-05-09 19:00:00.000Z',
          sector: 'sector-001',
          cycle: 'cycle-001',
        },
        {
          id: 'shift-2',
          staff_profile: staffB,
          start_time: '2026-05-02 07:00:00.000Z',
          end_time: '2026-05-02 19:00:00.000Z',
          sector: 'sector-001',
          cycle: 'cycle-001',
        },
      ]

      const result = simulateBackendMoveWeekendOff({
        draftRecord: manualDraft,
        staffId: staffA,
        sourceDate: '2026-05-02',
        targetDate: '2026-05-09',
        cycle: cycleObj,
        sector: { min_staffing: 1 },
        shifts,
      })

      expect(result.status).toBe(200)
      expect(result.data?.success).toBe(true)

      // Plantão de staffA que estava em 09/05 foi movido para 02/05 (origem da folga)
      const movedShift = result.data?.shifts.find((s) => s.id === 'shift-1')
      expect(movedShift?.start_time).toContain('2026-05-02')

      // Destino 09/05 agora é folga
      expect(result.data?.weekend_off_assignments[staffA]).toContain('2026-05-09')
      expect(result.data?.weekend_off_assignments[staffA]).not.toContain('2026-05-02')
    })
  })

  // =========================================================================
  // ETAPA 1 - Teste D: Validações mantidas
  // =========================================================================
  describe('Teste D — Validações mantidas (weekday mismatch, ciclo, etc.)', () => {
    const validDraft = {
      id: 'draft-val-001',
      cycle: 'cycle-001',
      sector: 'sector-001',
      validation_summary: {
        weekend_off_assignments: {
          [staffA]: ['2026-05-02', '2026-05-03'],
        },
      },
    }

    it('Rejeita sábado -> domingo com "Fim de semana incompatível"', () => {
      const result = simulateBackendMoveWeekendOff({
        draftRecord: validDraft,
        staffId: staffA,
        sourceDate: '2026-05-02', // Sábado
        targetDate: '2026-05-10', // Domingo
        cycle: cycleObj,
        sector: sectorObj,
        shifts: [],
      })

      expect(result.status).toBe(400)
      expect(result.error).toContain('Fim de semana incompatível')
    })

    it('Rejeita data fora do ciclo', () => {
      const result = simulateBackendMoveWeekendOff({
        draftRecord: validDraft,
        staffId: staffA,
        sourceDate: '2026-05-02',
        targetDate: '2026-06-06', // Sábado de junho (fora do ciclo)
        cycle: cycleObj,
        sector: sectorObj,
        shifts: [],
      })

      expect(result.status).toBe(400)
      expect(result.error).toContain('fora do ciclo')
    })

    it('Rejeita colaborador não cadastrado no draft', () => {
      const result = simulateBackendMoveWeekendOff({
        draftRecord: validDraft,
        staffId: 'staff-inexistente',
        sourceDate: '2026-05-02',
        targetDate: '2026-05-09',
        cycle: cycleObj,
        sector: sectorObj,
        shifts: [],
      })

      expect(result.status).toBe(400)
      expect(result.error).toBe('O colaborador não possui folgas de fim de semana registradas no rascunho.')
    })

    it('Rejeita movimento se deixar a cobertura abaixo do efetivo mínimo', () => {
      const draft = {
        id: 'draft-cov-001',
        cycle: 'cycle-001',
        sector: 'sector-001',
        validation_summary: {
          weekend_off_assignments: {
            [staffA]: ['2026-05-02', '2026-05-03'],
          },
        },
      }

      // 09/05 tem apenas 1 plantonista (staffA) e o setor exige min_staffing = 2
      const shifts = [
        {
          id: 'shift-1',
          staff_profile: staffA,
          start_time: '2026-05-09 07:00:00.000Z',
          end_time: '2026-05-09 19:00:00.000Z',
          sector: 'sector-001',
          cycle: 'cycle-001',
        },
      ]

      const result = simulateBackendMoveWeekendOff({
        draftRecord: draft,
        staffId: staffA,
        sourceDate: '2026-05-02',
        targetDate: '2026-05-09',
        cycle: cycleObj,
        sector: { min_staffing: 2 }, // Exige 2
        shifts,
      })

      expect(result.status).toBe(400)
      expect(result.error).toContain('Cobertura insuficiente no setor')
    })
  })

  // =========================================================================
  // Testes de UI/Helper Frontend existentes mantidos
  // =========================================================================
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
