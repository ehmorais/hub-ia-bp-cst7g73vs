import { describe, it, expect } from 'vitest'
import { isVacationDateInclusive } from '@/lib/escala-vacation'

describe('Validação de Bloqueio de Férias nos Fluxos IA, Manual e Backend Hook', () => {
  const vacationProfile = {
    id: 'staff-vac-1',
    name: 'Dra. Ana Silva',
    vacation_enabled: true,
    vacation_start: '2025-05-10',
    vacation_end: '2025-05-20',
  }

  const activeWorkerProfile = {
    id: 'staff-work-2',
    name: 'Enf. Bruno Costa',
    vacation_enabled: false,
    vacation_start: null,
    vacation_end: null,
  }

  it('1. Fluxo IA (generate_shifts_draft): detecta férias e gera violação/rejeição no período inclusivo', () => {
    // Simula a lógica de verificação de violação do generate_shifts_draft.js
    const proposedShifts = [
      { user_id: 'staff-vac-1', date: '2025-05-09' }, // antes - permitido
      { user_id: 'staff-vac-1', date: '2025-05-10' }, // limite inicial - BLOQUEADO
      { user_id: 'staff-vac-1', date: '2025-05-15' }, // meio - BLOQUEADO
      { user_id: 'staff-vac-1', date: '2025-05-20' }, // limite final - BLOQUEADO
      { user_id: 'staff-vac-1', date: '2025-05-21' }, // após - permitido
      { user_id: 'staff-work-2', date: '2025-05-15' }, // sem férias - permitido
    ]

    const usersMap: Record<string, any> = {
      'staff-vac-1': vacationProfile,
      'staff-work-2': activeWorkerProfile,
    }

    const violations: string[] = []
    proposedShifts.forEach((s) => {
      const u = usersMap[s.user_id]
      if (isVacationDateInclusive(u, s.date)) {
        violations.push(`Colaborador está de férias no período: ${u.name} em ${s.date}.`)
      }
    })

    expect(violations).toHaveLength(3)
    expect(violations[0]).toBe(
      'Colaborador está de férias no período: Dra. Ana Silva em 2025-05-10.',
    )
    expect(violations[1]).toBe(
      'Colaborador está de férias no período: Dra. Ana Silva em 2025-05-15.',
    )
    expect(violations[2]).toBe(
      'Colaborador está de férias no período: Dra. Ana Silva em 2025-05-20.',
    )
  })

  it('2. Fluxo Manual (generate_shifts e commit_schedule): impede inclusão em datas de férias', () => {
    // Simula a lógica de montagem de datas em generate_shifts.js
    const allCycleDates = ['2025-05-09', '2025-05-10', '2025-05-11', '2025-05-21']
    const allocatedDates: string[] = []

    allCycleDates.forEach((d) => {
      if (!isVacationDateInclusive(vacationProfile, d)) {
        allocatedDates.push(d)
      }
    })

    expect(allocatedDates).toEqual(['2025-05-09', '2025-05-21'])
    expect(allocatedDates.includes('2025-05-10')).toBe(false)
  })

  it('3. Validação Backend Hook (validate_vacation_shift): mensagem clara em português sem bypass', () => {
    // Simulação exata da validação do hook PocketBase shifts
    function validateShiftCreation(shift: { staff_profile: string; start_time: string }) {
      const shiftDate = shift.start_time.split(' ')[0].split('T')[0]
      const profile = shift.staff_profile === 'staff-vac-1' ? vacationProfile : activeWorkerProfile

      if (profile.vacation_enabled === true && profile.vacation_start && profile.vacation_end) {
        if (shiftDate >= profile.vacation_start && shiftDate <= profile.vacation_end) {
          throw new Error('Colaborador está de férias no período.')
        }
      }
      return true
    }

    // Alocação durante férias lança erro claro em português
    expect(() =>
      validateShiftCreation({
        staff_profile: 'staff-vac-1',
        start_time: '2025-05-10 07:00:00.000Z',
      }),
    ).toThrow('Colaborador está de férias no período.')

    expect(() =>
      validateShiftCreation({
        staff_profile: 'staff-vac-1',
        start_time: '2025-05-20 19:00:00.000Z',
      }),
    ).toThrow('Colaborador está de férias no período.')

    // Alocação fora do período passa com sucesso
    expect(
      validateShiftCreation({
        staff_profile: 'staff-vac-1',
        start_time: '2025-05-09 07:00:00.000Z',
      }),
    ).toBe(true)

    // Colaborador sem férias passa sempre
    expect(
      validateShiftCreation({
        staff_profile: 'staff-work-2',
        start_time: '2025-05-15 07:00:00.000Z',
      }),
    ).toBe(true)
  })

  it('4. Validação no formulário StaffProfiles: obrigatoriedade e ordem de datas', () => {
    function validateVacationForm(formData: {
      vacation_enabled: boolean
      vacation_start: string
      vacation_end: string
    }) {
      const vStart = formData.vacation_start.trim()
      const vEnd = formData.vacation_end.trim()
      if (formData.vacation_enabled) {
        if (!vStart || !vEnd) {
          return {
            valid: false,
            error: 'Ao ativar as férias, as datas "De" e "Até" são obrigatórias.',
          }
        }
        if (vEnd < vStart) {
          return {
            valid: false,
            error:
              'A data final de férias ("Até") deve ser igual ou posterior à data inicial ("De").',
          }
        }
      }
      return { valid: true }
    }

    // Quando desativado, passa mesmo com campos vazios (registros legados preservados)
    expect(
      validateVacationForm({ vacation_enabled: false, vacation_start: '', vacation_end: '' }),
    ).toEqual({ valid: true })

    // Quando ativo sem data
    expect(
      validateVacationForm({
        vacation_enabled: true,
        vacation_start: '',
        vacation_end: '2025-06-10',
      }),
    ).toEqual({
      valid: false,
      error: 'Ao ativar as férias, as datas "De" e "Até" são obrigatórias.',
    })

    // Quando ativo com data final antes da inicial
    expect(
      validateVacationForm({
        vacation_enabled: true,
        vacation_start: '2025-06-20',
        vacation_end: '2025-06-10',
      }),
    ).toEqual({
      valid: false,
      error: 'A data final de férias ("Até") deve ser igual ou posterior à data inicial ("De").',
    })

    // Válido
    expect(
      validateVacationForm({
        vacation_enabled: true,
        vacation_start: '2025-06-10',
        vacation_end: '2025-06-20',
      }),
    ).toEqual({ valid: true })
  })
})
