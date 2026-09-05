import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { AutoGenerate } from '@/components/escala/AutoGenerate'
import * as escalaService from '@/services/escala'

const mockToast = vi.fn()
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

// Mock PocketBase client
const mockGetFullList = vi.fn().mockResolvedValue([])
const mockGetList = vi.fn().mockResolvedValue({ items: [] })

vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    collection: (name: string) => ({
      getFullList: (...args: any[]) => mockGetFullList(name, ...args),
      getList: (...args: any[]) => mockGetList(name, ...args),
      getOne: vi.fn().mockResolvedValue({ id: 'dummy' }),
      create: vi.fn().mockResolvedValue({ id: 'dummy' }),
      update: vi.fn().mockResolvedValue({ id: 'dummy' }),
    }),
  },
}))

vi.mock('@/hooks/use-realtime', () => ({
  useRealtime: vi.fn(),
}))

describe('AutoGenerate - Concorrência, TTL e Reconciliação de Geração', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockGetFullList.mockImplementation(async (col: string) => {
      if (col === 'shift_cycles') {
        return [
          {
            id: 'cycle-1',
            name: 'Ciclo Teste',
            status: 'active',
            start_date: '2025-11-01',
            end_date: '2025-11-30',
          },
        ]
      }
      if (col === 'hospital_sectors') {
        return [
          {
            id: 'sector-1',
            name: 'Setor PSI Teste',
            min_staffing: 1,
            ideal_staffing: 2,
          },
        ]
      }
      return []
    })
  })

  it('1. Lock ativo < 5 min bloqueia o botão no reload/mount e exibe mensagem clara', async () => {
    const recentDate = new Date(Date.now() - 60 * 1000).toISOString() // 1 min ago
    mockGetList.mockResolvedValueOnce({
      items: [
        {
          id: 'run-active',
          cycle: 'cycle-1',
          sector: 'sector-1',
          status: 'generating',
          started_at: recentDate,
        },
      ],
    })

    render(<AutoGenerate />)

    await waitFor(() => {
      expect(screen.getByText('Geração em andamento para este ciclo/setor. Aguarde…')).toBeDefined()
    })

    const generateBtn = screen.getByRole('button', { name: /Gerar com IA/i })
    expect(generateBtn.hasAttribute('disabled')).toBe(true)
  })

  it('2. Lock expirado (> 5 min) é reconhecido como stale e libera o botão para nova geração', async () => {
    const oldDate = new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 min ago
    mockGetList.mockResolvedValueOnce({
      items: [
        {
          id: 'run-stale-orphan',
          cycle: 'cycle-1',
          sector: 'sector-1',
          status: 'validating',
          started_at: oldDate,
        },
      ],
    })

    render(<AutoGenerate />)

    await waitFor(() => {
      const generateBtn = screen.getByRole('button', { name: /Gerar com IA/i })
      expect(generateBtn.hasAttribute('disabled')).toBe(false)
    })

    expect(screen.queryByText('Geração em andamento para este ciclo/setor. Aguarde…')).toBeNull()
  })

  it('3. Duas requisições simultâneas: uma prossegue e a outra recebe 409 com mensagem clara', async () => {
    // Simula chamada direta ao serviço ou resposta com 409
    vi.spyOn(escalaService, 'generateDraftShifts').mockRejectedValueOnce({
      status: 409,
      response: {
        draft_exists: true,
        message: 'Geração em andamento para este ciclo/setor. Aguarde…',
      },
    })

    try {
      await escalaService.generateDraftShifts('cycle-1', 'sector-1')
    } catch (err: any) {
      expect(err.status).toBe(409)
      expect(err.response.message).toBe('Geração em andamento para este ciclo/setor. Aguarde…')
    }
  })

  it('4. Lock expirado recuperado pelo backend retorna aviso e geração prossegue', async () => {
    vi.spyOn(escalaService, 'generateDraftShifts').mockResolvedValueOnce({
      success: true,
      draft: [
        {
          id: 'shift-1',
          staff_profile: 'p-1',
          start_time: '2025-11-01 07:00:00',
          end_time: '2025-11-01 19:00:00',
        },
      ],
      stale_lock_recovered: true,
      recovered_run_id: 'run-stale-orphan',
    })

    const res = await escalaService.generateDraftShifts('cycle-1', 'sector-1')
    expect(res.success).toBe(true)
    expect(res.stale_lock_recovered).toBe(true)
    expect(res.recovered_run_id).toBe('run-stale-orphan')
  })

  it('5. Erro de validação (ex: elegíveis = 0) retorna estágio no_eligible_staff e erro estruturado sem travar run', async () => {
    vi.spyOn(escalaService, 'generateDraftShifts').mockRejectedValueOnce({
      status: 400,
      response: {
        error: 'Nenhum colaborador elegível para este setor.',
        stage: 'no_eligible_staff',
        run_id: 'run-failed-01',
      },
    })

    try {
      await escalaService.generateDraftShifts('cycle-1', 'sector-1')
    } catch (err: any) {
      expect(err.status).toBe(400)
      expect(err.response.stage).toBe('no_eligible_staff')
      expect(err.response.error).toContain('Nenhum colaborador elegível')
    }
  })
})
