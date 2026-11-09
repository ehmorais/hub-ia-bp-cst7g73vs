import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  CALENDAR_PDF_COMMON_STYLES,
  CALENDAR_PDF_HTML_TEMPLATE,
  CALENDAR_CELL_CAPACITY,
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
      // A semana com 08/10 tem 5 plantonistas no mesmo dia -> cabem na capacidade de 15 da célula.
      // Total de páginas = 6 páginas (1 por semana), TODAS do tipo 'week', sem nenhuma 'continuation' ou 'day_continuation'.
      expect(templateData.weeks.length).toBe(6)
      expect(maxChipsPerCell).toBe(CALENDAR_CELL_CAPACITY)
      expect(CALENDAR_CELL_CAPACITY).toBe(15)
      expect(pages.length).toBe(6)
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

      // Semana com 08/10 (5 colaboradores <= 15) cabe integralmente em 1 página (partTotal 1)
      const weekWith08OctPages = pages.filter((p) =>
        p.weekData?.days.some((d) => d?.dayFormatted === '08/10'),
      )
      expect(weekWith08OctPages.length).toBe(1)
      expect(weekWith08OctPages[0].weekData?.partTotal ?? 1).toBe(1)

      // Todos os 5 colaboradores constam na célula do dia 08/10
      const dayCell = weekWith08OctPages[0].weekData?.days.find((d) => d?.dayFormatted === '08/10')
      expect(dayCell?.shifts.length).toBe(5)

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

      // Semanas 1 a 6
      expect(fullHtml).toContain('Semana 1 de 6')
      expect(fullHtml).toContain('Semana 6 de 6')

      // Sem tabelas de continuação
      expect(fullHtml).not.toContain('continuation-wrapper')
      expect(fullHtml).not.toContain('continuation-columns')
      expect(fullHtml).not.toContain('+1 profissional(is) na continuação')

      // Rodapé com numeração total: 6 páginas no total
      expect(fullHtml).toContain('Página 1 de 6')
      expect(fullHtml).toContain('Página 6 de 6')
    })

    it('regressão de alta densidade semelhante à UTI 2 (dias com 24 colaboradores): com capacidade física 15, divide em 2 partes (15 + 9)', () => {
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

      // 24 colaboradores / 15 por página = ceil(24/15) = 2 páginas para esta semana
      expect(pages.length).toBe(2)
      expect(pages.every((p) => p.pageType === 'week')).toBe(true)

      // Nenhuma página continuation/day_continuation
      const contPage = pages.find(
        (p) => p.pageType === 'day_continuation' || p.pageType === 'continuation',
      )
      expect(contPage).toBeUndefined()

      // Cada página tem partTotal = 2 e partIndex 1..2
      expect(pages[0].weekData?.partTotal).toBe(2)
      expect(pages[0].weekData?.partIndex).toBe(1)
      expect(pages[1].weekData?.partTotal).toBe(2)
      expect(pages[1].weekData?.partIndex).toBe(2)

      const dayCellP1 = pages[0].weekData?.days.find((d) => d?.dateKey === '2026-10-26')
      const dayCellP2 = pages[1].weekData?.days.find((d) => d?.dateKey === '2026-10-26')
      expect(dayCellP1?.shifts.length).toBe(15)
      expect(dayCellP2?.shifts.length).toBe(9)

      // Todos os 24 nomes aparecem exatamente UMA vez na data correta (26/10)
      const namesCollected: string[] = []
      pages.forEach((p) => {
        const dCell = p.weekData?.days.find((d) => d?.dateKey === '2026-10-26')
        dCell?.shifts.forEach((s) => namesCollected.push(s.name))
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

      // Cabeçalhos com Parte 1 de 2 e Parte 2 de 2
      expect(html).toContain('Parte 1 de 2')
      expect(html).toContain('Parte 2 de 2')
      expect(html).not.toContain('+20')
      expect(html).not.toContain('continuation-wrapper')
      expect(html).not.toContain('na continuação')
    })

    describe('Centro Cirúrgico e Capacidade Física de 15 Cartões — Regras Estritas', () => {
      it('(a) 15 itens cobrindo os seis grupos cabem em 1 única página week', () => {
        const testDays = [
          {
            date: new Date(2026, 9, 10), // 10/10/2026 Sábado
            key: '2026-10-10',
            dayOfWeek: 6,
          },
        ]

        // 15 colaboradores cobrindo os 6 grupos:
        // a) 3 plantonistas diurnos
        // b) 2 folgas diurnas
        // c) 2 férias diurnas
        // d) 3 plantonistas noturnos
        // e) 2 folgas noturnas
        // f) 3 férias noturnas
        // Total = 3 + 2 + 2 + 3 + 2 + 3 = 15
        const staffProfiles = [
          // Grupo a (D escalados): D1, D2, D3
          { id: 'sp-d1', name: 'Alana Diurno', professional_id: 'COREN 101' },
          { id: 'sp-d2', name: 'Bruna Diurno', professional_id: 'COREN 102' },
          { id: 'sp-d3', name: 'Carlos Diurno', professional_id: 'COREN 103' },
          // Grupo b (D folga): D4, D5
          { id: 'sp-d4', name: 'Daniela Folga D', professional_id: 'COREN 104' },
          { id: 'sp-d5', name: 'Eduardo Folga D', professional_id: 'COREN 105' },
          // Grupo c (D férias): D6, D7
          {
            id: 'sp-d6',
            name: 'Fabiana Férias D',
            professional_id: 'COREN 106',
            vacation_enabled: true,
            vacation_start: '2026-10-01',
            vacation_end: '2026-10-20',
          },
          {
            id: 'sp-d7',
            name: 'Gabriel Férias D',
            professional_id: 'COREN 107',
            vacation_enabled: true,
            vacation_start: '2026-10-01',
            vacation_end: '2026-10-20',
          },
          // Grupo d (N escalados): N1, N2, N3
          { id: 'sp-n1', name: 'Helena Noturno', professional_id: 'COREN 201' },
          { id: 'sp-n2', name: 'Igor Noturno', professional_id: 'COREN 202' },
          { id: 'sp-n3', name: 'Juliana Noturno', professional_id: 'COREN 203' },
          // Grupo e (N folga): N4, N5
          { id: 'sp-n4', name: 'Kleber Folga N', professional_id: 'COREN 204' },
          { id: 'sp-n5', name: 'Larissa Folga N', professional_id: 'COREN 205' },
          // Grupo f (N férias): N6, N7, N8
          {
            id: 'sp-n6',
            name: 'Marcos Férias N',
            professional_id: 'COREN 206',
            vacation_enabled: true,
            vacation_start: '2026-10-01',
            vacation_end: '2026-10-20',
          },
          {
            id: 'sp-n7',
            name: 'Natália Férias N',
            professional_id: 'COREN 207',
            vacation_enabled: true,
            vacation_start: '2026-10-01',
            vacation_end: '2026-10-20',
          },
          {
            id: 'sp-n8',
            name: 'Otávio Férias N',
            professional_id: 'COREN 208',
            vacation_enabled: true,
            vacation_start: '2026-10-01',
            vacation_end: '2026-10-20',
          },
        ]

        const contracts = [
          // D contracts
          {
            staff_profile: 'sp-d1',
            shift_type_detail: { name: '12X36D', start_time: '07:00', end_time: '19:00' },
          },
          {
            staff_profile: 'sp-d2',
            shift_type_detail: { name: '12X36D', start_time: '07:00', end_time: '19:00' },
          },
          {
            staff_profile: 'sp-d3',
            shift_type_detail: { name: '12X36D', start_time: '07:00', end_time: '19:00' },
          },
          {
            staff_profile: 'sp-d4',
            shift_type_detail: { name: '12X36D', start_time: '07:00', end_time: '19:00' },
          },
          {
            staff_profile: 'sp-d5',
            shift_type_detail: { name: '12X36D', start_time: '07:00', end_time: '19:00' },
          },
          {
            staff_profile: 'sp-d6',
            shift_type_detail: { name: '12X36D', start_time: '07:00', end_time: '19:00' },
          },
          {
            staff_profile: 'sp-d7',
            shift_type_detail: { name: '12X36D', start_time: '07:00', end_time: '19:00' },
          },
          // N contracts
          {
            staff_profile: 'sp-n1',
            shift_type_detail: { name: '12X36N', start_time: '19:00', end_time: '07:00' },
          },
          {
            staff_profile: 'sp-n2',
            shift_type_detail: { name: '12X36N', start_time: '19:00', end_time: '07:00' },
          },
          {
            staff_profile: 'sp-n3',
            shift_type_detail: { name: '12X36N', start_time: '19:00', end_time: '07:00' },
          },
          {
            staff_profile: 'sp-n4',
            shift_type_detail: { name: '12X36N', start_time: '19:00', end_time: '07:00' },
          },
          {
            staff_profile: 'sp-n5',
            shift_type_detail: { name: '12X36N', start_time: '19:00', end_time: '07:00' },
          },
          {
            staff_profile: 'sp-n6',
            shift_type_detail: { name: '12X36N', start_time: '19:00', end_time: '07:00' },
          },
          {
            staff_profile: 'sp-n7',
            shift_type_detail: { name: '12X36N', start_time: '19:00', end_time: '07:00' },
          },
          {
            staff_profile: 'sp-n8',
            shift_type_detail: { name: '12X36N', start_time: '19:00', end_time: '07:00' },
          },
        ]

        // Shifts for D1, D2, D3 and N1, N2, N3
        const shifts = [
          {
            id: 'sh-1',
            staff_profile: 'sp-d1',
            start_time: '2026-10-10 07:00:00',
            end_time: '2026-10-10 19:00:00',
          },
          {
            id: 'sh-2',
            staff_profile: 'sp-d2',
            start_time: '2026-10-10 07:00:00',
            end_time: '2026-10-10 19:00:00',
          },
          {
            id: 'sh-3',
            staff_profile: 'sp-d3',
            start_time: '2026-10-10 07:00:00',
            end_time: '2026-10-10 19:00:00',
          },
          {
            id: 'sh-4',
            staff_profile: 'sp-n1',
            start_time: '2026-10-10 19:00:00',
            end_time: '2026-10-11 07:00:00',
          },
          {
            id: 'sh-5',
            staff_profile: 'sp-n2',
            start_time: '2026-10-10 19:00:00',
            end_time: '2026-10-11 07:00:00',
          },
          {
            id: 'sh-6',
            staff_profile: 'sp-n3',
            start_time: '2026-10-10 19:00:00',
            end_time: '2026-10-11 07:00:00',
          },
        ]

        // Weekend off for D4, D5 and N4, N5
        const weekendOffMap = new Map<string, Set<string>>()
        weekendOffMap.set('sp-d4', new Set(['2026-10-10']))
        weekendOffMap.set('sp-d5', new Set(['2026-10-10']))
        weekendOffMap.set('sp-n4', new Set(['2026-10-10']))
        weekendOffMap.set('sp-n5', new Set(['2026-10-10']))

        const { pages } = prepareCalendarMultiPageData({
          title: 'Escala Centro Cirúrgico',
          sectorName: 'CC - Centro Cirúrgico',
          cycleName: 'Outubro 2026',
          cycleStart: '2026-10-10',
          cycleEnd: '2026-10-10',
          days: testDays,
          shifts,
          contracts,
          staffProfiles,
          weekendOffMap,
        })

        // EXATAMENTE 1 PÁGINA (15 itens cabem inteiros)
        expect(pages.length).toBe(1)
        expect(pages[0].pageType).toBe('week')
        expect(pages[0].weekData?.partTotal).toBe(1)
        expect(pages[0].weekData?.partIndex).toBe(1)

        const dayCell = pages[0].weekData?.days.find((d) => d?.dateKey === '2026-10-10')
        expect(dayCell?.shifts.length).toBe(15)

        // Ordem estrita dos 6 grupos verificada:
        // a) D escalados (3)
        expect(dayCell?.shifts[0].name).toBe('Alana Diurno')
        expect(dayCell?.shifts[1].name).toBe('Bruna Diurno')
        expect(dayCell?.shifts[2].name).toBe('Carlos Diurno')
        // b) D folga (2)
        expect(dayCell?.shifts[3].name).toBe('Daniela Folga D')
        expect(dayCell?.shifts[4].name).toBe('Eduardo Folga D')
        // c) D férias (2)
        expect(dayCell?.shifts[5].name).toBe('Fabiana Férias D')
        expect(dayCell?.shifts[6].name).toBe('Gabriel Férias D')
        // d) N escalados (3)
        expect(dayCell?.shifts[7].name).toBe('Helena Noturno')
        expect(dayCell?.shifts[8].name).toBe('Igor Noturno')
        expect(dayCell?.shifts[9].name).toBe('Juliana Noturno')
        // e) N folga (2)
        expect(dayCell?.shifts[10].name).toBe('Kleber Folga N')
        expect(dayCell?.shifts[11].name).toBe('Larissa Folga N')
        // f) N férias (3)
        expect(dayCell?.shifts[12].name).toBe('Marcos Férias N')
        expect(dayCell?.shifts[13].name).toBe('Natália Férias N')
        expect(dayCell?.shifts[14].name).toBe('Otávio Férias N')
      })

      it('(b) 16 itens geram exatamente 2 páginas week com 15 + 1 (nunca 4 + 12 nem continuação)', () => {
        const testDays = [
          {
            date: new Date(2026, 9, 10),
            key: '2026-10-10',
            dayOfWeek: 6,
          },
        ]

        // 16 colaboradores escalados no mesmo dia
        const staffProfiles = Array.from({ length: 16 }, (_, i) => ({
          id: `sp-cc-${i + 1}`,
          name: `Profissional CC ${String(i + 1).padStart(2, '0')}`,
          professional_id: `COREN ${200000 + i}`,
        }))

        const contracts = staffProfiles.map((sp) => ({
          staff_profile: sp.id,
          shift_type_detail: { name: '12X36D', start_time: '07:00', end_time: '19:00' },
        }))

        const shifts = staffProfiles.map((sp) => ({
          id: `sh-${sp.id}`,
          staff_profile: sp.id,
          start_time: '2026-10-10 07:00:00',
          end_time: '2026-10-10 19:00:00',
        }))

        const { pages } = prepareCalendarMultiPageData({
          title: 'Escala Centro Cirúrgico',
          sectorName: 'CC - Centro Cirúrgico',
          cycleName: 'Outubro 2026',
          cycleStart: '2026-10-10',
          cycleEnd: '2026-10-10',
          days: testDays,
          shifts,
          contracts,
          staffProfiles,
          weekendOffMap: new Map(),
        })

        // Exatamente 2 páginas, ambas 'week' (NUNCA continuation)
        expect(pages.length).toBe(2)
        expect(pages.every((p) => p.pageType === 'week')).toBe(true)
        expect(pages[0].weekData?.partTotal).toBe(2)
        expect(pages[0].weekData?.partIndex).toBe(1)
        expect(pages[1].weekData?.partTotal).toBe(2)
        expect(pages[1].weekData?.partIndex).toBe(2)

        // Divisão estrita 15 + 1 (NUNCA 4 + 12)
        const cellP1 = pages[0].weekData?.days.find((d) => d?.dateKey === '2026-10-10')
        const cellP2 = pages[1].weekData?.days.find((d) => d?.dateKey === '2026-10-10')
        expect(cellP1?.shifts.length).toBe(15)
        expect(cellP2?.shifts.length).toBe(1)
        expect(cellP2?.shifts[0].name).toBe('Profissional CC 16')
      })

      it('(c) fila única contínua preserva ordem e não reagrupa por categoria entre páginas', () => {
        const testDays = [
          {
            date: new Date(2026, 9, 10),
            key: '2026-10-10',
            dayOfWeek: 6,
          },
        ]

        // 17 colaboradores: 10 D escalados, 7 N escalados
        // Parte 1 (capacidade 15) deve receber: 10 D escalados + primeiros 5 N escalados
        // Parte 2 deve receber: restantes 2 N escalados (continuidade da fila única)
        const staffD = Array.from({ length: 10 }, (_, i) => ({
          id: `sp-d-${i + 1}`,
          name: `Diurno ${String.fromCharCode(65 + i)}`,
          professional_id: `COREN ${1000 + i}`,
        }))

        const staffN = Array.from({ length: 7 }, (_, i) => ({
          id: `sp-n-${i + 1}`,
          name: `Noturno ${String.fromCharCode(65 + i)}`,
          professional_id: `COREN ${2000 + i}`,
        }))

        const allStaff = [...staffD, ...staffN]

        const contracts = [
          ...staffD.map((sp) => ({
            staff_profile: sp.id,
            shift_type_detail: { name: '12X36D', start_time: '07:00', end_time: '19:00' },
          })),
          ...staffN.map((sp) => ({
            staff_profile: sp.id,
            shift_type_detail: { name: '12X36N', start_time: '19:00', end_time: '07:00' },
          })),
        ]

        const shifts = [
          ...staffD.map((sp) => ({
            id: `sh-${sp.id}`,
            staff_profile: sp.id,
            start_time: '2026-10-10 07:00:00',
            end_time: '2026-10-10 19:00:00',
          })),
          ...staffN.map((sp) => ({
            id: `sh-${sp.id}`,
            staff_profile: sp.id,
            start_time: '2026-10-10 19:00:00',
            end_time: '2026-10-11 07:00:00',
          })),
        ]

        const { pages } = prepareCalendarMultiPageData({
          title: 'Escala Centro Cirúrgico',
          sectorName: 'CC - Centro Cirúrgico',
          cycleName: 'Outubro 2026',
          cycleStart: '2026-10-10',
          cycleEnd: '2026-10-10',
          days: testDays,
          shifts,
          contracts,
          staffProfiles: allStaff,
          weekendOffMap: new Map(),
        })

        expect(pages.length).toBe(2)
        const cellP1 = pages[0].weekData?.days.find((d) => d?.dateKey === '2026-10-10')
        const cellP2 = pages[1].weekData?.days.find((d) => d?.dateKey === '2026-10-10')

        expect(cellP1?.shifts.length).toBe(15)
        expect(cellP2?.shifts.length).toBe(2)

        // P1 tem todos os 10 Diurnos + primeiros 5 Noturnos
        expect(cellP1?.shifts.slice(0, 10).map((s) => s.periodLetter)).toEqual(Array(10).fill('D'))
        expect(cellP1?.shifts.slice(10, 15).map((s) => s.periodLetter)).toEqual(Array(5).fill('N'))
        expect(cellP1?.shifts[14].name).toBe('Noturno E')

        // P2 tem os 2 Noturnos restantes como continuação exata da fila única
        expect(cellP2?.shifts[0].name).toBe('Noturno F')
        expect(cellP2?.shifts[1].name).toBe('Noturno G')
        expect(cellP2?.shifts.map((s) => s.periodLetter)).toEqual(['N', 'N'])
      })
    })
  })
})
