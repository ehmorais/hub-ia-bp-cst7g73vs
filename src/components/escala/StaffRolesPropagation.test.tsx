import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { StaffProfiles } from '@/components/escala/StaffProfiles'
import * as escalaService from '@/services/escala'

const mockToast = vi.fn()
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

// Mock realtime hook to allow triggering callback
let realtimeCallbackMap: Record<string, () => void> = {}
vi.mock('@/hooks/use-realtime', () => ({
  useRealtime: (collection: string, callback: () => void) => {
    realtimeCallbackMap[collection] = callback
  },
}))

vi.mock('@/services/escala', () => ({
  getStaffProfiles: vi.fn(),
  getStaffRoles: vi.fn(),
  getHospitalSectors: vi.fn(),
  getShiftRules: vi.fn(),
  getStaffContracts: vi.fn(),
  createStaffProfile: vi.fn(),
  updateStaffProfile: vi.fn(),
  deleteStaffProfile: vi.fn(),
  updateStaffContractsForProfile: vi.fn(),
}))

vi.mock('@/lib/pocketbase/client', () => ({
  pb: {
    collection: () => ({
      getFullList: vi.fn().mockResolvedValue([]),
    }),
  },
}))

describe('StaffRoles - Propagação da alteração do nome da função nas telas dependentes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    realtimeCallbackMap = {}

    vi.mocked(escalaService.getHospitalSectors).mockResolvedValue([
      { id: 'sec-1', name: 'UTI Geral' } as any,
    ])
    vi.mocked(escalaService.getShiftRules).mockResolvedValue([])
    vi.mocked(escalaService.getStaffContracts).mockResolvedValue([])
  })

  it('Propaga novo nome de função em StaffProfiles quando ocorre evento de realtime de staff_roles', async () => {
    // Inicialmente a função é "Enfermeiro Júnior"
    vi.mocked(escalaService.getStaffRoles).mockResolvedValueOnce([
      {
        id: 'role-1',
        name: 'Enfermeiro Júnior',
        hierarchy_rank: 10,
        requires_supervision: false,
      } as any,
    ])

    vi.mocked(escalaService.getStaffProfiles).mockResolvedValueOnce([
      {
        id: 'prof-1',
        name: 'Carlos Silva',
        email: 'carlos@exemplo.com',
        phone: '11999998888',
        professional_id: '123456',
        active: true,
        staff_role: 'role-1',
        expand: {
          staff_role: { id: 'role-1', name: 'Enfermeiro Júnior' },
        },
      } as any,
    ])

    const { rerender } = render(<StaffProfiles />)

    await waitFor(() => {
      expect(screen.getByText('Carlos Silva')).toBeDefined()
      expect(screen.getByText('Enfermeiro Júnior')).toBeDefined()
    })

    // Agora o nome da função foi editado no mesmo registro (id 'role-1') para "Enfermeiro Pleno"
    vi.mocked(escalaService.getStaffRoles).mockResolvedValueOnce([
      {
        id: 'role-1',
        name: 'Enfermeiro Pleno',
        hierarchy_rank: 10,
        requires_supervision: false,
      } as any,
    ])

    vi.mocked(escalaService.getStaffProfiles).mockResolvedValueOnce([
      {
        id: 'prof-1',
        name: 'Carlos Silva',
        email: 'carlos@exemplo.com',
        phone: '11999998888',
        professional_id: '123456',
        active: true,
        staff_role: 'role-1',
        expand: {
          staff_role: { id: 'role-1', name: 'Enfermeiro Pleno' },
        },
      } as any,
    ])

    // Dispara o callback do realtime registrado para 'staff_roles'
    expect(realtimeCallbackMap['staff_roles']).toBeDefined()
    realtimeCallbackMap['staff_roles']()

    // O novo nome deve ser refletido na tela sem recarregamento manual da página
    await waitFor(() => {
      expect(screen.getByText('Enfermeiro Pleno')).toBeDefined()
      expect(screen.queryByText('Enfermeiro Júnior')).toBeNull()
    })
  })
})
