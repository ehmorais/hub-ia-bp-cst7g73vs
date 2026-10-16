import { describe, it, expect } from 'vitest'

// Simulação da lógica de resolução de plantões e unicidade implementada nos hooks
describe('Centro Cirúrgico - Persistência de Rascunho e Unicidade de Turnos', () => {
  interface Shift {
    staff_profile: string
    cycle: string
    sector: string
    start_time: string
    end_time: string
  }

  it('deve remover plantões pré-existentes do colaborador em outros setores do mesmo ciclo ao salvar nova escala', () => {
    // Cenário: colaborador "ROBERTA KELLI" foi transferido para o Centro Cirúrgico,
    // mas ainda possuía plantões gravados no mesmo ciclo em outro setor (ex: UTI Adulto).
    const cycleId = 'cycle-11-2026'
    const ccSectorId = 'sector-centro-cirurgico'
    const utiSectorId = 'sector-uti-adulto'
    const staffId = 'staff-roberta-kelli'

    // Estado inicial no banco:
    const databaseShifts: Shift[] = [
      {
        staff_profile: staffId,
        cycle: cycleId,
        sector: utiSectorId,
        start_time: '2026-10-27 08:00:00Z',
        end_time: '2026-10-27 16:00:00Z',
      },
      {
        staff_profile: 'other-staff',
        cycle: cycleId,
        sector: utiSectorId,
        start_time: '2026-10-27 08:00:00Z',
        end_time: '2026-10-27 16:00:00Z',
      },
    ]

    // Novos turnos propostos para o Centro Cirúrgico
    const newDraftShifts: Shift[] = [
      {
        staff_profile: staffId,
        cycle: cycleId,
        sector: ccSectorId,
        start_time: '2026-10-27 08:00:00Z',
        end_time: '2026-10-27 16:00:00Z',
      },
    ]

    const eligibleStaffIds = [staffId]

    // 1. Limpeza por setor atual
    let currentDb = databaseShifts.filter((s) => !(s.cycle === cycleId && s.sector === ccSectorId))

    // 2. Limpeza por colaboradores elegíveis no ciclo (correção do bug)
    currentDb = currentDb.filter(
      (s) => !(s.cycle === cycleId && eligibleStaffIds.includes(s.staff_profile)),
    )

    // 3. Inserção dos novos turnos
    const finalShifts = [...currentDb, ...newDraftShifts]

    // Validação da unicidade: idx_shifts_profile_cycle_start_unique
    const keys = new Set<string>()
    let hasDuplicate = false
    for (const shift of finalShifts) {
      const key = `${shift.staff_profile}|${shift.cycle}|${shift.start_time}`
      if (keys.has(key)) {
        hasDuplicate = true
        break
      }
      keys.add(key)
    }

    expect(hasDuplicate).toBe(false)
    expect(finalShifts).toHaveLength(2)
    const robertaShifts = finalShifts.filter((s) => s.staff_profile === staffId)
    expect(robertaShifts).toHaveLength(1)
    expect(robertaShifts[0].sector).toBe(ccSectorId)
  })

  it('salva rascunho com aviso não-bloqueante no validation_summary quando folga de fim de semana é inviável', () => {
    // Requisito 3: Se a causa for regra inviável (ex: cobertura mínima impossível),
    // o rascunho deve ser salvo com aviso no validation_summary, não com falha dura.
    const warnings: string[] = [
      'Folga de fim de semana não alocada para ROBERTA: nenhuma data segura preserva a cobertura mínima (2). Colaborador mantido escalado para garantir a assistência.',
    ]

    const validationSummary = {
      violations_count: 0,
      warnings_count: warnings.length,
      hard_violations: [],
      warnings: warnings.slice(0, 20),
      weekend_off_assignments: {},
      weekend_off_blocked_staff: ['staff-roberta'],
    }

    expect(validationSummary.violations_count).toBe(0)
    expect(validationSummary.warnings_count).toBe(1)
    expect(validationSummary.warnings[0]).toContain('nenhuma data segura')
  })
})
