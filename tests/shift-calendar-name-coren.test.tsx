import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { ShiftCalendar } from '@/components/escala/ShiftCalendar'

// Mock PocketBase client
vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    collection: () => ({
      getFullList: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    }),
  },
}))

// Mock realtime hook
vi.mock('@/hooks/use-realtime', () => ({
  useRealtime: vi.fn(),
}))

describe('ShiftCalendar - Nome Completo e COREN (Etapa 1 de 2)', () => {
  const dummyCycle = {
    id: 'cycle-ficticio-001',
    name: 'Ciclo Fictício Novembro 2025',
    start_date: '2025-11-01 00:00:00.000Z',
    end_date: '2025-11-07 23:59:59.000Z',
    status: 'draft',
  }

  const dummyStaffProfiles = [
    {
      id: 'dummy-prof-01',
      name: 'Maria Helena de Medeiros Albuquerque de Oliveira',
      professional_id: '987654',
      default_sector: 'sector-dummy-01',
    },
    {
      id: 'dummy-prof-02',
      name: 'João Pedro de Vasconcelos Albuquerque Maranhão Filho',
      professional_id: '',
      default_sector: 'sector-dummy-01',
    },
  ]

  const dummyContracts = [
    {
      id: 'contract-dummy-01',
      staff_profile: 'dummy-prof-01',
      expand: {
        shift_type: { id: 'st-d', name: '12x36 Diurno', start_time: '07:00', end_time: '19:00' },
      },
    },
    {
      id: 'contract-dummy-02',
      staff_profile: 'dummy-prof-02',
      expand: {
        shift_type: { id: 'st-n', name: '12x36 Noturno', start_time: '19:00', end_time: '07:00' },
      },
    },
  ]

  const dummyShifts = [
    {
      id: 'shift-dummy-01',
      staff_profile: 'dummy-prof-01',
      sector: 'sector-dummy-01',
      start_time: '2025-11-01 07:00:00.000Z',
      end_time: '2025-11-01 19:00:00.000Z',
      expand: {
        staff_profile: dummyStaffProfiles[0],
      },
    },
    {
      id: 'shift-dummy-02',
      staff_profile: 'dummy-prof-02',
      sector: 'sector-dummy-01',
      start_time: '2025-11-01 19:00:00.000Z',
      end_time: '2025-11-02 07:00:00.000Z',
      expand: {
        staff_profile: dummyStaffProfiles[1],
      },
    },
  ]

  it('1. nome completo sem ellipsis nem corte de caracteres', () => {
    render(
      <ShiftCalendar
        shifts={dummyShifts}
        cycle={dummyCycle}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
      />,
    )

    const nameElem1 = screen.getByText('Maria Helena de Medeiros Albuquerque de Oliveira')
    const nameElem2 = screen.getByText('João Pedro de Vasconcelos Albuquerque Maranhão Filho')
    expect(nameElem1).toBeInTheDocument()
    expect(nameElem2).toBeInTheDocument()
    expect(nameElem1.className).not.toContain('truncate')
    expect(nameElem2.className).not.toContain('truncate')
  })

  it('2. nome longo quebra linha sem sobreposição (break-words e whitespace-normal)', () => {
    const { container } = render(
      <ShiftCalendar
        shifts={dummyShifts}
        cycle={dummyCycle}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
      />,
    )

    const nameElem = screen.getByText('Maria Helena de Medeiros Albuquerque de Oliveira')
    expect(nameElem.className).toContain('break-words')
    expect(nameElem.className).toContain('whitespace-normal')

    const matchingContainers = container.querySelectorAll('.break-words.whitespace-normal')
    expect(matchingContainers.length).toBeGreaterThanOrEqual(2)
  })

  it('3. plantão diurno mostra "D" + COREN', () => {
    render(
      <ShiftCalendar
        shifts={[dummyShifts[0]]}
        cycle={dummyCycle}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
      />,
    )

    const periodD = screen.getByText('D')
    expect(periodD).toBeInTheDocument()
    expect(periodD.className).toContain('text-emerald-700')

    const corenElem = screen.getByTestId('shift-coren-shift-dummy-01')
    expect(corenElem).toHaveTextContent('COREN 987654')
  })

  it('4. plantão noturno mostra "N" + COREN (ou fallback se vazio)', () => {
    render(
      <ShiftCalendar
        shifts={[dummyShifts[1]]}
        cycle={dummyCycle}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
      />,
    )

    const periodN = screen.getByText('N')
    expect(periodN).toBeInTheDocument()
    expect(periodN.className).toContain('text-indigo-700')
  })

  it('5. fallback sem COREN mostra "COREN não informado"', () => {
    render(
      <ShiftCalendar
        shifts={[dummyShifts[1]]}
        cycle={dummyCycle}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
      />,
    )

    const corenElem = screen.getByTestId('shift-coren-shift-dummy-02')
    expect(corenElem).toHaveTextContent('COREN não informado')
  })

  it('6. horário não aparece na segunda linha, mas start_time/end_time permanecem no objeto de dados', () => {
    const { container } = render(
      <ShiftCalendar
        shifts={dummyShifts}
        cycle={dummyCycle}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
      />,
    )

    const textContent = container.textContent || ''
    // Verifica que formatos clássicos de horário não estão sendo renderizados na célula
    expect(textContent).not.toContain('07:00 - 19:00')
    expect(textContent).not.toContain('07:00–19:00')
    expect(textContent).not.toContain('19:00 - 07:00')
    expect(textContent).not.toContain('19:00–07:00')

    // Preserva no objeto de dados
    expect(dummyShifts[0].start_time).toBe('2025-11-01 07:00:00.000Z')
    expect(dummyShifts[0].end_time).toBe('2025-11-01 19:00:00.000Z')
    expect(dummyShifts[1].start_time).toBe('2025-11-01 19:00:00.000Z')
    expect(dummyShifts[1].end_time).toBe('2025-11-02 07:00:00.000Z')
  })

  it('7. regressão: as regras de folga/paridade da v0.0.276 continuam passando', () => {
    const draftWithWeekendOff = {
      validation_summary: {
        weekend_off_assignments: {
          'dummy-prof-01': ['2025-11-01', '2025-11-02'],
        },
      },
    }

    render(
      <ShiftCalendar
        shifts={[]}
        cycle={dummyCycle}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
        draft={draftWithWeekendOff}
      />,
    )

    // Sábado 2025-11-01 é fim de semana, deve ter placeholder se não houver shift
    const weekendOffElem = screen.queryByTestId('weekend-off-dummy-prof-01-2025-11-01')
    expect(weekendOffElem).toBeInTheDocument()
    expect(weekendOffElem).toHaveTextContent('Maria Helena de Medeiros Albuquerque de Oliveira')
    expect(weekendOffElem).toHaveTextContent('Folga Fim de Semana')
  })
})
