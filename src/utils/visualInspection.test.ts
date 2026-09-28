import { describe, it, expect } from 'vitest'
import { buildCalendarHtml, prepareCalendarMultiPageData } from '@/utils/scalePdfExport'
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

    // Salva o arquivo de amostra para inspeção
    const samplePath = path.resolve(process.cwd(), 'sample-calendar-weekly.html')
    fs.writeFileSync(samplePath, html, 'utf-8')
    expect(fs.existsSync(samplePath)).toBe(true)
  })
})
