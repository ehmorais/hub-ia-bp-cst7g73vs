import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { StaffProfiles } from '@/components/escala/StaffProfiles'
import * as escalaService from '@/services/escala'

const mockToast = vi.fn()
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

// Mock realtime hook to capture listeners
let realtimeCallbackMap: Record<string, () => void> = {}
vi.mock('@/hooks/use-realtime', () => ({
  useRealtime: (collection: string, callback: () => void) => {
    realtimeCallbackMap[collection] = callback
  },
}))

vi.mock('@/services/escala', () => ({
  getStaffProfiles: vi.fn(),
  getAllStaffProfilesPaginated: vi.fn(),
  getStaffRoles: vi.fn(),
  getHospitalSectors: vi.fn(),
  getShiftRules: vi.fn(),
  getStaffContracts: vi.fn(),
  getShiftTypes: vi.fn(),
  getShiftCycles: vi.fn(),
  createStaffProfile: vi.fn(),
  updateStaffProfile: vi.fn(),
  deleteStaffProfile: vi.fn(),
  createStaffContract: vi.fn(),
  updateStaffContract: vi.fn(),
}))

vi.mock('@/lib/pocketbase/client', () => ({
  pb: {
    collection: () => ({
      getFullList: vi.fn().mockResolvedValue([]),
      getList: vi.fn().mockResolvedValue({ items: [], totalPages: 1, totalItems: 0 }),
    }),
  },
}))

describe('StaffProfiles - Contador total ao lado do título', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    realtimeCallbackMap = {}

    vi.mocked(escalaService.getHospitalSectors).mockResolvedValue([
      { id: 'sec-1', name: 'UTI Geral' } as any,
    ])
    vi.mocked(escalaService.getStaffRoles).mockResolvedValue([
      { id: 'role-1', name: 'Enfermeiro(a)' } as any,
    ])
    vi.mocked(escalaService.getShiftRules).mockResolvedValue([])
    vi.mocked(escalaService.getStaffContracts).mockResolvedValue([])
    vi.mocked(escalaService.getShiftTypes).mockResolvedValue([])
    vi.mocked(escalaService.getShiftCycles).mockResolvedValue([])
  })

  it('1. Mostra logo ao lado do título a quantidade total de cadastros no formato exato "X Colaboradores"', async () => {
    // 183 colaboradores reais paginados
    const mockAllProfiles = Array.from({ length: 183 }, (_, i) => ({
      id: `prof-${i + 1}`,
      name: `Colaborador ${i + 1}`,
      professional_id: `CRM-${i + 1}`,
      active: true,
      shift_parity: i % 2 === 0 ? 'even' : 'odd',
    }))

    vi.mocked(escalaService.getAllStaffProfilesPaginated).mockResolvedValue(mockAllProfiles as any)
    vi.mocked(escalaService.getStaffProfiles).mockResolvedValue(mockAllProfiles.slice(0, 50) as any)

    render(<StaffProfiles />)

    await waitFor(() => {
      const title = screen.getByText('Cadastro de Colaboradores')
      expect(title).toBeDefined()
      const badge = screen.getByTestId('collaborators-total-badge')
      expect(badge).toBeDefined()
      expect(badge.textContent).toBe('183 Colaboradores')
    })
  })

  it('2. O total é o número REAL de TODOS os colaboradores do banco (todas as páginas) e NÃO é afetado por filtros de busca', async () => {
    const mockAllProfiles = [
      { id: 'p1', name: 'Ana Souza', professional_id: '111', active: true, shift_parity: 'even' },
      { id: 'p2', name: 'Bruno Lima', professional_id: '222', active: true, shift_parity: 'odd' },
      {
        id: 'p3',
        name: 'Carlos Prado',
        professional_id: '333',
        active: true,
        shift_parity: 'even',
      },
      {
        id: 'p4',
        name: 'Daniela Alves',
        professional_id: '444',
        active: true,
        shift_parity: 'odd',
      },
      {
        id: 'p5',
        name: 'Eduardo Ramos',
        professional_id: '555',
        active: true,
        shift_parity: 'even',
      },
    ]

    vi.mocked(escalaService.getAllStaffProfilesPaginated).mockResolvedValue(mockAllProfiles as any)
    vi.mocked(escalaService.getStaffProfiles).mockResolvedValue(mockAllProfiles as any)

    render(<StaffProfiles />)

    await waitFor(() => {
      expect(screen.getByText('5 Colaboradores')).toBeDefined()
      expect(screen.getByText('Ana Souza')).toBeDefined()
      expect(screen.getByText('Bruno Lima')).toBeDefined()
    })

    // Usuário digita filtro de busca que só coincide com 'Daniela'
    const searchInput = screen.getByPlaceholderText('Buscar por nome, registro, cargo ou setor...')
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(searchInput, { target: { value: 'Daniela' } })

    // A tabela filtra e mostra apenas Daniela Alves
    await waitFor(() => {
      expect(screen.getByText('Daniela Alves')).toBeDefined()
      expect(screen.queryByText('Ana Souza')).toBeNull()
      expect(screen.queryByText('Bruno Lima')).toBeNull()
    })

    // O contador no título continua mostrando o total absoluto (5 Colaboradores), não 1
    const badge = screen.getByTestId('collaborators-total-badge')
    expect(badge.textContent).toBe('5 Colaboradores')
  })

  it('3. Atualiza a contagem automaticamente via realtime hook após mudanças em staff_profiles', async () => {
    const initialProfiles = [
      { id: 'p1', name: 'Ana Souza', active: true, shift_parity: 'even' },
      { id: 'p2', name: 'Bruno Lima', active: true, shift_parity: 'odd' },
    ]

    vi.mocked(escalaService.getAllStaffProfilesPaginated).mockResolvedValueOnce(
      initialProfiles as any,
    )
    vi.mocked(escalaService.getStaffProfiles).mockResolvedValueOnce(initialProfiles as any)

    render(<StaffProfiles />)

    await waitFor(() => {
      expect(screen.getByText('2 Colaboradores')).toBeDefined()
    })

    // Simula inclusão de novo colaborador (ex.: 3 no banco)
    const updatedProfiles = [
      ...initialProfiles,
      { id: 'p3', name: 'Carlos Prado', active: true, shift_parity: 'even' },
    ]
    vi.mocked(escalaService.getAllStaffProfilesPaginated).mockResolvedValueOnce(
      updatedProfiles as any,
    )
    vi.mocked(escalaService.getStaffProfiles).mockResolvedValueOnce(updatedProfiles as any)

    // Dispara realtime de staff_profiles
    expect(realtimeCallbackMap['staff_profiles']).toBeDefined()
    realtimeCallbackMap['staff_profiles']()

    await waitFor(() => {
      expect(screen.getByText('3 Colaboradores')).toBeDefined()
    })
  })

  it('4. Atualiza a contagem após exclusão de colaborador', async () => {
    const initialProfiles = [
      { id: 'p1', name: 'Ana Souza', active: true, shift_parity: 'even' },
      { id: 'p2', name: 'Bruno Lima', active: true, shift_parity: 'odd' },
    ]

    vi.mocked(escalaService.getAllStaffProfilesPaginated).mockResolvedValueOnce(
      initialProfiles as any,
    )
    vi.mocked(escalaService.getStaffProfiles).mockResolvedValueOnce(initialProfiles as any)

    render(<StaffProfiles />)

    await waitFor(() => {
      expect(screen.getByText('2 Colaboradores')).toBeDefined()
    })

    // Simula exclusão de colaborador (resta 1)
    const afterDeleteProfiles = [
      { id: 'p1', name: 'Ana Souza', active: true, shift_parity: 'even' },
    ]
    vi.mocked(escalaService.getAllStaffProfilesPaginated).mockResolvedValueOnce(
      afterDeleteProfiles as any,
    )
    vi.mocked(escalaService.getStaffProfiles).mockResolvedValueOnce(afterDeleteProfiles as any)
    vi.mocked(escalaService.deleteStaffProfile).mockResolvedValueOnce(true as any)

    // Dispara handleDelete ou realtime de staff_profiles
    realtimeCallbackMap['staff_profiles']()

    await waitFor(() => {
      expect(screen.getByText('1 Colaboradores')).toBeDefined()
    })
  })
})
