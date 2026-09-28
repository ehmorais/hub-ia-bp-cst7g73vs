import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  CALENDAR_PDF_HTML_TEMPLATE,
  renderCalendarPdfTemplate,
  renderMultiPageCalendarHtml,
  renderWeeksHtml,
  formatCompactStaffName,
  escapeHtml,
} from '@/templates/calendarPdfTemplate'
import {
  buildCalendarHtml,
  prepareCalendarTemplateData,
  prepareCalendarMultiPageData,
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

    it('formatCompactStaffName encurta nomes longos preservando acentos em português', () => {
      expect(formatCompactStaffName('Laodiceia da Silva Goes Dias', 22)).toBe(
        'Laodiceia da S. G. Dias',
      )
      expect(formatCompactStaffName('Ana Paula', 22)).toBe('Ana Paula')
      expect(formatCompactStaffName('Cristiane Santos Lopes de Oliveira', 22)).toBe(
        'Cristiane S. L. de Oliveira',
      )
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
      expect(html).toContain('Folga Fim de Semana')
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

  // --------------------------------------------------------------------------
  // Suíte Específica de Testes dos Requisitos de Layout (4, 5 e 6 semanas, alta densidade, PS Respiratório)
  // --------------------------------------------------------------------------
  describe('Requisitos Obrigatórios: 4, 5 e 6 semanas, densidade e continuidade determinística', () => {
    // Helper para gerar lista de dias
    function generateDays(startDateStr: string, count: number) {
      const days: Array<{ date: Date; key: string; dayOfWeek: number }> = []
      const [y, m, d] = startDateStr.split('-').map(Number)
      const cur = new Date(y, m - 1, d)
      for (let i = 0; i < count; i++) {
        const dateObj = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + i)
        const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
        days.push({
          date: dateObj,
          key,
          dayOfWeek: dateObj.getDay(),
        })
      }
      return days
    }

    it('Mês com 4 semanas exatas (Fevereiro comum iniciando no Domingo): 7 colunas alinhadas', () => {
      // 2026-02-01 é domingo e fevereiro de 2026 tem 28 dias = exatamente 4 semanas
      const febDays = generateDays('2026-02-01', 28)
      const data = prepareCalendarTemplateData({
        days: febDays,
        shifts: [],
        contracts: [],
        staffProfiles: [],
        weekendOffMap: new Map(),
      })

      expect(data.weeks.length).toBe(4)
      data.weeks.forEach((w) => {
        expect(w.length).toBe(7)
      })
      expect(data.weekDayHeaders).toEqual(['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'])
      // O primeiro dia é domingo, sem células vazias no início
      expect(data.weeks[0][0]?.dayNumber).toBe(1)
      expect(data.weeks[3][6]?.dayNumber).toBe(28)
    })

    it('Mês com 5 semanas (Outubro padrão): grade com 5 linhas', () => {
      // 2025-10-01 é quarta-feira (dayOfWeek = 3) -> 3 vazios antes, total 31 dias -> 5 semanas
      const octDays = generateDays('2025-10-01', 31)
      const data = prepareCalendarTemplateData({
        days: octDays,
        shifts: [],
        contracts: [],
        staffProfiles: [],
        weekendOffMap: new Map(),
      })

      expect(data.weeks.length).toBe(5)
      // Células vazias no início: Dom (null), Seg (null), Ter (null)
      expect(data.weeks[0][0]).toBeNull()
      expect(data.weeks[0][1]).toBeNull()
      expect(data.weeks[0][2]).toBeNull()
      expect(data.weeks[0][3]?.dayNumber).toBe(1) // Qua 01/10
    })

    it('Mês/Ciclo com 6 semanas (ex: PS Respiratório 26/09/2026 a 25/10/2026): grade com 6 linhas', () => {
      // 26/09/2026 é Sábado (dayOfWeek = 6) -> 6 células vazias antes do dia 26/09
      // Total 30 dias -> se estende até domingo 25/10/2026 -> abrange 6 semanas
      const cycleDays = generateDays('2026-09-26', 30) // 26/09 a 25/10
      const data = prepareCalendarTemplateData({
        days: cycleDays,
        shifts: [],
        contracts: [],
        staffProfiles: [],
        weekendOffMap: new Map(),
      })

      expect(data.weeks.length).toBe(6)
      // Primeira semana: 6 nulos + dia 26/09 no sábado
      expect(data.weeks[0][0]).toBeNull()
      expect(data.weeks[0][5]).toBeNull()
      expect(data.weeks[0][6]?.dayFormatted).toBe('26/09')
      // Última semana: dia 25/10 no domingo + 6 nulos no fim
      expect(data.weeks[5][0]?.dayFormatted).toBe('25/10')
      expect(data.weeks[5][1]).toBeNull()
      expect(data.weeks[5][6]).toBeNull()
    })

    it('Cenário PS RESPIRATÓRIO com Laodiceia da Silva Goes Dias e alta densidade em 08/10/2026', () => {
      const cycleDays = generateDays('2026-09-26', 30) // 26/09 a 25/10/2026

      const staff = [
        {
          id: 'sp-laodiceia',
          name: 'Laodiceia da Silva Goes Dias',
          professional_id: 'COREN 9470010',
          default_sector: 'sec-ps-resp',
        },
        {
          id: 'sp-marcia',
          name: 'Marcia Ferreira Sales Silva',
          professional_id: 'COREN 835384',
          default_sector: 'sec-ps-resp',
        },
        {
          id: 'sp-matheus',
          name: 'Matheus Rodrigues Avelar',
          professional_id: 'COREN 1911297',
          default_sector: 'sec-ps-resp',
        },
        {
          id: 'sp-catia',
          name: 'Catia Aperecida da Silva Pirelli',
          professional_id: 'COREN 538627',
          default_sector: 'sec-ps-resp',
        },
      ]

      // Dia 08/10/2026 com 4 plantonistas no mesmo dia (alta densidade para 6 semanas onde limite é 2)
      const shifts = [
        {
          id: 'sh-1',
          staff_profile: 'sp-laodiceia',
          start_time: '2026-10-08 07:00:00',
          end_time: '2026-10-08 19:00:00',
          expand: { staff_profile: staff[0] },
        },
        {
          id: 'sh-2',
          staff_profile: 'sp-marcia',
          start_time: '2026-10-08 07:00:00',
          end_time: '2026-10-08 19:00:00',
          expand: { staff_profile: staff[1] },
        },
        {
          id: 'sh-3',
          staff_profile: 'sp-matheus',
          start_time: '2026-10-08 19:00:00',
          end_time: '2026-10-09 07:00:00',
          expand: { staff_profile: staff[2] },
        },
        {
          id: 'sh-4',
          staff_profile: 'sp-catia',
          start_time: '2026-10-08 19:00:00',
          end_time: '2026-10-09 07:00:00',
          expand: { staff_profile: staff[3] },
        },
      ]

      const weekendOffMap = new Map<string, Set<string>>()
      weekendOffMap.set('sp-laodiceia', new Set(['2026-10-03'])) // Sábado folga FDS

      const { pages, maxChipsPerCell, templateData } = prepareCalendarMultiPageData({
        title: 'Escala de Plantões — Calendário',
        sectorName: 'PS RESPIRATÓRIO',
        cycleName: 'Ciclo Outubro 2026',
        cycleStart: '2026-09-26',
        cycleEnd: '2026-10-25',
        days: cycleDays,
        shifts,
        contracts: [],
        staffProfiles: staff,
        weekendOffMap,
      })

      // Para 6 semanas, maxChipsPerCell deve ser 2
      expect(maxChipsPerCell).toBe(2)
      // Como 08/10/2026 tem 4 plantões (> 2), gerou página adicional de continuação
      expect(pages.length).toBe(2)
      expect(pages[0].pageType).toBe('grid')
      expect(pages[1].pageType).toBe('continuation')
      expect(pages[1].overflowDays?.length).toBe(1)
      expect(pages[1].overflowDays?.[0].dayFormatted).toBe('08/10')
      expect(pages[1].overflowDays?.[0].remainingShifts.length).toBe(2)

      const fullHtml = buildCalendarHtml({
        title: 'Escala de Plantões — Calendário',
        sectorName: 'PS RESPIRATÓRIO',
        cycleName: 'Ciclo Outubro 2026',
        cycleStart: '2026-09-26',
        cycleEnd: '2026-10-25',
        days: cycleDays,
        shifts,
        contracts: [],
        staffProfiles: staff,
        weekendOffMap,
      })

      // Verifica presença de cabeçalhos e rodapé em ambas as páginas
      expect(fullHtml).toContain('PS RESPIRATÓRIO')
      expect(fullHtml).toContain('Ciclo Outubro 2026')
      expect(fullHtml).toContain('Página 1 de 2')
      expect(fullHtml).toContain('Página 2 de 2')
      // Nome compacto de Laodiceia na grade
      expect(fullHtml).toContain('Laodiceia da S. G. Dias')
      // Tag de profissionais adicionais na célula 08/10
      expect(fullHtml).toContain('+2 profissional(is)')
      // Página 2 detalhando os profissionais excedentes
      expect(fullHtml).toContain('Continuação de Plantonistas')
      expect(fullHtml).toContain('Matheus Rodrigues Avelar')
      expect(fullHtml).toContain('Catia A. da S. Pirelli')
      // Folga FDS no sábado 03/10
      expect(fullHtml).toContain('Folga Fim de Semana')
      expect(fullHtml).toContain('badge-fds')
    })

    it('renderWeeksHtml respeita o limite de chips e não quebra com semanas vazias', () => {
      const emptyWeeks: Array<Array<any>> = [[null, null, null, null, null, null, null]]
      const html = renderWeeksHtml(emptyWeeks, 3)
      expect(html).toContain('empty-day')
      expect(html).not.toContain('undefined')
    })
  })
})
