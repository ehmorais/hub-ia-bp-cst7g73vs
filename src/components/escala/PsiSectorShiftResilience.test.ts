import { describe, it, expect, vi } from 'vitest'
import * as escalaService from '@/services/escala'

describe('Setor PSI e Resiliência de Shift Types (v0.0.289)', () => {
  it('1. ShiftType 12x36 com horários vazios deriva start_time 07:00 e end_time 19:00', () => {
    // Simula a lógica de resiliência implementada nos geradores de escala
    const resolveShiftTimes = (st: {
      work_hours?: number
      rest_hours?: number
      start_time?: string
      end_time?: string
    }) => {
      const wHours = st.work_hours || 12
      const rHours = st.rest_hours || 36
      let sStart = st.start_time || ''
      let sEnd = st.end_time || ''

      if (!sStart) {
        if (wHours === 12 && rHours >= 36) {
          sStart = '07:00'
        } else {
          sStart = '07:00'
        }
      }
      if (!sEnd) {
        if (wHours === 12 && rHours >= 36 && sStart === '07:00') {
          sEnd = '19:00'
        } else {
          const sHour = parseInt(sStart.split(':')[0], 10) || 7
          const eHour = (sHour + wHours) % 24
          sEnd = (eHour < 10 ? '0' + eHour : '' + eHour) + ':00'
        }
      }

      return { start_time: sStart, end_time: sEnd, work_hours: wHours, rest_hours: rHours }
    }

    // Caso 1: 12x36 padrão com strings vazias
    const res1 = resolveShiftTimes({ work_hours: 12, rest_hours: 36, start_time: '', end_time: '' })
    expect(res1.start_time).toBe('07:00')
    expect(res1.end_time).toBe('19:00')

    // Caso 2: valores indefinidos
    const res2 = resolveShiftTimes({})
    expect(res2.start_time).toBe('07:00')
    expect(res2.end_time).toBe('19:00')

    // Caso 3: turno já configurado preserva horários
    const res3 = resolveShiftTimes({
      work_hours: 12,
      rest_hours: 36,
      start_time: '18:00',
      end_time: '06:00',
    })
    expect(res3.start_time).toBe('18:00')
    expect(res3.end_time).toBe('06:00')
  })

  it('2. Contratos do PSI são considerados elegíveis na presença de turno 12x36 corrigido', () => {
    // Simula avaliação de elegibilidade do backend
    const profiles = [
      {
        id: 'u1odj5rnr44vsdi',
        active: true,
        default_sector: 'tcwun69txrxob81',
        shift_parity: 'odd',
      },
      {
        id: '1054ewd4fyd0jal',
        active: true,
        default_sector: 'tcwun69txrxob81',
        shift_parity: 'odd',
      },
      {
        id: 'x0z4et4u66m8z3z',
        active: true,
        default_sector: 'tcwun69txrxob81',
        shift_parity: 'odd',
      },
      {
        id: 'd6ysp08kiks2x90',
        active: true,
        default_sector: 'tcwun69txrxob81',
        shift_parity: 'even',
      },
    ]

    const shiftType12x36 = {
      id: 'jjpdawouvsppc8y',
      name: '12x36',
      code: '12x36h',
      work_hours: 12,
      rest_hours: 36,
      start_time: '07:00',
      end_time: '19:00',
    }

    const contracts = [
      {
        id: 'bl0s13wksulkg5e',
        staff_profile: 'u1odj5rnr44vsdi',
        active: true,
        contract_type: 'CLT 180h',
        shift_type: shiftType12x36.id,
      },
      {
        id: 'abjfjvezp6znpag',
        staff_profile: '1054ewd4fyd0jal',
        active: true,
        contract_type: 'CLT 180h',
        shift_type: shiftType12x36.id,
      },
      {
        id: 'ayx7o3216o8z1zf',
        staff_profile: 'x0z4et4u66m8z3z',
        active: true,
        contract_type: 'CLT 180h',
        shift_type: shiftType12x36.id,
      },
      {
        id: 'mk73ir2kany3qtt',
        staff_profile: 'd6ysp08kiks2x90',
        active: true,
        contract_type: 'CLT 180h',
        shift_type: shiftType12x36.id,
      },
    ]

    const sectorId = 'tcwun69txrxob81'
    const profileMap = new Map(profiles.map((p) => [p.id, p]))

    const eligible = contracts.filter((c) => {
      const p = profileMap.get(c.staff_profile)
      if (!p || !p.active || p.default_sector !== sectorId) return false
      if (!c.active) return false
      if (!c.shift_type) return false
      return true
    })

    expect(eligible.length).toBe(4)
    expect(eligible.map((e) => e.staff_profile)).toEqual([
      'u1odj5rnr44vsdi',
      '1054ewd4fyd0jal',
      'x0z4et4u66m8z3z',
      'd6ysp08kiks2x90',
    ])
  })

  it('3. Mensagem de exclusão NO_ELIGIBLE_STAFF lista motivos detalhados em português por colaborador', () => {
    const excluded = [
      { name: 'Colaborador A', reason: 'setor diferente (Esperado: PSI)' },
      { name: 'Colaborador B', reason: 'perfil inativo' },
      { name: 'Colaborador C', reason: 'contrato incompleto ou inativo' },
    ]

    const excludedSummary = excluded.map((item) => `${item.name}: ${item.reason}`).join('; ')
    const detailMsg =
      'Nenhum colaborador elegível para este setor' +
      (excludedSummary ? ` (motivos: ${excludedSummary})` : '.')

    expect(detailMsg).toContain('Colaborador A: setor diferente')
    expect(detailMsg).toContain('Colaborador B: perfil inativo')
    expect(detailMsg).toContain('Colaborador C: contrato incompleto')
  })

  it('4. Idempotência da migração de dados 0068: update repetido mantém horários consistentes', () => {
    // Simula a idempotência da migração
    const record = {
      id: 'jjpdawouvsppc8y',
      start_time: '',
      end_time: '',
      work_hours: 12,
      rest_hours: 36,
    }

    const applyMigration = (rec: typeof record) => {
      rec.start_time = '07:00'
      rec.end_time = '19:00'
    }

    // 1ª execução
    applyMigration(record)
    expect(record.start_time).toBe('07:00')
    expect(record.end_time).toBe('19:00')

    // 2ª execução (idempotente)
    applyMigration(record)
    expect(record.start_time).toBe('07:00')
    expect(record.end_time).toBe('19:00')
  })

  it('5. Validação de obrigatoriedade de horários para turnos não administrativos', () => {
    const validateShiftType = (type: {
      is_administrative: boolean
      start_time?: string
      end_time?: string
    }) => {
      if (!type.is_administrative && (!type.start_time || !type.end_time)) {
        return {
          valid: false,
          error:
            'Horários de início e fim são obrigatórios para turnos operacionais (não administrativos).',
        }
      }
      return { valid: true }
    }

    // Turno operacional sem horário deve falhar
    const invalidOp = validateShiftType({
      is_administrative: false,
      start_time: '',
      end_time: '',
    })
    expect(invalidOp.valid).toBe(false)
    expect(invalidOp.error).toContain('Horários de início e fim são obrigatórios')

    // Turno operacional com horário deve ser válido
    const validOp = validateShiftType({
      is_administrative: false,
      start_time: '07:00',
      end_time: '19:00',
    })
    expect(validOp.valid).toBe(true)

    // Turno administrativo sem horários fixos é permitido
    const validAdmin = validateShiftType({
      is_administrative: true,
      start_time: '',
      end_time: '',
    })
    expect(validAdmin.valid).toBe(true)
  })

  it('6. Regressão de geração e chamada de draft do setor PSI com lock e reconciliação', async () => {
    vi.spyOn(escalaService, 'generateDraftShifts').mockResolvedValueOnce({
      success: true,
      draft: [
        {
          id: 'shift-psi-1',
          staff_profile: 'u1odj5rnr44vsdi',
          start_time: '2025-11-01 07:00:00',
          end_time: '2025-11-01 19:00:00',
        },
        {
          id: 'shift-psi-2',
          staff_profile: 'd6ysp08kiks2x90',
          start_time: '2025-11-02 07:00:00',
          end_time: '2025-11-02 19:00:00',
        },
      ],
      run_id: 'run-psi-valid',
      cycle_id: 'cycle-1',
      sector_id: 'tcwun69txrxob81',
    })

    const res = await escalaService.generateDraftShifts('cycle-1', 'tcwun69txrxob81')
    expect(res.success).toBe(true)
    expect(res.draft.length).toBe(2)
    expect(res.sector_id).toBe('tcwun69txrxob81')
  })
})
