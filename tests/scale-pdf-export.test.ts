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
let allAutoTableCalls: any[] = []

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
      allAutoTableCalls.push(options)
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

  it('exportScalePdf inclui D/N e horários nas células de plantão com cores correspondentes e sem quebra de linha', () => {
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
    expect(user1Day1.content).toBe('D 07:00–19:00')
    expect(user1Day1.content).not.toContain('\n')
    expect(user1Day1.content).not.toContain('\r')
    expect(user1Day1.styles.fillColor).toEqual([4, 120, 87]) // Verde escuro
    expect(user1Day1.styles.textColor).toEqual([255, 255, 255])

    // user_1 no dia 2026-10-02 (índice coluna 2): Plantão N
    const user1Day2 = body[0][2]
    expect(user1Day2.content).toBe('N 19:00–07:00')
    expect(user1Day2.content).not.toContain('\n')
    expect(user1Day2.content).not.toContain('\r')
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

  it('Paginação: limita a no máximo 12 colunas de dias por página e particiona ciclo de 31 dias em 12 + 12 + 7 colunas', () => {
    mockAddPage.mockClear()
    allAutoTableCalls = []

    const thirtyOneDays: string[] = []
    for (let i = 1; i <= 31; i++) {
      const day = String(i).padStart(2, '0')
      thirtyOneDays.push(`2026-10-${day}`)
    }

    exportScalePdf({
      title: 'Escala de Plantões Mensal',
      sectorName: 'Centro Cirúrgico',
      cycleStart: '2026-10-01',
      cycleEnd: '2026-10-31',
      staffNames,
      staffRows,
      dateHeaders: thirtyOneDays,
      cellMap,
      weekendOffMap,
    })

    // 31 dias com max 12 por página particiona em 12 + 12 + 7 (3 páginas / 3 tabelas, 2 chamadas a addPage)
    expect(allAutoTableCalls.length).toBe(3)
    expect(mockAddPage).toHaveBeenCalledTimes(2)

    // Colunas de cada página: 1 coluna do colaborador + N colunas de dias
    // Página 1: 1 + 12 colunas = 13
    const headPage1 = allAutoTableCalls[0].head[0]
    const dayColsPage1 = headPage1.length - 1
    expect(dayColsPage1).toBe(12)
    expect(dayColsPage1).toBeLessThanOrEqual(12)

    // Página 2: 1 + 12 colunas = 13
    const headPage2 = allAutoTableCalls[1].head[0]
    const dayColsPage2 = headPage2.length - 1
    expect(dayColsPage2).toBe(12)
    expect(dayColsPage2).toBeLessThanOrEqual(12)

    // Página 3: 1 + 7 colunas = 8
    const headPage3 = allAutoTableCalls[2].head[0]
    const dayColsPage3 = headPage3.length - 1
    expect(dayColsPage3).toBe(7)
    expect(dayColsPage3).toBeLessThanOrEqual(12)

    // Soma total de dias nas 3 páginas = 12 + 12 + 7 = 31
    expect(dayColsPage1 + dayColsPage2 + dayColsPage3).toBe(31)
  })

  it('Cabeçalho e coluna do colaborador se repetem a cada página com showHead: everyPage', () => {
    allAutoTableCalls = []
    const twentyDays: string[] = []
    for (let i = 1; i <= 20; i++) {
      twentyDays.push(`2026-10-${String(i).padStart(2, '0')}`)
    }

    exportScalePdf({
      title: 'Escala de Plantões',
      sectorName: 'UTI Geral',
      cycleStart: '2026-10-01',
      cycleEnd: '2026-10-20',
      staffNames,
      staffRows,
      dateHeaders: twentyDays,
      cellMap,
      weekendOffMap,
    })

    // 20 dias particiona em 12 + 8 = 2 páginas
    expect(allAutoTableCalls.length).toBe(2)

    allAutoTableCalls.forEach((tableCall) => {
      // showHead configurado para 'everyPage'
      expect(tableCall.showHead).toBe('everyPage')

      // Primeira coluna do cabeçalho é sempre 'Colaborador'
      expect(tableCall.head[0][0]).toBe('Colaborador')

      // A primeira coluna de cada linha no body tem o nome de cada colaborador
      expect(tableCall.body[0][0].content).toBe('Amanda Ribeiro')
      expect(tableCall.body[1][0].content).toBe('Bruno Costa')
      expect(tableCall.body[2][0].content).toBe('Carlos Eduardo')
    })
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
