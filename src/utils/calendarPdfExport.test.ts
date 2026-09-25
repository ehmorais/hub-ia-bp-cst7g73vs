import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  CALENDAR_PDF_HTML_TEMPLATE,
  renderCalendarPdfTemplate,
  escapeHtml,
} from '@/templates/calendarPdfTemplate'
import {
  buildCalendarHtml,
  exportAutoGenerateCalendarPdf,
  renderHtmlToPdfLandscape,
} from '@/utils/scalePdfExport'
import { BPSCS_LOGO_BASE64 } from '@/utils/bpscsLogo'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

// Mock de html2canvas para testar em ambiente jsdom/vitest sem crashar renderização gráfica
vi.mock('html2canvas', () => {
  return {
    default: vi.fn().mockImplementation(async () => {
      return {
        width: 1123,
        height: 794,
        toDataURL: () =>
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      }
    }),
  }
})

describe('Pipeline de Template HTML para Exportação de Calendário PDF (BPSCS)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockDays = [
    { date: new Date(2025, 4, 1), key: '2025-05-01', dayOfWeek: 4 }, // Qui
    { date: new Date(2025, 4, 2), key: '2025-05-02', dayOfWeek: 5 }, // Sex
    { date: new Date(2025, 4, 3), key: '2025-05-03', dayOfWeek: 6 }, // Sáb
    { date: new Date(2025, 4, 4), key: '2025-05-04', dayOfWeek: 0 }, // Dom
  ]

  const mockStaff = [
    {
      id: 'st1',
      name: 'Dra. Roberta Andrade',
      professional_id: 'CRM 123456-SP',
      default_sector: 'sec1',
    },
    {
      id: 'st2',
      name: 'Enf. Juliana Souza',
      professional_id: 'COREN 654321-SP',
      default_sector: 'sec1',
    },
  ]

  const mockShifts = [
    {
      id: 'sh1',
      staff_profile: 'st1',
      start_time: '2025-05-01 07:00:00',
      end_time: '2025-05-01 19:00:00',
      expand: { staff_profile: mockStaff[0] },
    },
    {
      id: 'sh2',
      staff_profile: 'st2',
      start_time: '2025-05-02 19:00:00',
      end_time: '2025-05-03 07:00:00',
      expand: { staff_profile: mockStaff[1] },
    },
  ]

  const mockWeekendOffMap = new Map<string, Set<string>>()
  mockWeekendOffMap.set('st1', new Set(['2025-05-03'])) // st1 folga no sábado 03/05

  describe('Requisito (a): Template HTML contém placeholders e preenche dados corretamente', () => {
    it('o template base exporta a string HTML com os placeholders oficiais', () => {
      expect(CALENDAR_PDF_HTML_TEMPLATE).toContain('{{TITLE}}')
      expect(CALENDAR_PDF_HTML_TEMPLATE).toContain('{{SUBTITLE}}')
      expect(CALENDAR_PDF_HTML_TEMPLATE).toContain('{{LOGO_BASE64}}')
      expect(CALENDAR_PDF_HTML_TEMPLATE).toContain('{{WEEK_HEADERS_HTML}}')
      expect(CALENDAR_PDF_HTML_TEMPLATE).toContain('{{WEEKS_HTML}}')
      expect(CALENDAR_PDF_HTML_TEMPLATE).toContain('{{GENERATED_AT}}')
      expect(CALENDAR_PDF_HTML_TEMPLATE).toContain('{{PAGE_CURRENT}}')
      expect(CALENDAR_PDF_HTML_TEMPLATE).toContain('{{PAGE_TOTAL}}')
    })

    it('escapeHtml protege tags e caracteres especiais', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
      )
      expect(escapeHtml(null)).toBe('')
    })

    it('preenche corretamente mês, dias da semana e plantonistas nos dias certos com layout novo', () => {
      const html = buildCalendarHtml({
        title: 'Escala Mensal UTI Adulto',
        sectorName: 'UTI Geral',
        cycleName: 'Maio 2025',
        cycleStart: '2025-05-01',
        cycleEnd: '2025-05-04',
        days: mockDays,
        shifts: mockShifts,
        contracts: [],
        staffProfiles: mockStaff,
        weekendOffMap: mockWeekendOffMap,
      })

      expect(html).toContain('Escala Mensal UTI Adulto')
      expect(html).toContain('Setor: UTI Geral')
      expect(html).toContain('Ciclo: Maio 2025')
      expect(html).toContain('Dra. Roberta Andrade')
      expect(html).toContain('Enf. Juliana Souza')
      expect(html).toContain('CRM 123456-SP')
      expect(html).toContain('COREN 654321-SP')
      expect(html).toContain('01/05')
      expect(html).toContain('02/05')
      expect(html).toContain('03/05')
      expect(html).toContain('Folga FDS')
      // Verifica classes de estilo institucional do novo layout
      expect(html).toContain('shift-chip-row')
      expect(html).toContain('shift-period-tag')
      expect(html).toContain('header-org')
    })
  })

  describe('Requisito (b): Export retorna PDF válido (A4 Landscape, output não vazio)', () => {
    it('renderHtmlToPdfLandscape instancia jsPDF em landscape e salva em A4', async () => {
      const doc = await renderHtmlToPdfLandscape('<div>Teste</div>', {
        title: 'Teste Landscape',
      })

      expect(doc).toBeInstanceOf(jsPDF)
      const pageInfo = doc.internal.pageSize
      // A4 Landscape: width 297mm x height 210mm
      expect(Math.round(pageInfo.getWidth())).toBe(297)
      expect(Math.round(pageInfo.getHeight())).toBe(210)
      expect(doc.getNumberOfPages()).toBe(1)
    })

    it('exportAutoGenerateCalendarPdf executa fluxo completo, chama html2canvas e salva arquivo com data', async () => {
      const saveSpy = vi.spyOn(jsPDF.prototype, 'save').mockImplementation(() => undefined as any)

      const filename = await exportAutoGenerateCalendarPdf({
        title: 'Escala Calendário Teste',
        sectorName: 'Centro Cirúrgico',
        cycleStart: '2025-05-01',
        cycleEnd: '2025-05-31',
        days: mockDays,
        shifts: mockShifts,
        contracts: [],
        staffProfiles: mockStaff,
        weekendOffMap: mockWeekendOffMap,
      })

      expect(filename).toBe('escala-2025-05.pdf')
      expect(saveSpy).toHaveBeenCalledWith('escala-2025-05.pdf')
      expect(html2canvas).toHaveBeenCalled()
    })
  })

  describe('Requisito (c): O template inclui a tag <img> do logotipo com a constante BPSCS_LOGO_BASE64 no cabeçalho superior direito', () => {
    it('o HTML gerado contém a tag img com src preenchido exatamente por BPSCS_LOGO_BASE64', () => {
      const html = buildCalendarHtml({
        days: mockDays,
        shifts: mockShifts,
        contracts: [],
        staffProfiles: mockStaff,
        weekendOffMap: mockWeekendOffMap,
      })

      expect(html).toContain('<img src="data:image/png;base64,')
      expect(html).toContain(BPSCS_LOGO_BASE64)
      expect(html).toContain('alt="Logo Institucional BPSCS"')
      expect(html).toContain('header-logo')
    })
  })

  describe('Requisito (d): Rodapé com Página X de Y, data/hora e identificação institucional', () => {
    it('renderCalendarPdfTemplate insere paginação e data/hora no rodapé', () => {
      const html = renderCalendarPdfTemplate({
        title: 'Teste Rodapé',
        weekDayHeaders: ['Dom', 'Seg'],
        weeks: [[null, null]],
        generatedAt: '15/05/2025 às 14:30',
        pageCurrent: 1,
        pageTotal: 1,
      })

      expect(html).toContain('Gerado em: 15/05/2025 às 14:30')
      expect(html).toContain('Página 1 de 1')
      expect(html).toContain('Beneficência Portuguesa de São Caetano do Sul')
      expect(html).toContain('Documento confidencial / Uso interno')
    })
  })
})
