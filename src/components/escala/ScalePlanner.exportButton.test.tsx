import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { ScalePlanner } from '@/components/escala/ScalePlanner'
import * as scalePdfExportModule from '@/utils/scalePdfExport'

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

// Mock PocketBase client
const mockGetFullList = vi.fn()
vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    collection: (name: string) => ({
      getFullList: (...args: any[]) => mockGetFullList(name, ...args),
      getList: vi.fn().mockResolvedValue({ items: [] }),
      getOne: vi.fn().mockResolvedValue({ id: 'dummy' }),
      create: vi.fn().mockResolvedValue({ id: 'dummy' }),
      update: vi.fn().mockResolvedValue({ id: 'dummy' }),
    }),
    send: vi.fn(),
  },
}))

vi.mock('@/hooks/use-realtime', () => ({
  useRealtime: vi.fn(),
}))

describe('ScalePlanner - Botão Exportar para PDF anti-regressão', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockGetFullList.mockImplementation(async (col: string) => {
      if (col === 'shift_cycles') {
        return [
          {
            id: 'cycle-out-2026',
            name: 'Ciclo Outubro 2026',
            status: 'draft',
            start_date: '2026-09-26 00:00:00',
            end_date: '2026-10-25 23:59:59',
          },
        ]
      }
      if (col === 'hospital_sectors') {
        return [
          {
            id: 'sector-ps-resp',
            name: 'PS RESPIRATÓRIO',
            min_staffing: 2,
            ideal_staffing: 3,
          },
        ]
      }
      if (col === 'staff_profiles') {
        return [
          {
            id: 'staff-1',
            name: 'Enfermeira Ana',
            professional_id: 'COREN 123456',
            default_sector: 'sector-ps-resp',
            active: true,
          },
        ]
      }
      if (col === 'staff_contracts') {
        return [
          {
            id: 'contract-1',
            staff_profile: 'staff-1',
            expand: {
              shift_type: {
                id: 'st-12x36',
                name: '12x36 Diurno',
                work_hours: 12,
              },
            },
          },
        ]
      }
      if (col === 'timeoff_requests') {
        return []
      }
      if (col === 'shifts') {
        return [
          {
            id: 'shift-1',
            cycle: 'cycle-out-2026',
            sector: 'sector-ps-resp',
            staff_profile: 'staff-1',
            start_time: '2026-10-17 07:00:00.000Z',
            end_time: '2026-10-17 19:00:00.000Z',
            expand: {
              staff_profile: {
                id: 'staff-1',
                name: 'Enfermeira Ana',
                professional_id: 'COREN 123456',
              },
            },
          },
        ]
      }
      if (col === 'schedule_drafts') {
        return []
      }
      return []
    })
  })

  it('aciona exportAutoGenerateCalendarPdf com ciclo Outubro 2026 e PS RESPIRATÓRIO, e NÃO aciona exportScalePdf', async () => {
    const calendarPdfSpy = vi
      .spyOn(scalePdfExportModule, 'exportAutoGenerateCalendarPdf')
      .mockResolvedValue('escala-2026-09.pdf')

    const legacyExportScalePdfSpy = vi.spyOn(scalePdfExportModule, 'exportScalePdf')

    render(<ScalePlanner />)

    // Aguarda o botão "Exportar para PDF" ficar habilitado após carregar ciclo, setor e plantões
    const exportBtn = await screen.findByRole('button', { name: /Exportar para PDF/i })
    await waitFor(() => {
      expect(exportBtn.hasAttribute('disabled')).toBe(false)
    })

    fireEvent.click(exportBtn)

    await waitFor(() => {
      expect(calendarPdfSpy).toHaveBeenCalledTimes(1)
    })

    // Asserção essencial: exportScalePdf NÃO deve ser chamado
    expect(legacyExportScalePdfSpy).not.toHaveBeenCalled()

    // Verifica parâmetros passados para exportAutoGenerateCalendarPdf
    const callArgs = calendarPdfSpy.mock.calls[0][0]
    expect(callArgs.title).toBe('Escala de Plantões — Calendário')
    expect(callArgs.sectorName).toBe('PS RESPIRATÓRIO')
    expect(callArgs.cycleName).toBe('Ciclo Outubro 2026')
    expect(callArgs.cycleStart).toBe('2026-09-26')
    expect(callArgs.cycleEnd).toBe('2026-10-25')
    expect(callArgs.shifts.length).toBeGreaterThan(0)
    expect(callArgs.days.length).toBe(30) // 26/09 a 25/10/2026 = 30 dias

    // Asserção anti-regressão: MAX_DAYS_PER_PAGE = 12 não participa do fluxo
    // Verifica que nenhum parâmetro ou chamada envolve fragmentação MAX_DAYS_PER_PAGE
    const callString = JSON.stringify(callArgs)
    expect(callString).not.toContain('MAX_DAYS_PER_PAGE')
    expect(scalePdfExportModule.exportScalePdf).not.toHaveBeenCalled()

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'PDF Gerado',
          description: expect.stringContaining('sucesso'),
        }),
      )
    })
  })
})
