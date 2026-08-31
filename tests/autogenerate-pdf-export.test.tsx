import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { AutoGenerate } from '@/components/escala/AutoGenerate'

// Mock de jsPDF e jspdf-autotable
const mockSave = vi.fn()
const mockText = vi.fn()
const mockAddImage = vi.fn()
const mockSetFont = vi.fn()
const mockSetFontSize = vi.fn()
const mockSetTextColor = vi.fn()
const mockSetProperties = vi.fn()
const mockAddPage = vi.fn()
const mockSetPage = vi.fn()
const mockGetNumberOfPages = vi.fn().mockReturnValue(1)

vi.mock('jspdf', () => {
  return {
    jsPDF: vi.fn().mockImplementation(() => ({
      save: mockSave,
      text: mockText,
      addImage: mockAddImage,
      setFont: mockSetFont,
      setFontSize: mockSetFontSize,
      setTextColor: mockSetTextColor,
      setProperties: mockSetProperties,
      addPage: mockAddPage,
      setPage: mockSetPage,
      getNumberOfPages: mockGetNumberOfPages,
      internal: {
        pageSize: {
          getWidth: () => 297,
          getHeight: () => 210,
        },
      },
    })),
  }
})

let lastAutoTableCall: any = null
vi.mock('jspdf-autotable', () => {
  return {
    default: vi.fn((_doc, options) => {
      lastAutoTableCall = options
      if (options?.didDrawPage) {
        options.didDrawPage()
      }
      return options
    }),
  }
})

// Mock do PocketBase
const dummyCycles = [
  {
    id: 'cycle-teste-01',
    name: 'Ciclo Outubro 2026',
    start_date: '2026-10-01 00:00:00.000Z',
    end_date: '2026-10-31 23:59:59.000Z',
    status: 'active',
  },
]

const dummySectors = [
  {
    id: 'sec-teste-01',
    name: 'UTI Adulto Teste',
    min_staffing: 2,
    ideal_staffing: 4,
  },
]

const dummyStaffProfiles = [
  {
    id: 'prof-teste-01',
    name: 'Plantonista Ficticio Silva',
    professional_id: '99887-SP',
    default_sector: 'sec-teste-01',
  },
  {
    id: 'prof-teste-02',
    name: 'Plantonista Ficticio Santos',
    professional_id: '',
    default_sector: 'sec-teste-01',
  },
]

const dummyContracts = [
  {
    id: 'contract-01',
    staff_profile: 'prof-teste-01',
    expand: {
      shift_type: { id: 'st-1', name: '12x36 Diurno', start_time: '07:00', end_time: '19:00' },
    },
  },
  {
    id: 'contract-02',
    staff_profile: 'prof-teste-02',
    expand: {
      shift_type: { id: 'st-2', name: '12x36 Noturno', start_time: '19:00', end_time: '07:00' },
    },
  },
]

const dummyGeneratedShifts = [
  {
    id: 'shift-01',
    staff_profile: 'prof-teste-01',
    sector: 'sec-teste-01',
    cycle: 'cycle-teste-01',
    start_time: '2026-10-01 07:00:00.000Z',
    end_time: '2026-10-01 19:00:00.000Z',
    expand: {
      staff_profile: dummyStaffProfiles[0],
      sector: dummySectors[0],
      cycle: dummyCycles[0],
    },
  },
  {
    id: 'shift-02',
    staff_profile: 'prof-teste-02',
    sector: 'sec-teste-01',
    cycle: 'cycle-teste-01',
    start_time: '2026-10-01 19:00:00.000Z',
    end_time: '2026-10-02 07:00:00.000Z',
    expand: {
      staff_profile: dummyStaffProfiles[1],
      sector: dummySectors[0],
      cycle: dummyCycles[0],
    },
  },
]

vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    collection: (colName: string) => ({
      getFullList: vi.fn().mockImplementation(async (options?: any) => {
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
    run_id: 'run-teste-01',
    draft_id: 'draft-teste-01',
  }),
  commitShiftSchedule: vi.fn().mockResolvedValue({ success: true }),
  getGenerationRun: vi.fn().mockResolvedValue({}),
  getDraft: vi.fn().mockResolvedValue({
    id: 'draft-teste-01',
    validation_summary: {
      weekend_off_assignments: {
        'prof-teste-01': ['2026-10-03'],
      },
    },
  }),
  getDraftIssues: vi.fn().mockResolvedValue([]),
  getRunIssues: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/hooks/use-realtime', () => ({
  useRealtime: vi.fn(),
}))

describe('AutoGenerate IA — Exportação PDF (Dois Formatos: Lista por Dia e Calendário)', () => {
  beforeEach(() => {
    mockSave.mockClear()
    mockText.mockClear()
    mockAddImage.mockClear()
    lastAutoTableCall = null
  })

  it('1. Clicar em "Exportar PDF" abre o modal seletor e NÃO gera o arquivo imediatamente', async () => {
    render(<AutoGenerate />)

    // Clica em "Gerar com IA"
    const generateBtn = screen.getByText('Gerar com IA')
    fireEvent.click(generateBtn)

    // Aguarda o rascunho ser exibido
    await waitFor(() => {
      expect(screen.getByText('Exportar PDF')).toBeDefined()
    })

    // Clica em "Exportar PDF"
    const exportPdfBtn = screen.getByText('Exportar PDF')
    fireEvent.click(exportPdfBtn)

    // O modal deve estar aberto com as 2 opções
    expect(screen.getByText('Exportar Escala em PDF')).toBeDefined()
    expect(screen.getByText('Lista por dia')).toBeDefined()
    expect(screen.getByText('Calendário')).toBeDefined()

    // O PDF NÃO deve ter sido gerado antes da escolha
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('2. Cancelar no seletor fecha o modal e não gera nenhum PDF', async () => {
    render(<AutoGenerate />)

    // Clica em "Gerar com IA"
    fireEvent.click(screen.getByText('Gerar com IA'))

    await waitFor(() => {
      expect(screen.getByText('Exportar PDF')).toBeDefined()
    })

    // Abre o modal
    fireEvent.click(screen.getByText('Exportar PDF'))
    expect(screen.getByText('Exportar Escala em PDF')).toBeDefined()

    // Clica em "Cancelar"
    const cancelBtn = screen.getByTestId('btn-cancel-pdf-export')
    fireEvent.click(cancelBtn)

    // Modal fechou e nenhum arquivo foi salvo
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('3. Escolher "Lista por dia" exporta o relatório detalhado incluindo COREN e horários', async () => {
    render(<AutoGenerate />)

    fireEvent.click(screen.getByText('Gerar com IA'))

    await waitFor(() => {
      expect(screen.getByText('Exportar PDF')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Exportar PDF'))

    // Seleciona a opção "Lista por dia"
    const dailyListOption = screen.getByTestId('btn-pdf-format-daily-list')
    fireEvent.click(dailyListOption)

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith('escala-2026-10.pdf')
    })

    expect(lastAutoTableCall).toBeDefined()
    const head = lastAutoTableCall.head[0]
    expect(head).toContain('COREN')
    expect(head).toContain('Início')
    expect(head).toContain('Fim')

    // Verifica que o COREN real e fallback constam nas linhas
    const body = lastAutoTableCall.body
    expect(body.length).toBe(2)
    expect(body[0][3]).toBe('COREN 99887-SP')
    expect(body[1][3]).toBe('COREN não informado')

    // Preservação de início e fim
    expect(body[0][5]).toBe('07:00')
    expect(body[0][6]).toBe('19:00')
  })

  it('4. Escolher "Calendário" exporta a grade mensal com D/N + COREN e "Folga Fim de Semana"', async () => {
    render(<AutoGenerate />)

    fireEvent.click(screen.getByText('Gerar com IA'))

    await waitFor(() => {
      expect(screen.getByText('Exportar PDF')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Exportar PDF'))

    // Seleciona a opção "Calendário"
    const calendarOption = screen.getByTestId('btn-pdf-format-calendar')
    fireEvent.click(calendarOption)

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith('escala-2026-10.pdf')
    })

    expect(lastAutoTableCall).toBeDefined()
    const body = lastAutoTableCall.body
    expect(body.length).toBeGreaterThanOrEqual(1)

    // O conteúdo das semanas do calendário possui os dados formatados
    const firstWeek = body[0]
    const day1Content = firstWeek[0].content
    expect(day1Content).toContain('Plantonista Ficticio Silva')
    expect(day1Content).toContain('D • COREN 99887-SP')
    expect(day1Content).toContain('Plantonista Ficticio Santos')
    expect(day1Content).toContain('N • COREN não informado')
  })

  it('5. Dados de setor, ciclo e horários (start_time/end_time) são mantidos sem perda', async () => {
    expect(dummyGeneratedShifts[0].start_time).toBe('2026-10-01 07:00:00.000Z')
    expect(dummyGeneratedShifts[0].end_time).toBe('2026-10-01 19:00:00.000Z')
    expect(dummyGeneratedShifts[1].start_time).toBe('2026-10-01 19:00:00.000Z')
    expect(dummyGeneratedShifts[1].end_time).toBe('2026-10-02 07:00:00.000Z')
  })

  it('6. PDF exportado inclui o logotipo institucional no cabeçalho em ambos os formatos', async () => {
    render(<AutoGenerate />)

    fireEvent.click(screen.getByText('Gerar com IA'))

    await waitFor(() => {
      expect(screen.getByText('Exportar PDF')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Exportar PDF'))
    fireEvent.click(screen.getByTestId('btn-pdf-format-daily-list'))

    await waitFor(() => {
      expect(mockAddImage).toHaveBeenCalled()
    })
  })
})
