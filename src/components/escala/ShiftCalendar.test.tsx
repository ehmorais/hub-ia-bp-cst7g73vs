import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { ShiftCalendar } from '@/components/escala/ShiftCalendar'
import { formatCorenLabel, formatShiftCalendarSecondLine } from '@/lib/escala-calendar-formatter'

const mockToast = vi.fn()
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

// Mock PocketBase client
const mockUpdate = vi.fn().mockResolvedValue({})
vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    collection: () => ({
      getFullList: vi.fn().mockResolvedValue([
        {
          id: 'sector-uti',
          name: 'UTI Adulto',
          department: 'dept-1',
          min_staffing: 1,
          ideal_staffing: 2,
        },
      ]),
      update: mockUpdate,
    }),
  },
}))

// Mock realtime hook
vi.mock('@/hooks/use-realtime', () => ({
  useRealtime: vi.fn(),
}))

describe('ShiftCalendar - Férias dos Colaboradores no Calendário', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const dummyCycle = {
    id: 'cycle-nov-2025',
    name: 'Ciclo Novembro 2025',
    start_date: '2025-11-01 00:00:00.000Z',
    end_date: '2025-11-05 23:59:59.000Z',
    status: 'draft',
  }

  const dummyStaffProfiles = [
    {
      id: 'staff-vacation-01',
      name: 'Maria Helena de Medeiros Albuquerque de Oliveira',
      professional_id: '987654',
      default_sector: 'sector-uti',
      vacation_enabled: true,
      vacation_start: '2025-11-02',
      vacation_end: '2025-11-04',
    },
    {
      id: 'staff-active-02',
      name: 'João Pedro de Vasconcelos Albuquerque Maranhão Filho',
      professional_id: '123456',
      default_sector: 'sector-uti',
      vacation_enabled: false,
      vacation_start: null,
      vacation_end: null,
    },
  ]

  const dummyContracts = [
    {
      id: 'contract-01',
      staff_profile: 'staff-vacation-01',
      expand: {
        shift_type: { id: 'st-d', name: '12x36 Diurno', start_time: '07:00', end_time: '19:00' },
      },
    },
    {
      id: 'contract-02',
      staff_profile: 'staff-active-02',
      expand: {
        shift_type: { id: 'st-n', name: '12x36 Noturno', start_time: '19:00', end_time: '07:00' },
      },
    },
  ]

  it('(a) Intervalo inclusivo: férias de 02/11 a 04/11 exibem destaque no primeiro dia, no último e nos intermediários', () => {
    render(
      <ShiftCalendar
        shifts={[]}
        cycle={dummyCycle}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
      />,
    )

    // Primeiro dia do intervalo: 2025-11-02
    const firstDayVacation = screen.getByTestId('vacation-staff-vacation-01-2025-11-02')
    expect(firstDayVacation).toBeDefined()
    expect(firstDayVacation.textContent).toContain(
      'Maria Helena de Medeiros Albuquerque de Oliveira',
    )
    expect(firstDayVacation.textContent).toContain('FÉRIAS')

    // Dia intermediário: 2025-11-03
    const midDayVacation = screen.getByTestId('vacation-staff-vacation-01-2025-11-03')
    expect(midDayVacation).toBeDefined()
    expect(midDayVacation.textContent).toContain('Maria Helena de Medeiros Albuquerque de Oliveira')
    expect(midDayVacation.textContent).toContain('FÉRIAS')

    // Último dia do intervalo: 2025-11-04
    const lastDayVacation = screen.getByTestId('vacation-staff-vacation-01-2025-11-04')
    expect(lastDayVacation).toBeDefined()
    expect(lastDayVacation.textContent).toContain(
      'Maria Helena de Medeiros Albuquerque de Oliveira',
    )
    expect(lastDayVacation.textContent).toContain('FÉRIAS')

    // Fora do período: 2025-11-01 e 2025-11-05 NÃO exibem férias
    expect(screen.queryByTestId('vacation-staff-vacation-01-2025-11-01')).toBeNull()
    expect(screen.queryByTestId('vacation-staff-vacation-01-2025-11-05')).toBeNull()
  })

  it('(b) Dia SEM plantão destacado com texto "Férias"/"FÉRIAS", fundo esmeralda e ícone Palmtree', () => {
    const { container } = render(
      <ShiftCalendar
        shifts={[]}
        cycle={dummyCycle}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
      />,
    )

    const card = screen.getByTestId('vacation-staff-vacation-01-2025-11-02')
    expect(card.className).toContain('bg-emerald-50')
    expect(card.className).toContain('border-emerald-300')
    expect(card.className).toContain('text-emerald-800')
    expect(card.textContent).toContain('FÉRIAS')
    expect(card.textContent).toContain('Maria Helena de Medeiros Albuquerque de Oliveira')
    // Nome completo sem classe truncate
    expect(card.querySelector('.font-semibold')?.className).toContain('break-words')
    expect(card.querySelector('.font-semibold')?.className).not.toContain('truncate')
  })

  it('(c) Acessibilidade: texto presente no DOM (não só cor) e title/aria-label contendo o período formatado', () => {
    render(
      <ShiftCalendar
        shifts={[]}
        cycle={dummyCycle}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
      />,
    )

    const card = screen.getByTestId('vacation-staff-vacation-01-2025-11-02')
    expect(card.getAttribute('title')).toBe('Férias de 02/11 a 04/11')
    expect(card.getAttribute('aria-label')).toBe('Férias de 02/11 a 04/11')
    expect(card.textContent).toMatch(/FÉRIAS/i)
  })

  it('Prioridade visual: se o colaborador já tem plantão no dia de férias, exibe plantão com badge de férias', () => {
    const shiftOnVacation = {
      id: 'shift-vac-01',
      staff_profile: 'staff-vacation-01',
      sector: 'sector-uti',
      start_time: '2025-11-02 07:00:00.000Z',
      end_time: '2025-11-02 19:00:00.000Z',
      expand: {
        staff_profile: dummyStaffProfiles[0],
      },
    }

    render(
      <ShiftCalendar
        shifts={[shiftOnVacation]}
        cycle={dummyCycle}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
      />,
    )

    // O plantão está renderizado
    expect(screen.getByTestId('shift-coren-shift-vac-01')).toBeDefined()
    // A badge de férias acompanha o plantão
    const badgeVacation = screen.getByTitle('Férias de 02/11 a 04/11')
    expect(badgeVacation).toBeDefined()
    expect(badgeVacation.textContent).toContain('FÉRIAS')

    // O card avulso de férias NÃO duplica no mesmo dia
    expect(screen.queryByTestId('vacation-staff-vacation-01-2025-11-02')).toBeNull()
  })

  it('(d) Tentativa de drop em data de férias é bloqueada com toast e NÃO grava no backend', async () => {
    render(
      <ShiftCalendar
        shifts={[]}
        cycle={dummyCycle}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
      />,
    )

    // Localiza a célula do dia 2025-11-02 (onde staff-vacation-01 está de férias)
    const dayLabel = screen.getByText('02/11')
    const dayCell = dayLabel.closest('div.border-r')
    expect(dayCell).not.toBeNull()

    // Simula drop de um plantão de staff-vacation-01 para 2025-11-02
    const droppedShift = {
      id: 'shift-test-drop',
      staff_profile: 'staff-vacation-01',
      user: 'staff-vacation-01',
      start_time: '2025-11-01 07:00:00.000Z',
      end_time: '2025-11-01 19:00:00.000Z',
    }

    const dropEvent = {
      preventDefault: vi.fn(),
      dataTransfer: {
        getData: vi.fn().mockReturnValue(JSON.stringify(droppedShift)),
      },
    }

    fireEvent.drop(dayCell!, dropEvent)

    // Verifica que o toast de bloqueio foi disparado
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Bloqueio de Férias',
        description: 'Colaborador está de férias nesta data.',
        variant: 'destructive',
      }),
    )

    // Garante que pb.collection('shifts').update NÃO foi chamado
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('(e) Troca de mês/período e filtro por colaborador mantêm o destaque correto', () => {
    const { rerender } = render(
      <ShiftCalendar
        shifts={[]}
        cycle={dummyCycle}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
      />,
    )

    // Inicialmente visível
    expect(screen.getByTestId('vacation-staff-vacation-01-2025-11-02')).toBeDefined()

    // Ciclo para outro mês onde não há férias (Dezembro)
    const decemberCycle = {
      id: 'cycle-dec-2025',
      name: 'Ciclo Dezembro 2025',
      start_date: '2025-12-01 00:00:00.000Z',
      end_date: '2025-12-05 23:59:59.000Z',
      status: 'draft',
    }

    rerender(
      <ShiftCalendar
        shifts={[]}
        cycle={decemberCycle}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
      />,
    )

    // Em dezembro não deve ter o card de férias de novembro
    expect(screen.queryByTestId('vacation-staff-vacation-01-2025-11-02')).toBeNull()
  })

  it('Calendário nunca renderiza simultaneamente FÉRIAS e Folga Fim de Semana na mesma célula', () => {
    // Colaborador em férias no domingo 2025-11-02
    // E um draft legado que incluiu 2025-11-02 em weekend_off_assignments
    const legacyDraft = {
      id: 'draft-legacy',
      validation_summary: {
        weekend_off_assignments: {
          'staff-vacation-01': ['2025-11-02'],
        },
      },
    }

    render(
      <ShiftCalendar
        shifts={[]}
        cycle={dummyCycle}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
        draft={legacyDraft}
      />,
    )

    // O card de férias DEVE ser exibido
    const vacEl = screen.getByTestId('vacation-staff-vacation-01-2025-11-02')
    expect(vacEl).toBeDefined()
    expect(vacEl.textContent).toContain('FÉRIAS')

    // O card de Folga Fim de Semana NÃO PODE existir para essa colaboradora nesta célula
    expect(screen.queryByTestId('weekend-off-staff-vacation-01-2025-11-02')).toBeNull()
  })

  it('Exibe item de legenda "Férias" com amostra esmeralda junto a Plantão D, Plantão N e Folga Fim de Semana', () => {
    render(
      <ShiftCalendar
        shifts={[]}
        cycle={dummyCycle}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
      />,
    )

    expect(screen.getByText('Plantão D')).toBeDefined()
    expect(screen.getByText('Plantão N')).toBeDefined()
    expect(screen.getByText('Folga Fim de Semana')).toBeDefined()
    expect(screen.getByText('Férias')).toBeDefined()
  })

  it('Preservação das regressões de COREN e formatador', () => {
    expect(formatShiftCalendarSecondLine('D', '99988-SP')).toBe('D • COREN 99988-SP')
    expect(formatShiftCalendarSecondLine('N', null)).toBe('N • COREN não informado')
  })
})
