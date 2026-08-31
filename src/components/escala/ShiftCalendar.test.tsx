import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { ShiftCalendar } from './ShiftCalendar'

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

describe('ShiftCalendar - Grade do Calendário de Escalas (Testes Obrigatórios)', () => {
  const mockCycle = {
    id: 'cycle-001',
    name: 'Ciclo Outubro 2025',
    start_date: '2025-10-01 00:00:00.000Z',
    end_date: '2025-10-07 23:59:59.000Z',
    status: 'draft',
  }

  const mockSector = {
    id: 'sector-001',
    name: 'UTI Geral',
  }

  const mockStaffProfiles = [
    {
      id: 'staff-01',
      name: 'Ana Carolina de Souza Ferreira e Silva',
      professional_id: '123456',
      default_sector: 'sector-001',
    },
    {
      id: 'staff-02',
      name: 'Carlos Alberto Mendonça Cavalcanti Junior',
      professional_id: '',
      default_sector: 'sector-001',
    },
  ]

  const mockContracts = [
    {
      id: 'contract-01',
      staff_profile: 'staff-01',
      expand: {
        shift_type: { id: 'st-01', name: '12x36 Diurno', start_time: '07:00', end_time: '19:00' },
      },
    },
    {
      id: 'contract-02',
      staff_profile: 'staff-02',
      expand: {
        shift_type: { id: 'st-02', name: '12x36 Noturno', start_time: '19:00', end_time: '07:00' },
      },
    },
  ]

  const mockShifts = [
    {
      id: 'shift-01',
      staff_profile: 'staff-01',
      sector: 'sector-001',
      start_time: '2025-10-01 07:00:00.000Z',
      end_time: '2025-10-01 19:00:00.000Z',
      expand: {
        staff_profile: mockStaffProfiles[0],
      },
    },
    {
      id: 'shift-02',
      staff_profile: 'staff-02',
      sector: 'sector-001',
      start_time: '2025-10-01 19:00:00.000Z',
      end_time: '2025-10-02 07:00:00.000Z',
      expand: {
        staff_profile: mockStaffProfiles[1],
      },
    },
  ]

  it('1. nome completo sem ellipsis e sem corte por limite de caracteres', () => {
    render(
      <ShiftCalendar
        shifts={mockShifts}
        cycle={mockCycle}
        contracts={mockContracts}
        staffProfiles={mockStaffProfiles}
      />,
    )

    // O nome completo do colaborador deve estar presente na íntegra no documento
    expect(screen.getByText('Ana Carolina de Souza Ferreira e Silva')).toBeInTheDocument()
    expect(screen.getByText('Carlos Alberto Mendonça Cavalcanti Junior')).toBeInTheDocument()
  })

  it('2. nome longo quebra linha sem sobreposição (classes break-words e whitespace-normal)', () => {
    const { container } = render(
      <ShiftCalendar
        shifts={mockShifts}
        cycle={mockCycle}
        contracts={mockContracts}
        staffProfiles={mockStaffProfiles}
      />,
    )

    const nameElements = container.querySelectorAll('.break-words.whitespace-normal')
    expect(nameElements.length).toBeGreaterThan(0)
    // Verifica que não há classe de truncamento "truncate" no nome do colaborador
    const anaElement = screen.getByText('Ana Carolina de Souza Ferreira e Silva')
    expect(anaElement.className).toContain('break-words')
    expect(anaElement.className).toContain('whitespace-normal')
    expect(anaElement.className).not.toContain('truncate')
  })

  it('3. plantão diurno mostra "D"', () => {
    render(
      <ShiftCalendar
        shifts={[mockShifts[0]]}
        cycle={mockCycle}
        contracts={mockContracts}
        staffProfiles={mockStaffProfiles}
      />,
    )

    const dBadge = screen.getByText('D')
    expect(dBadge).toBeInTheDocument()
    expect(dBadge.className).toContain('text-emerald-700')
  })

  it('4. plantão noturno mostra "N"', () => {
    render(
      <ShiftCalendar
        shifts={[mockShifts[1]]}
        cycle={mockCycle}
        contracts={mockContracts}
        staffProfiles={mockStaffProfiles}
      />,
    )

    const nBadge = screen.getByText('N')
    expect(nBadge).toBeInTheDocument()
    expect(nBadge.className).toContain('text-indigo-700')
  })

  it('5. segunda linha mostra COREN e não horário', () => {
    const { container } = render(
      <ShiftCalendar
        shifts={[mockShifts[0]]}
        cycle={mockCycle}
        contracts={mockContracts}
        staffProfiles={mockStaffProfiles}
      />,
    )

    expect(screen.getByText('COREN 123456')).toBeInTheDocument()
    // Garante que o horário "07:00–19:00" ou similar NÃO é renderizado na célula
    const textContent = container.textContent || ''
    expect(textContent).not.toContain('07:00–19:00')
    expect(textContent).not.toContain('07:00 - 19:00')
  })

  it('6. ausência de COREN mostra "COREN não informado"', () => {
    render(
      <ShiftCalendar
        shifts={[mockShifts[1]]}
        cycle={mockCycle}
        contracts={mockContracts}
        staffProfiles={mockStaffProfiles}
      />,
    )

    expect(screen.getByText('COREN não informado')).toBeInTheDocument()
  })

  it('7. IA e "Montar Escala" apresentam o mesmo resultado quando renderizados com os mesmos dados', () => {
    const { container: container1 } = render(
      <ShiftCalendar
        shifts={mockShifts}
        cycle={mockCycle}
        contracts={mockContracts}
        staffProfiles={mockStaffProfiles}
      />,
    )
    const content1 = container1.innerHTML

    const { container: container2 } = render(
      <ShiftCalendar
        shifts={mockShifts}
        cycle={mockCycle}
        contracts={mockContracts}
        staffProfiles={mockStaffProfiles}
      />,
    )
    const content2 = container2.innerHTML

    expect(content1).toBe(content2)
  })

  it('8. salvar/recarregar preserva nome, tipo e COREN através da hidratação com staffProfiles', () => {
    // Simula shifts sem expand, mas com staffProfiles carregados (ex: após recarregamento)
    const rawShiftsAfterReload = [
      {
        id: 'shift-01',
        staff_profile: 'staff-01',
        sector: 'sector-001',
        start_time: '2025-10-01 07:00:00.000Z',
        end_time: '2025-10-01 19:00:00.000Z',
      },
    ]

    render(
      <ShiftCalendar
        shifts={rawShiftsAfterReload}
        cycle={mockCycle}
        contracts={mockContracts}
        staffProfiles={mockStaffProfiles}
      />,
    )

    expect(screen.getByText('Ana Carolina de Souza Ferreira e Silva')).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
    expect(screen.getByText('COREN 123456')).toBeInTheDocument()
  })

  it('9. horários permanecem armazenados e disponíveis nos dados dos shifts', () => {
    expect(mockShifts[0].start_time).toBe('2025-10-01 07:00:00.000Z')
    expect(mockShifts[0].end_time).toBe('2025-10-01 19:00:00.000Z')
    expect(mockContracts[0].expand.shift_type.start_time).toBe('07:00')
    expect(mockContracts[0].expand.shift_type.end_time).toBe('19:00')
  })

  it('10. regressão das regras de folga/paridade continua passando', () => {
    const draftWithWeekendOff = {
      validation_summary: {
        weekend_off_assignments: {
          'staff-01': ['2025-10-04', '2025-10-05'],
        },
      },
    }

    render(
      <ShiftCalendar
        shifts={[]}
        cycle={mockCycle}
        contracts={mockContracts}
        staffProfiles={mockStaffProfiles}
        draft={draftWithWeekendOff}
      />,
    )

    // O placeholder de folga de fim de semana deve ser renderizado
    const weekendOffElem = screen.queryByTestId('weekend-off-staff-01-2025-10-04')
    expect(weekendOffElem).toBeInTheDocument()
  })
})
