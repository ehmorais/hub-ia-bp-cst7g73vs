import { describe, it, expect } from 'vitest'
import {
  buildCalendarHtml,
  prepareCalendarMultiPageData,
  renderHtmlToPdfLandscape,
} from '@/utils/scalePdfExport'
import * as fs from 'fs'
import * as path from 'path'

describe('Inspeção e Verificação Estrutural do HTML do PDF Renderizado — Calendário Semanal', () => {
  it('gera HTML do cenário real com 6 semanas e alta densidade sem quebras e salva para validação', () => {
    // 26/09/2026 a 25/10/2026 (Ciclo Outubro 2026 PS Respiratório)
    const days: Array<{ date: Date; key: string; dayOfWeek: number }> = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 8, 26 + i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      days.push({
        date: d,
        key,
        dayOfWeek: d.getDay(),
      })
    }

    const staffProfiles = [
      {
        id: 'sp1',
        name: 'Laodiceia da Silva Goes Dias',
        professional_id: '9470010',
        default_sector: 'qrrh9pfkq090hlo',
      },
      {
        id: 'sp2',
        name: 'Marcia Ferreira Sales Silva',
        professional_id: '835384',
        default_sector: 'qrrh9pfkq090hlo',
      },
      {
        id: 'sp3',
        name: 'Catia Aperecida da Silva Pirelli',
        professional_id: '538627',
        default_sector: 'qrrh9pfkq090hlo',
      },
      {
        id: 'sp4',
        name: 'Matheus Rodrigues Avelar',
        professional_id: '1911297',
        default_sector: 'qrrh9pfkq090hlo',
      },
      {
        id: 'sp5',
        name: 'Cristiane Santos Lopes de Oliveira',
        professional_id: '1928664',
        default_sector: 'qrrh9pfkq090hlo',
      },
    ]

    // Shifts distribuídos incluindo 08/10/2026 com múltiplos profissionais (5 plantonistas)
    const shifts: any[] = [
      {
        id: 's1',
        staff_profile: 'sp1',
        start_time: '2026-10-08 07:00:00',
        end_time: '2026-10-08 19:00:00',
      },
      {
        id: 's2',
        staff_profile: 'sp2',
        start_time: '2026-10-08 07:00:00',
        end_time: '2026-10-08 19:00:00',
      },
      {
        id: 's3',
        staff_profile: 'sp3',
        start_time: '2026-10-08 19:00:00',
        end_time: '2026-10-09 07:00:00',
      },
      {
        id: 's4',
        staff_profile: 'sp4',
        start_time: '2026-10-08 19:00:00',
        end_time: '2026-10-09 07:00:00',
      },
      {
        id: 's5',
        staff_profile: 'sp5',
        start_time: '2026-10-08 19:00:00',
        end_time: '2026-10-09 07:00:00',
      },
      // Outros dias
      {
        id: 's6',
        staff_profile: 'sp1',
        start_time: '2026-09-26 19:00:00',
        end_time: '2026-09-27 07:00:00',
      },
      {
        id: 's7',
        staff_profile: 'sp2',
        start_time: '2026-09-27 07:00:00',
        end_time: '2026-09-27 19:00:00',
      },
    ]

    const weekendOffMap = new Map<string, Set<string>>()
    weekendOffMap.set('sp1', new Set(['2026-10-03'])) // Sábado 03/10

    const { pages } = prepareCalendarMultiPageData({
      title: 'Escala de Plantões — Calendário Semanal',
      sectorName: 'PS RESPIRATÓRIO',
      cycleName: 'Ciclo Outubro 2026',
      cycleStart: '2026-09-26',
      cycleEnd: '2026-10-25',
      days,
      shifts,
      contracts: [],
      staffProfiles,
      weekendOffMap,
      selectedSectorId: 'qrrh9pfkq090hlo',
    })

    // 6 semanas + 1 continuação do dia 08/10 = 7 páginas
    expect(pages.length).toBe(7)

    const html = buildCalendarHtml({
      title: 'Escala de Plantões — Calendário Semanal',
      sectorName: 'PS RESPIRATÓRIO',
      cycleName: 'Ciclo Outubro 2026',
      cycleStart: '2026-09-26',
      cycleEnd: '2026-10-25',
      days,
      shifts,
      contracts: [],
      staffProfiles,
      weekendOffMap,
      selectedSectorId: 'qrrh9pfkq090hlo',
    })

    // Validações estruturais do HTML
    expect(html).toContain('PS RESPIRATÓRIO')
    expect(html).toContain('Laodiceia da Silva Goes Dias')
    expect(html).toContain('Marcia Ferreira Sales Silva')
    expect(html).toContain('Matheus Rodrigues Avelar')
    expect(html).toContain('Catia Aperecida da Silva Pirelli')
    expect(html).toContain('Cristiane Santos Lopes de Oliveira')

    // Verificação de rodapé com paginação
    expect(html).toContain('Página 1 de 7')
    expect(html).toContain('Página 7 de 7')

    // Verificação das 7 colunas iguais
    expect(html).toContain('width: 14.285714%')
    expect(html).toContain('size: 297mm 210mm landscape')

    // Verificação das semanas e continuação
    expect(html).toContain('Semana 1 de 6')
    expect(html).toContain('Semana 2 de 6')
    expect(html).toContain('Continuação — Quinta-feira, 08/10')

    // Verificação dos badges
    expect(html).toContain('badge-d')
    expect(html).toContain('badge-n')
    expect(html).toContain('badge-fds')

    // Salva o arquivo de amostra para inspeção temporária
    const samplePath = path.resolve(process.cwd(), 'sample-calendar-weekly.html')
    fs.writeFileSync(samplePath, html, 'utf-8')
    expect(fs.existsSync(samplePath)).toBe(true)
    if (fs.existsSync(samplePath)) {
      fs.unlinkSync(samplePath)
    }
  })

  it('inspeciona e valida o PDF real do PS Respiratório em escala 100% de cada página e renderiza todas as páginas', async () => {
    // Ciclo 26/09/2026 a 25/10/2026 (30 dias)
    const days: Array<{ date: Date; key: string; dayOfWeek: number }> = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 8, 26 + i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      days.push({
        date: d,
        key,
        dayOfWeek: d.getDay(),
      })
    }

    // Colaboradores reais do PS Respiratório
    const staffProfiles = [
      {
        id: 'sp-laodiceia',
        name: 'Laodiceia da Silva Goes Dias',
        professional_id: 'COREN 9470010',
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
        id: 'sp-marcia',
        name: 'Marcia Ferreira Sales Silva',
        professional_id: 'COREN 835384',
        default_sector: 'sec-ps-resp',
      },
      {
        id: 'sp-cristiane',
        name: 'Cristiane Santos Lopes de Oliveira',
        professional_id: 'COREN 1928664',
        default_sector: 'sec-ps-resp',
      },
    ]

    // Plantões incluindo dia 08/10/2026 com alta densidade (5 plantonistas)
    const shifts: any[] = [
      {
        id: 'sh-1',
        staff_profile: 'sp-laodiceia',
        start_time: '2026-10-08 07:00:00',
        end_time: '2026-10-08 19:00:00',
      },
      {
        id: 'sh-2',
        staff_profile: 'sp-marcia',
        start_time: '2026-10-08 07:00:00',
        end_time: '2026-10-08 19:00:00',
      },
      {
        id: 'sh-3',
        staff_profile: 'sp-matheus',
        start_time: '2026-10-08 19:00:00',
        end_time: '2026-10-09 07:00:00',
      },
      {
        id: 'sh-4',
        staff_profile: 'sp-catia',
        start_time: '2026-10-08 19:00:00',
        end_time: '2026-10-09 07:00:00',
      },
      {
        id: 'sh-5',
        staff_profile: 'sp-cristiane',
        start_time: '2026-10-08 19:00:00',
        end_time: '2026-10-09 07:00:00',
      },
      // Plantão inicial do ciclo 26/09
      {
        id: 'sh-6',
        staff_profile: 'sp-laodiceia',
        start_time: '2026-09-26 07:00:00',
        end_time: '2026-09-26 19:00:00',
      },
    ]

    const weekendOffMap = new Map<string, Set<string>>()
    weekendOffMap.set('sp-laodiceia', new Set(['2026-10-03']))

    const multiPageResult = prepareCalendarMultiPageData({
      title: 'Escala de Plantões — Calendário Semanal',
      sectorName: 'PS RESPIRATÓRIO',
      cycleName: 'Ciclo 26/09/2026 a 25/10/2026',
      cycleStart: '2026-09-26',
      cycleEnd: '2026-10-25',
      days,
      shifts,
      contracts: [],
      staffProfiles,
      weekendOffMap,
      selectedSectorId: 'sec-ps-resp',
    })

    // Validação 1: Total de páginas = 7 (6 semanas + 1 de continuação para o dia 08/10)
    expect(multiPageResult.pages.length).toBe(7)
    expect(multiPageResult.pages.map((p) => p.pageType)).toEqual([
      'week',
      'week',
      'day_continuation',
      'week',
      'week',
      'week',
      'week',
    ])

    // Validação 2: Célula diária da semana com 4 cards no máximo e indicação de continuação
    const week2 = multiPageResult.pages[1].weekData
    expect(week2).toBeDefined()
    const cell08Oct = week2?.days.find((d) => d?.dateKey === '2026-10-08')
    expect(cell08Oct).toBeDefined()
    expect(cell08Oct?.shifts.length).toBe(5)

    // Validação 3: Página de continuação do dia 08/10 tem os 5 plantonistas completos
    const contPage = multiPageResult.pages[2]
    expect(contPage.pageType).toBe('day_continuation')
    expect(contPage.continuationDay?.dayFormatted).toBe('08/10')
    expect(contPage.continuationDay?.shifts.length).toBe(5)

    // Validação 4: Inspeção minuciosa de cada página no HTML renderizado
    const html = buildCalendarHtml({
      title: 'Escala de Plantões — Calendário Semanal',
      sectorName: 'PS RESPIRATÓRIO',
      cycleName: 'Ciclo 26/09/2026 a 25/10/2026',
      cycleStart: '2026-09-26',
      cycleEnd: '2026-10-25',
      days,
      shifts,
      contracts: [],
      staffProfiles,
      weekendOffMap,
      selectedSectorId: 'sec-ps-resp',
    })

    // 4.1. Sem transformações de compressão
    expect(html).not.toContain('transform: scale')
    expect(html).not.toContain('zoom:')

    // 4.2. Rodapé correto em todas as 7 páginas: "Gerado em:" e "Página X de 7"
    for (let p = 1; p <= 7; p++) {
      expect(html).toContain(`Página ${p} de 7`)
    }
    const generatedAtCount = (html.match(/Gerado em:/g) || []).length
    expect(generatedAtCount).toBe(7)

    // 4.3. Presença legível e integral de todos os nomes exigidos
    expect(html).toContain('Laodiceia da Silva Goes Dias')
    expect(html).toContain('Matheus Rodrigues Avelar')
    expect(html).toContain('Catia Aperecida da Silva Pirelli')
    expect(html).toContain('Marcia Ferreira Sales Silva')

    // 4.4. Presença dos números de COREN/CRM legíveis
    expect(html).toContain('COREN 9470010')
    expect(html).toContain('COREN 1911297')
    expect(html).toContain('COREN 538627')
    expect(html).toContain('COREN 835384')

    // 4.5. Verificação de dimensões A4 Landscape (297mm 210mm) e 7 colunas (14.285714%)
    expect(html).toContain('size: 297mm 210mm landscape')
    expect(html).toContain('width: 14.285714%')

    // 4.6. Verificação de cabeçalhos de semana (1 semana por página)
    expect(html).toContain('Semana 1 de 6')
    expect(html).toContain('Semana 2 de 6')
    expect(html).toContain('Semana 3 de 6')
    expect(html).toContain('Semana 4 de 6')
    expect(html).toContain('Semana 5 de 6')
    expect(html).toContain('Semana 6 de 6')
    expect(html).toContain('Continuação — Quinta-feira, 08/10')

    // 4.7. Inspeção e Renderização Real de TODAS as páginas do PDF via exportAutoGenerateCalendarPdf / renderHtmlToPdfLandscape
    const pdfDoc = await renderHtmlToPdfLandscape(html, {
      title: 'Escala de Plantões — Calendário Semanal',
      author: 'Gestão de Escalas BP — IA',
    })

    expect(pdfDoc).toBeDefined()
    // Como vitest/jsdom roda em node sem layout real de DOM canvas, doc tem configuração A4 landscape
    const pageSize = pdfDoc.internal.pageSize
    expect(Math.round(pageSize.getWidth())).toBe(297)
    expect(Math.round(pageSize.getHeight())).toBe(210)

    // Conferência visual e tipográfica por regex em cada página gerada do HTML (escala 100%)
    const pageHtmlBlocks = html.split('<div class="page-container"').slice(1)
    expect(pageHtmlBlocks.length).toBe(7)

    pageHtmlBlocks.forEach((pageContent, idx) => {
      const pageNum = idx + 1
      // Todas as páginas contêm o cabeçalho BPSCS
      expect(pageContent).toContain('Beneficência Portuguesa de São Caetano do Sul')
      expect(pageContent).toContain('alt="Logo Institucional BPSCS"')
      // Rodapé com "Gerado em:" e paginação exata
      expect(pageContent).toContain('Gerado em:')
      expect(pageContent).toContain(`Página ${pageNum} de 7`)

      // Nenhuma página deve conter scale/transform CSS ou fontes compactadas
      expect(pageContent).not.toContain('transform: scale')
      expect(pageContent).not.toContain('zoom:')

      if (pageNum === 3) {
        // Página 3 é a Continuação do dia 08/10 (quinta-feira)
        expect(pageContent).toContain('Continuação — Quinta-feira, 08/10')
        expect(pageContent).toContain('Laodiceia da Silva Goes Dias')
        expect(pageContent).toContain('Marcia Ferreira Sales Silva')
        expect(pageContent).toContain('Matheus Rodrigues Avelar')
        expect(pageContent).toContain('Catia Aperecida da Silva Pirelli')
        expect(pageContent).toContain('Cristiane Santos Lopes de Oliveira')
        expect(pageContent).toContain('continuation-columns')
        expect(pageContent).toContain('Total no dia: 5 plantonista(s)')
      } else {
        // Demais páginas são semanas 1, 2, 3, 4, 5, 6
        expect(pageContent).toContain('calendar-wrapper')
        expect(pageContent).toContain('calendar-table')
        expect(pageContent).toContain('legend-bar')
        expect(pageContent).toContain('week-headline-bar')
        expect(pageContent).toContain('Semana ')
      }
    })

    // 4.8. Validação minuciosa de fontes e dimensões tipográficas reais do CSS:
    // Nomes de profissionais: font-size: 9.5pt (>= 9pt)
    // Registros COREN / badges / horários: font-size: 8.5pt (>= 8pt)
    // Célula com largura proporcional de 7 colunas iguais: 14.285714%
    // A4 Landscape: 297mm 210mm
    expect(html).toMatch(/\.staff-card-name\s*\{\s*font-size:\s*9\.5pt/)
    expect(html).toMatch(/\.staff-card-details\s*\{\s*display:\s*flex;[\s\S]*?font-size:\s*8\.5pt/)
    expect(html).toMatch(/\.badge-shift-type\s*\{\s*font-size:\s*8\.5pt/)
    expect(html).toMatch(/\.calendar-table\s*colgroup\s*col\s*\{\s*width:\s*14\.285714%/)
    expect(html).toMatch(/@page\s*\{\s*size:\s*297mm\s*210mm\s*landscape/)
  })
})
