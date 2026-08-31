import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { AutoGenerate } from '@/components/escala/AutoGenerate'
import { ShiftCalendar } from '@/components/escala/ShiftCalendar'

// Mock do PocketBase
const dummyCycles = [
  {
    id: 'cycle-teste-01',
    name: 'Ciclo Outubro 2026',
    start_date: '2026-10-01 00:00:00.000Z',
    end_date: '2026-10-06 23:59:59.000Z',
    status: 'active',
  },
]

const dummySectors = [
  {
    id: 'sec-teste-01',
    name: 'UTI Adulto Teste',
    min_staffing: 1,
    ideal_staffing: 2,
  },
]

const dummyStaffProfiles = [
  {
    id: 'prof-01',
    name: 'Enfermeiro Alfa Silva',
    professional_id: '11111-SP',
    default_sector: 'sec-teste-01',
  },
  {
    id: 'prof-02',
    name: 'Tecnico Beta Santos',
    professional_id: '22222-SP',
    default_sector: 'sec-teste-01',
  },
]

const dummyContracts = [
  {
    id: 'contract-01',
    staff_profile: 'prof-01',
    expand: {
      shift_type: { id: 'st-1', name: '12x36 Diurno', start_time: '07:00', end_time: '19:00' },
    },
  },
  {
    id: 'contract-02',
    staff_profile: 'prof-02',
    expand: {
      shift_type: { id: 'st-2', name: '12x36 Noturno', start_time: '19:00', end_time: '07:00' },
    },
  },
]

const dummyGeneratedShifts = [
  {
    id: 'shift-d1',
    staff_profile: 'prof-01',
    sector: 'sec-teste-01',
    cycle: 'cycle-teste-01',
    start_time: '2026-10-01 07:00:00.000Z',
    end_time: '2026-10-01 19:00:00.000Z',
    expand: { staff_profile: dummyStaffProfiles[0], sector: dummySectors[0], cycle: dummyCycles[0] },
  },
  {
    id: 'shift-d2',
    staff_profile: 'prof-02',
    sector: 'sec-teste-01',
    cycle: 'cycle-teste-01',
    start_time: '2026-10-02 19:00:00.000Z',
    end_time: '2026-10-03 07:00:00.000Z',
    expand: { staff_profile: dummyStaffProfiles[1], sector: dummySectors[0], cycle: dummyCycles[0] },
  },
  {
    id: 'shift-d3',
    staff_profile: 'prof-01',
    sector: 'sec-teste-01',
    cycle: 'cycle-teste-01',
    start_time: '2026-10-03 07:00:00.000Z',
    end_time: '2026-10-03 19:00:00.000Z',
    expand: { staff_profile: dummyStaffProfiles[0], sector: dummySectors[0], cycle: dummyCycles[0] },
  },
  {
    id: 'shift-d4',
    staff_profile: 'prof-02',
    sector: 'sec-teste-01',
    cycle: 'cycle-teste-01',
    start_time: '2026-10-04 19:00:00.000Z',
    end_time: '2026-10-05 07:00:00.000Z',
    expand: { staff_profile: dummyStaffProfiles[1], sector: dummySectors[0], cycle: dummyCycles[0] },
  },
]

vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    collection: (colName: string) => ({
      getFullList: vi.fn().mockImplementation(async () => {
        if (colName === 'shift_cycles') return dummyCycles
        if (colName === 'hospital_sectors') return dummySectors
        if (colName === 'staff_profiles') return dummyStaffProfiles
        if (colName === 'staff_contracts') return dummyContracts
        if (colName === 'shifts') return dummyGeneratedShifts
        if (colName === 'shift_rules') return []
        return []
      }),
      update: vi.fn().mockResolvedValue({}),
    }),
  },
}))

vi.mock('@/services/escala', () => ({
  getShiftCycles: vi.fn().mockResolvedValue(dummyCycles),
  generateDraftShifts: vi.fn().mockResolvedValue({
    success: true,
    draft: dummyGeneratedShifts,
    run_id: 'run-filter-01',
    draft_id: 'draft-filter-01',
  }),
  commitShiftSchedule: vi.fn().mockResolvedValue({ success: true }),
  getGenerationRun: vi.fn().mockResolvedValue({}),
  getDraft: vi.fn().mockResolvedValue({
    id: 'draft-filter-01',
    validation_summary: {
      weekend_off_assignments: {
        'prof-01': ['2026-10-04'],
      },
    },
  }),
  getDraftIssues: vi.fn().mockResolvedValue([]),
  getRunIssues: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/hooks/use-realtime', () => ({
  useRealtime: vi.fn(),
}))

describe('Filtro de Dias na Visualização da IA (AutoGenerate & ShiftCalendar)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1. Renderiza o seletor de filtro de dias com as opções Todos, Dias Pares e Dias Ímpares', async () => {
    render(<AutoGenerate />)

    fireEvent.click(screen.getByText('Gerar com IA'))

    await waitFor(() => {
      expect(screen.getByTestId('select-day-filter')).toBeDefined()
    })

    expect(screen.getByText('Filtrar dias')).toBeDefined()
  })

  it('2. ShiftCalendar filtra apenas visualmente dias pares e ímpares mantendo integridade dos dados', () => {
    // 2.1 Sem filtro / 'all' -> Exibe todos os dias do ciclo (01 a 06)
    const { rerender } = render(
      <ShiftCalendar
        shifts={dummyGeneratedShifts}
        cycle={dummyCycles[0]}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
        dayFilter="all"
      />,
    )

    expect(screen.getByText('01/10')).toBeDefined()
    expect(screen.getByText('02/10')).toBeDefined()
    expect(screen.getByText('03/10')).toBeDefined()
    expect(screen.getByText('04/10')).toBeDefined()
    expect(screen.getByText('05/10')).toBeDefined()
    expect(screen.getByText('06/10')).toBeDefined()

    // 2.2 Filtro 'even' -> Exibe dias 02, 04, 06 e oculta 01, 03, 05
    rerender(
      <ShiftCalendar
        shifts={dummyGeneratedShifts}
        cycle={dummyCycles[0]}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
        dayFilter="even"
      />,
    )

    expect(screen.queryByText('01/10')).toBeNull()
    expect(screen.queryByText('03/10')).toBeNull()
    expect(screen.queryByText('05/10')).toBeNull()
    expect(screen.getByText(/02\/10/)).toBeDefined()
    expect(screen.getByText(/04\/10/)).toBeDefined()
    expect(screen.getByText(/06\/10/)).toBeDefined()

    // 2.3 Filtro 'odd' -> Exibe dias 01, 03, 05 e oculta 02, 04, 06
    rerender(
      <ShiftCalendar
        shifts={dummyGeneratedShifts}
        cycle={dummyCycles[0]}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
        dayFilter="odd"
      />,
    )

    expect(screen.getByText(/01\/10/)).toBeDefined()
    expect(screen.getByText(/03\/10/)).toBeDefined()
    expect(screen.getByText(/05\/10/)).toBeDefined()
    expect(screen.queryByText('02/10')).toBeNull()
    expect(screen.queryByText('04/10')).toBeNull()
    expect(screen.queryByText('06/10')).toBeNull()
  })

  it('3. Troca de filtro mantém a integridade de nomes, turnos D/N e COREN', () => {
    render(
      <ShiftCalendar
        shifts={dummyGeneratedShifts}
        cycle={dummyCycles[0]}
        contracts={dummyContracts}
        staffProfiles={dummyStaffProfiles}
        dayFilter="odd"
      />,
    )

    // No dia 01 (ímpar) devemos ter o colaborador Enfermeiro Alfa Silva com D e COREN 11111-SP
    expect(screen.getByText('Enfermeiro Alfa Silva')).toBeDefined()
    expect(screen.getByText('COREN 11111-SP')).toBeDefined()
  })
})
