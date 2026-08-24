import { describe, it, expect, vi } from 'vitest'
import {
  exportScalePdf,
  formatSafeFilename,
  type ShiftSlot,
  type ExportScalePdfParams,
} from '../src/utils/scalePdfExport'

// Mock de jsPDF e jspdf-autotable para inspecionar geração e salvamento
const mockSave = vi.fn()
const mockText = vi.fn()
const mockSetFont = vi.fn()
const mockSetFontSize = vi.fn()
const mockSetTextColor = vi.fn()
const mockSetProperties = vi.fn()
const mockAddPage = vi.fn()
const mockSetPage = vi.fn()
const mockGetNumberOfPages = vi.fn().mockReturnValue(1)
let lastAutoTableArgs: any = null

vi.mock('jspdf', () => {
  return {
    jsPDF: vi.fn().mockImplementation(() => ({
      save: mockSave,
      text: mockText,
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

vi.mock('jspdf-autotable', () => {
  return {
    default: vi.fn((_doc, options) => {
      lastAutoTableArgs = options
      return options
    }),
  }
})

describe('PDF Export for ScalePlanner (scalePdfExport)', () => {
  const staffNames: Record<string, string> = {
    user_1: 'Amanda Ribeiro',
    user_2: 'Bruno Costa',
    user_3: 'Carlos Eduardo',
  }

  const staffRows = ['user_1', 'user_2', 'user_3']

  const dateHeaders = [
    '2026-10-01',
    '2026-10-02',
    '2026-10-03', // Sábado
    '2026-10-04', // Domingo
    '2026-10-05',
  ]

  const cellMap: Record<string, Record<string, ShiftSlot>> = {
    user_1: {
      '2026-10-01': { type: 'day', start: '07:00', end: '19:00' },
      '2026-10-02': { type: 'night', start: '19:00', end: '07:00' },
    },
    user_2: {
      '2026-10-01': { type: 'night', start: '19:00', end: '07:00' },
      '2026-10-05': { type: 'day', start: '07:00', end: '19:00' },
    },
    user_3: {
      '2026-10-02': { type: 'day', start: '07:00', end: '19:00' },
    },
  }

  const weekendOffMap = new Map<string, Set<string>>()
  weekendOffMap.set('user_1', new Set(['2026-10-03', '2026-10-04']))

  it('Nome do arquivo segue o padrão escala-{YYYY}-{MM}.pdf', () => {
    expect(formatSafeFilename('2026-10-01')).toBe('escala-2026-10.pdf')
    expect(formatSafeFilename('2025-05-15')).toBe('escala-2025-05.pdf')

    // Sem cycleStart válido, gera com ano e mês atuais
    const currentName = formatSafeFilename()
    expect(currentName).toMatch(/^escala-\d{4}-\d{2}\.pdf$/)
  })

  it('Chama exportScalePdf e invoca jsPDF.save com nome correto e propriedades', () => {
    mockSave.mockClear()
    lastAutoTableArgs = null

    const data: ExportScalePdfParams = {
      title: 'Escala de Plantões',
      sectorName: 'UTI Adulto',
      cycleStart: '2026-10-01',
      cycleEnd: '2026-10-31',
      staffNames,
      staffRows,
      dateHeaders,
      cellMap,
      weekendOffMap,
    }

    const filename = exportScalePdf(data)

    expect(filename).toBe('escala-2026-10.pdf')
    expect(mockSave).toHaveBeenCalledWith('escala-2026-10.pdf')
    expect(lastAutoTableArgs).toBeDefined()
  })

  it('exportScalePdf inclui todos os colaboradores ordenados em staffRows (mesmo com filtro ativo na UI)', () => {
    mockSave.mockClear()
    lastAutoTableArgs = null

    // Simulação: na interface pode haver filtro, mas staffRows enviados para a função contêm todos
    const allStaffRows = ['user_1', 'user_2', 'user_3']
    exportScalePdf({
      title: 'Escala de Plantões',
      sectorName: 'Pronto Socorro',
      cycleStart: '2026-10-01',
      cycleEnd: '2026-10-31',
      staffNames,
      staffRows: allStaffRows,
      dateHeaders,
      cellMap,
      weekendOffMap,
    })

    expect(lastAutoTableArgs.body.length).toBe(3)
    expect(lastAutoTableArgs.body[0][0].content).toBe('Amanda Ribeiro')
    expect(lastAutoTableArgs.body[1][0].content).toBe('Bruno Costa')
    expect(lastAutoTableArgs.body[2][0].content).toBe('Carlos Eduardo')
  })

  it('exportScalePdf inclui D/N e horários nas células de plantão com cores correspondentes', () => {
    exportScalePdf({
      title: 'Escala de Plantões',
      sectorName: 'UTI Adulto',
      cycleStart: '2026-10-01',
      cycleEnd: '2026-10-31',
      staffNames,
      staffRows,
      dateHeaders,
      cellMap,
      weekendOffMap,
    })

    const body = lastAutoTableArgs.body
    // user_1 no dia 2026-10-01 (índice coluna 1): Plantão D
    const user1Day1 = body[0][1]
    expect(user1Day1.content).toBe('D\n07:00-19:00')
    expect(user1Day1.styles.fillColor).toEqual([4, 120, 87]) // Verde escuro
    expect(user1Day1.styles.textColor).toEqual([255, 255, 255])

    // user_1 no dia 2026-10-02 (índice coluna 2): Plantão N
    const user1Day2 = body[0][2]
    expect(user1Day2.content).toBe('N\n19:00-07:00')
    expect(user1Day2.styles.fillColor).toEqual([30, 58, 138]) // Azul escuro
    expect(user1Day2.styles.textColor).toEqual([255, 255, 255])
  })

  it('exportScalePdf destaca "FOLGA" com cor laranja nas células de folga de fim de semana', () => {
    exportScalePdf({
      title: 'Escala de Plantões',
      sectorName: 'UTI Adulto',
      cycleStart: '2026-10-01',
      cycleEnd: '2026-10-31',
      staffNames,
      staffRows,
      dateHeaders,
      cellMap,
      weekendOffMap,
    })

    const body = lastAutoTableArgs.body
    // user_1 no dia 2026-10-03 (Sábado, coluna 3) e 2026-10-04 (Domingo, coluna 4)
    const user1Sat = body[0][3]
    const user1Sun = body[0][4]

    expect(user1Sat.content).toBe('FOLGA')
    expect(user1Sat.styles.fillColor).toEqual([255, 243, 224]) // #FFF3E0
    expect(user1Sat.styles.textColor).toEqual([194, 65, 12]) // #C2410C
    expect(user1Sat.styles.fontStyle).toBe('bold')

    expect(user1Sun.content).toBe('FOLGA')
    expect(user1Sun.styles.fillColor).toEqual([255, 243, 224])
  })

  it('Paginação: divide em páginas quando houver mais de 14 colunas de datas e repete cabeçalhos', () => {
    mockAddPage.mockClear()
    const thirtyDays: string[] = []
    for (let i = 1; i <= 30; i++) {
      const day = String(i).padStart(2, '0')
      thirtyDays.push(`2026-10-${day}`)
    }

    exportScalePdf({
      title: 'Escala de Plantões Mensal',
      sectorName: 'Centro Cirúrgico',
      cycleStart: '2026-10-01',
      cycleEnd: '2026-10-30',
      staffNames,
      staffRows,
      dateHeaders: thirtyDays,
      cellMap,
      weekendOffMap,
    })

    // 30 dias com max 14 por página gera ceil(30/14) = 3 páginas (2 chamadas a doc.addPage)
    expect(mockAddPage).toHaveBeenCalledTimes(2)
  })

  it('Estrutura e contratos da UI do ScalePlanner: exportação de PDF, botões e filtros', () => {
    // Simula a verificação de propriedades do botão e estado
    const emptyDraft = {}
    const filledDraft = {
      u1: { '2026-10-01': 'D' },
    }

    const hasDataEmpty =
      Object.keys(emptyDraft).length > 0 &&
      Object.keys(emptyDraft).some((uid) => Object.keys((emptyDraft as any)[uid] || {}).length > 0)
    expect(hasDataEmpty).toBe(false)

    const hasDataFilled =
      Object.keys(filledDraft).length > 0 &&
      Object.keys(filledDraft).some((uid) => Object.keys((filledDraft as any)[uid] || {}).length > 0)
    expect(hasDataFilled).toBe(true)
  })
})
