import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  CALENDAR_PDF_COMMON_STYLES,
  CALENDAR_PDF_HTML_TEMPLATE,
  renderCalendarPdfTemplate,
  renderMultiPageCalendarHtml,
  renderWeeklyCellHtml,
  renderWeeklyTableBody,
  renderStaffCardHtml,
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

describe('Pipeline de Calendário Semanal Paginado em PDF (BPSCS)', () => {
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

  describe('Requisitos Visuais e Tipografia Obrigatória (Pesos e Tamanhos)', () => {
    it('garante que peso de fonte para nomes, COREN, horários e itens de conteúdo é 400 (normal)', () => {
      // Regra 1: Peso normal para nomes, coren, horários e detalhes
      expect(CALENDAR_PDF_COMMON_STYLES).toMatch(/\.staff-entry-name\s*\{[^}]*font-weight:\s*400/)
      expect(CALENDAR_PDF_COMMON_STYLES).toMatch(
        /\.staff-entry-details\s*\{[^}]*font-weight:\s*400/,
      )
      expect(CALENDAR_PDF_COMMON_STYLES).toMatch(/\.staff-coren-text\s*\{[^}]*font-weight:\s*400/)
      expect(CALENDAR_PDF_COMMON_STYLES).toMatch(/\.staff-time-text\s*\{[^}]*font-weight:\s*400/)
      expect(CALENDAR_PDF_COMMON_STYLES).toMatch(/\.staff-type-tag\s*\{[^}]*font-weight:\s*400/)

      // Regra 6: Tamanho de fonte conforme requisitos
      // Nomes de profissionais >= 10pt
      expect(CALENDAR_PDF_COMMON_STYLES).toMatch(/\.staff-entry-name\s*\{[^}]*font-size:\s*10pt/)
      // Cabeçalhos de dia >= 11pt
      expect(CALENDAR_PDF_COMMON_STYLES).toMatch(/\.day-cell-date\s*\{[^}]*font-size:\s*11pt/)
      // COREN e horários >= 9pt
      expect(CALENDAR_PDF_COMMON_STYLES).toMatch(/\.staff-entry-details\s*\{[^}]*font-size:\s*9pt/)
    })

    it('FALHA se qualquer elemento de conteúdo (nomes, COREN, horários, tipos) usar font-weight bold ou > 400', () => {
      // Teste específico anti-regressão exigido:
      // "Adicione teste que FALHE se o template usar negrito em campos de conteúdo"
      const contentClasses = [
        'staff-entry-name',
        'staff-coren-text',
        'staff-time-text',
        'staff-entry-details',
        'staff-type-tag',
        'legend-item',
      ]

      contentClasses.forEach((className) => {
        const classRegex = new RegExp(`\\.${className}\\s*\\{([^}]+)\\}`, 'g')
        const match = classRegex.exec(CALENDAR_PDF_COMMON_STYLES)
        expect(match, `Classe .${className} deve existir no CSS`).not.toBeNull()
        if (match) {
          const rules = match[1]
          expect(rules).not.toContain('font-weight: bold')
          expect(rules).not.toContain('font-weight: 700')
          expect(rules).not.toContain('font-weight: 800')
          expect(rules).not.toContain('font-weight: 900')
          expect(rules).toContain('font-weight: 400')
        }
      })
    })

    it('garante que não existem transform: scale, zoom ou coordenadas absolutas no conteúdo das células', () => {
      expect(CALENDAR_PDF_COMMON_STYLES).not.toContain('transform: scale')
      expect(CALENDAR_PDF_COMMON_STYLES).not.toContain('transform-origin')
      expect(CALENDAR_PDF_COMMON_STYLES).not.toContain('zoom:')
    })

    it('formatCompactStaffName preserva o nome completo sem truncar para iniciais', () => {
      const longName = 'Laodiceia da Silva Goes Dias'
      expect(formatCompactStaffName(longName)).toBe('Laodiceia da Silva Goes Dias')

      const secondName = 'Cristiane Santos Lopes de Oliveira'
      expect(formatCompactStaffName(secondName)).toBe('Cristiane Santos Lopes de Oliveira')
    })

    it('escapeHtml protege tags e caracteres especiais', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
      )
      expect(escapeHtml(null)).toBe('')
    })
  })

  describe('Requisitos de Layout Semanal Paginado: 1 semana por página e 7 colunas iguais', () => {
    it('renderiza exatamente 1 semana por página com 7 colunas iguais (14.285714%)', () => {
      const html = buildCalendarHtml({
        title: 'Escala Semanal UTI',
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

      expect(html).toContain('width: 14.285714%')
      expect(html).toContain('Semana 1 de 2')
      expect(html).toContain('Semana 2 de 2')
      expect(html).toContain('Dra. Roberta Andrade')
      expect(html).toContain('Enf. Juliana Souza')
      expect(html).toContain('CRM 123456-SP')
      expect(html).toContain('COREN 654321-SP')
      expect(html).toContain('tag-d')
      expect(html).toContain('tag-n')
      expect(html).toContain('tag-fds')
      expect(html).toContain('Folga Fim de Semana')
      expect(html).toContain('Página 1 de 2')
      expect(html).toContain('Página 2 de 2')
      expect(html).toContain('Beneficência Portuguesa de São Caetano do Sul')
    })
  })

  describe('Exportação jsPDF e Logotipo BPSCS', () => {
    it('renderHtmlToPdfLandscape instancia jsPDF em landscape e salva em A4', async () => {
      const doc = await renderHtmlToPdfLandscape('<div>Teste</div>', {
        title: 'Teste Landscape',
      })

      expect(doc).toBeInstanceOf(jsPDF)
      const pageInfo = doc.internal.pageSize
      expect(pageInfo.getWidth()).toBeGreaterThan(pageInfo.getHeight())
      expect(Math.round(pageInfo.getWidth())).toBe(297)
      expect(Math.round(pageInfo.getHeight())).toBe(210)
      expect(doc.getNumberOfPages()).toBe(1)
    })

    it('exportAutoGenerateCalendarPdf com returnDoc gera páginas em orientação landscape (largura > altura)', async () => {
      const doc = await exportAutoGenerateCalendarPdf({
        title: 'Escala Calendário Landscape Test',
        sectorName: 'UTI Geral',
        cycleStart: '2025-05-01',
        cycleEnd: '2025-05-31',
        days: mockDays,
        shifts: mockShifts,
        contracts: [],
        staffProfiles: mockStaff,
        weekendOffMap: mockWeekendOffMap,
        returnDoc: true,
      } as any)

      expect(doc).toBeDefined()
      const totalPages = (doc as any).getNumberOfPages()
      expect(totalPages).toBeGreaterThanOrEqual(1)

      for (let p = 1; p <= totalPages; p++) {
        ;(doc as any).setPage(p)
        const size = (doc as any).internal.pageSize
        const w = size.getWidth()
        const h = size.getHeight()
        expect(w).toBeGreaterThan(h) // Estritamente paisagem
        expect(Math.round(w)).toBe(297)
        expect(Math.round(h)).toBe(210)
      }
    })

    it('exportAutoGenerateCalendarPdf executa fluxo completo e salva com filename seguro', async () => {
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
    })

    it('o HTML gerado contém a tag img com logotipo institucional BPSCS no canto superior direito', () => {
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

  describe('Cenário Obrigatório: PS RESPIRATÓRIO (26/09/2026 a 25/10/2026) e Alta Densidade', () => {
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

    it('Gera as semanas do ciclo 26/09 a 25/10/2026 com continuação dedicada para o dia 08/10/2026', () => {
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
        {
          id: 'sp-cristiane',
          name: 'Cristiane Santos Lopes de Oliveira',
          professional_id: 'COREN 1928664',
          default_sector: 'sec-ps-resp',
        },
      ]

      // Dia 08/10/2026 com 5 plantonistas (> limite de 4 na célula semanal)
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
        {
          id: 'sh-5',
          staff_profile: 'sp-cristiane',
          start_time: '2026-10-08 19:00:00',
          end_time: '2026-10-09 07:00:00',
          expand: { staff_profile: staff[4] },
        },
      ]

      const weekendOffMap = new Map<string, Set<string>>()
      weekendOffMap.set('sp-laodiceia', new Set(['2026-10-03'])) // Sábado 03/10 folga FDS

      const { pages, maxChipsPerCell, templateData } = prepareCalendarMultiPageData({
        title: 'Escala de Plantões — Calendário Semanal',
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

      // 6 semanas no total no ciclo (26/09 a 25/10 abrange 6 semanas).
      // A semana com 08/10 tem 5 plantonistas no mesmo dia -> gera 2 páginas do tipo week (Parte 1 e Parte 2).
      // Total de páginas = 7 páginas, TODAS do tipo 'week', sem nenhuma 'continuation' ou 'day_continuation'.
      expect(templateData.weeks.length).toBe(6)
      expect(maxChipsPerCell).toBe(4)
      expect(pages.length).toBe(7)
      expect(pages.every((p) => p.pageType === 'week')).toBe(true)

      // Verifica tipos de páginas
      expect(pages[0].pageType).toBe('week')
      expect(pages[0].weekData?.weekIndex).toBe(1)
      expect(pages[0].weekData?.days.length).toBe(7)

      // Nenhuma página de continuação/day_continuation
      const contPage = pages.find(
        (p) => p.pageType === 'day_continuation' || p.pageType === 'continuation',
      )
      expect(contPage).toBeUndefined()

      // Semana com 08/10 dividida em Parte 1 e Parte 2
      const weekWith08OctPages = pages.filter((p) =>
        p.weekData?.days.some((d) => d?.dayFormatted === '08/10'),
      )
      expect(weekWith08OctPages.length).toBe(2)
      expect(weekWith08OctPages[0].weekData?.partIndex).toBe(1)
      expect(weekWith08OctPages[0].weekData?.partTotal).toBe(2)
      expect(weekWith08OctPages[1].weekData?.partIndex).toBe(2)
      expect(weekWith08OctPages[1].weekData?.partTotal).toBe(2)

      // Parte 1 tem 4 colaboradores em 08/10 e Parte 2 tem 1 colaborador em 08/10
      const dayPart1 = weekWith08OctPages[0].weekData?.days.find((d) => d?.dayFormatted === '08/10')
      const dayPart2 = weekWith08OctPages[1].weekData?.days.find((d) => d?.dayFormatted === '08/10')
      expect(dayPart1?.shifts.length).toBe(4)
      expect(dayPart2?.shifts.length).toBe(1)

      const fullHtml = buildCalendarHtml({
        title: 'Escala de Plantões — Calendário Semanal',
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

      // Presença de nomes COMPLETOS sem compressão dentro da grade
      expect(fullHtml).toContain('Laodiceia da Silva Goes Dias')
      expect(fullHtml).toContain('Marcia Ferreira Sales Silva')
      expect(fullHtml).toContain('Matheus Rodrigues Avelar')
      expect(fullHtml).toContain('Catia Aperecida da Silva Pirelli')
      expect(fullHtml).toContain('Cristiane Santos Lopes de Oliveira')

      // Presença dos registros COREN
      expect(fullHtml).toContain('COREN 9470010')
      expect(fullHtml).toContain('COREN 835384')
      expect(fullHtml).toContain('COREN 1911297')
      expect(fullHtml).toContain('COREN 538627')
      expect(fullHtml).toContain('COREN 1928664')

      // Título claro de semanas com partes
      expect(fullHtml).toContain('Semana 1 de 6')
      expect(fullHtml).toContain('Parte 1 de 2')
      expect(fullHtml).toContain('Parte 2 de 2')
      expect(fullHtml).toContain('Semana 6 de 6')

      // Sem tabelas de continuação
      expect(fullHtml).not.toContain('continuation-wrapper')
      expect(fullHtml).not.toContain('continuation-columns')
      expect(fullHtml).not.toContain('+1 profissional(is) na continuação')

      // Rodapé com numeração total
      expect(fullHtml).toContain('Página 1 de 7')
      expect(fullHtml).toContain('Página 7 de 7')
    })

    it('regressão de alta densidade semelhante à UTI 2 (dias com 20+ colaboradores): todas as páginas são week e sem continuação', () => {
      // Cria cenário com 24 colaboradores escalados no mesmo dia (ex: 26/10)
      const testDays = [
        {
          date: new Date(2026, 9, 26),
          key: '2026-10-26',
          dayOfWeek: 1, // segunda-feira
        },
      ]

      const denseStaff = Array.from({ length: 24 }, (_, i) => ({
        id: `sp-uti-${i + 1}`,
        name: `Colaborador UTI ${String(i + 1).padStart(2, '0')}`,
        professional_id: `COREN ${100000 + i}`,
      }))

      const denseShifts = denseStaff.map((st, i) => ({
        id: `sh-uti-${i + 1}`,
        staff_profile: st.id,
        start_time: '2026-10-26 07:00:00',
        end_time: '2026-10-26 19:00:00',
      }))

      const { pages } = prepareCalendarMultiPageData({
        title: 'Escala de Plantões — UTI 2',
        sectorName: 'UTI 2',
        cycleName: 'Ciclo 11/2026',
        cycleStart: '2026-10-26',
        cycleEnd: '2026-11-25',
        days: testDays,
        shifts: denseShifts,
        contracts: [],
        staffProfiles: denseStaff,
        weekendOffMap: new Map(),
      })

      // 24 colaboradores / 4 por página = 6 páginas para esta semana
      expect(pages.length).toBe(6)
      expect(pages.every((p) => p.pageType === 'week')).toBe(true)

      // Nenhuma página continuation/day_continuation
      const contPage = pages.find(
        (p) => p.pageType === 'day_continuation' || p.pageType === 'continuation',
      )
      expect(contPage).toBeUndefined()

      // Cada página tem partTotal = 6 e partIndex 1..6
      pages.forEach((p, idx) => {
        expect(p.weekData?.partTotal).toBe(6)
        expect(p.weekData?.partIndex).toBe(idx + 1)
        const dayCell = p.weekData?.days.find((d) => d?.dateKey === '2026-10-26')
        expect(dayCell).toBeDefined()
        expect(dayCell?.shifts.length).toBe(4)
      })

      // Todos os 24 nomes aparecem exatamente UMA vez na data correta (26/10)
      const namesCollected: string[] = []
      pages.forEach((p) => {
        const dayCell = p.weekData?.days.find((d) => d?.dateKey === '2026-10-26')
        dayCell?.shifts.forEach((s) => namesCollected.push(s.name))
      })
      expect(namesCollected.length).toBe(24)
      expect(new Set(namesCollected).size).toBe(24)
      denseStaff.forEach((st) => {
        expect(namesCollected).toContain(st.name)
      })

      const html = buildCalendarHtml({
        title: 'Escala de Plantões — UTI 2',
        sectorName: 'UTI 2',
        cycleName: 'Ciclo 11/2026',
        cycleStart: '2026-10-26',
        cycleEnd: '2026-11-25',
        days: testDays,
        shifts: denseShifts,
        contracts: [],
        staffProfiles: denseStaff,
        weekendOffMap: new Map(),
      })

      // Cabeçalhos com Parte 1 de 6 .. Parte 6 de 6
      expect(html).toContain('Parte 1 de 6')
      expect(html).toContain('Parte 6 de 6')
      expect(html).not.toContain('+20')
      expect(html).not.toContain('continuation-wrapper')
      expect(html).not.toContain('na continuação')
    })
  })
})
