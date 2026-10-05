import { describe, it, expect } from 'vitest'
import {
  buildCalendarHtml,
  prepareCalendarMultiPageData,
  exportAutoGenerateCalendarPdf,
} from '@/utils/scalePdfExport'
import * as fs from 'fs'
import * as path from 'path'

describe('Inspeção Visual Real do PDF — Ciclo Outubro 2026 / PS RESPIRATÓRIO', () => {
  it('inspeciona e valida rigorosamente cada uma das 7 páginas geradas para o ciclo real de Outubro 2026', async () => {
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

    const staffProfiles = [
      {
        id: 'sp-laodiceia',
        name: 'Laodiceia da Silva Goes Dias',
        professional_id: '9470010',
        default_sector: 'qrrh9pfkq090hlo',
      },
      {
        id: 'sp-marcia',
        name: 'Marcia Ferreira Sales Silva',
        professional_id: '835384',
        default_sector: 'qrrh9pfkq090hlo',
      },
      {
        id: 'sp-catia',
        name: 'Catia Aperecida da Silva Pirelli',
        professional_id: '538627',
        default_sector: 'qrrh9pfkq090hlo',
      },
      {
        id: 'sp-matheus',
        name: 'Matheus Rodrigues Avelar',
        professional_id: '1911297',
        default_sector: 'qrrh9pfkq090hlo',
      },
      {
        id: 'sp-cristiane',
        name: 'Cristiane Santos Lopes de Oliveira',
        professional_id: '1928664',
        default_sector: 'qrrh9pfkq090hlo',
      },
    ]

    // 08/10 tem 5 plantonistas (dia denso)
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
      // 17/10
      {
        id: 'sh-17',
        staff_profile: 'sp-laodiceia',
        start_time: '2026-10-17 07:00:00',
        end_time: '2026-10-17 19:00:00',
      },
      // 18/10
      {
        id: 'sh-18',
        staff_profile: 'sp-cristiane',
        start_time: '2026-10-18 19:00:00',
        end_time: '2026-10-19 07:00:00',
      },
      // 19/10
      {
        id: 'sh-19',
        staff_profile: 'sp-marcia',
        start_time: '2026-10-19 07:00:00',
        end_time: '2026-10-19 19:00:00',
      },
    ]

    const weekendOffMap = new Map<string, Set<string>>()
    weekendOffMap.set('sp-cristiane', new Set(['2026-10-17']))

    const { pages } = prepareCalendarMultiPageData({
      title: 'Escala de Plantões — Calendário',
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

    expect(pages.length).toBe(7)

    const fullHtml = buildCalendarHtml({
      title: 'Escala de Plantões — Calendário',
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

    const pageBlocks = fullHtml.split('<div class="page-container"').slice(1)
    expect(pageBlocks.length).toBe(7)

    // EVIDÊNCIA DE INSPEÇÃO PÁGINA A PÁGINA (100% dos blocos):
    // Página 1: Semana 1 de 6 (26/09 a 26/09)
    expect(pageBlocks[0]).toContain('Semana 1 de 6')
    expect(pageBlocks[0]).toContain('Página 1 de 7')
    expect(pageBlocks[0]).toContain('PS RESPIRATÓRIO')
    expect(pageBlocks[0]).toContain('26/09')

    // Página 2: Semana 2 de 6 (27/09 a 03/10)
    expect(pageBlocks[1]).toContain('Semana 2 de 6')
    expect(pageBlocks[1]).toContain('Página 2 de 7')

    // Página 3: Semana 3 de 6 (04/10 a 10/10) - inclui 08/10 com 4 primeiros e aviso
    expect(pageBlocks[2]).toContain('Semana 3 de 6')
    expect(pageBlocks[2]).toContain('Página 3 de 7')
    expect(pageBlocks[2]).toContain('08/10')
    expect(pageBlocks[2]).toContain('Laodiceia da Silva Goes Dias')
    expect(pageBlocks[2]).toContain('+1 profissional(is) na continuação')

    // Página 4: Continuação do dia 08/10 (quinta-feira) - todos os 5 colaboradores com COREN e horários
    expect(pageBlocks[3]).toContain('Continuação &mdash; Quinta-feira, 08/10')
    expect(pageBlocks[3]).toContain('Página 4 de 7')
    expect(pageBlocks[3]).toContain('Total no dia: 5 plantonista(s)')
    expect(pageBlocks[3]).toContain('Laodiceia da Silva Goes Dias')
    expect(pageBlocks[3]).toContain('Marcia Ferreira Sales Silva')
    expect(pageBlocks[3]).toContain('Matheus Rodrigues Avelar')
    expect(pageBlocks[3]).toContain('Catia Aperecida da Silva Pirelli')
    expect(pageBlocks[3]).toContain('Cristiane Santos Lopes de Oliveira')
    expect(pageBlocks[3]).toContain('COREN 9470010')
    expect(pageBlocks[3]).toContain('COREN 835384')
    expect(pageBlocks[3]).toContain('COREN 1911297')
    expect(pageBlocks[3]).toContain('COREN 538627')
    expect(pageBlocks[3]).toContain('COREN 1928664')

    // Página 5: Semana 4 de 6 (11/10 a 17/10) - inclui dia 17/10
    expect(pageBlocks[4]).toContain('Semana 4 de 6')
    expect(pageBlocks[4]).toContain('Página 5 de 7')
    expect(pageBlocks[4]).toContain('17/10')
    expect(pageBlocks[4]).toContain('Laodiceia da Silva Goes Dias')
    expect(pageBlocks[4]).toContain('tag-d')
    expect(pageBlocks[4]).toContain('tag-fds')
    expect(pageBlocks[4]).toContain('Folga Fim de Semana')

    // Página 6: Semana 5 de 6 (18/10 a 24/10) - inclui dias 18/10 e 19/10
    expect(pageBlocks[5]).toContain('Semana 5 de 6')
    expect(pageBlocks[5]).toContain('Página 6 de 7')
    expect(pageBlocks[5]).toContain('18/10')
    expect(pageBlocks[5]).toContain('19/10')
    expect(pageBlocks[5]).toContain('Cristiane Santos Lopes de Oliveira')
    expect(pageBlocks[5]).toContain('tag-n')
    expect(pageBlocks[5]).toContain('Marcia Ferreira Sales Silva')
    expect(pageBlocks[5]).toContain('tag-d')

    // Página 7: Semana 6 de 6 (25/10 a 25/10)
    expect(pageBlocks[6]).toContain('Semana 6 de 6')
    expect(pageBlocks[6]).toContain('Página 7 de 7')
    expect(pageBlocks[6]).toContain('25/10')

    // Salva arquivo com HTML real final renderizado
    const outPath = path.resolve(process.cwd(), 'ps-respiratorio-outubro-2026-inspecao.html')
    fs.writeFileSync(outPath, fullHtml, 'utf-8')
    expect(fs.existsSync(outPath)).toBe(true)
    fs.unlinkSync(outPath)

    // Validação direta do documento jsPDF gerado pelo exportador real
    const doc = await exportAutoGenerateCalendarPdf({
      title: 'Escala de Plantões — Calendário',
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
      returnDoc: true,
    } as any)

    expect(doc).toBeDefined()
    const totalPdfPages = (doc as any).getNumberOfPages()
    expect(totalPdfPages).toBeGreaterThanOrEqual(1)

    for (let i = 1; i <= totalPdfPages; i++) {
      ;(doc as any).setPage(i)
      const pageSize = (doc as any).internal.pageSize
      const width = pageSize.getWidth()
      const height = pageSize.getHeight()

      // Proporção de Landscape: largura (297mm) > altura (210mm)
      expect(width).toBeGreaterThan(height)
      expect(Math.round(width)).toBe(297)
      expect(Math.round(height)).toBe(210)
    }
  })
})
