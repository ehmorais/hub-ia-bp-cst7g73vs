import { describe, it, expect } from 'vitest'
import pb from '../lib/pocketbase/client'
import { prepareCalendarMultiPageData, buildCalendarHtml } from './scalePdfExport'

describe('Validação da Exportação PDF do Calendário — Setor UTI 2 (Ciclo 11/2026)', () => {
  it('exporta o calendário real da UTI 2 no ciclo 11/2026, com todos na grade e sem páginas de continuação', async () => {
    // 1. Busca os ciclos e localiza o ciclo 11/2026
    const cycles = await pb.collection('shift_cycles').getFullList({
      sort: '-start_date',
    })
    const utiCycle = cycles.find((c) => c.name?.includes('11/2026')) || cycles[0]
    expect(utiCycle).toBeDefined()

    // 2. Busca o setor UTI 2
    const sectors = await pb.collection('hospital_sectors').getFullList({
      filter: 'name = "UTI 2"',
    })
    const uti2Sector = sectors[0]
    expect(uti2Sector).toBeDefined()

    // 3. Busca shifts deste ciclo e setor
    const shifts = await pb.collection('shifts').getFullList({
      filter: `cycle = "${utiCycle.id}" && sector = "${uti2Sector.id}"`,
    })
    expect(shifts.length).toBeGreaterThan(0)

    // 4. Busca os colaboradores (staff profiles)
    const staffProfiles = await pb.collection('staff_profiles').getFullList({
      filter: 'active = true',
    })

    // Monta os dias do ciclo (2026-10-26 a 2026-11-25)
    const start = new Date(utiCycle.start_date + 'T12:00:00Z')
    const end = new Date(utiCycle.end_date + 'T12:00:00Z')
    const cycleDays: Array<{ date: Date; key: string; dayOfWeek: number }> = []
    const cur = new Date(start)
    while (cur <= end) {
      const year = cur.getFullYear()
      const month = String(cur.getMonth() + 1).padStart(2, '0')
      const day = String(cur.getDate()).padStart(2, '0')
      cycleDays.push({
        date: new Date(cur),
        key: `${year}-${month}-${day}`,
        dayOfWeek: cur.getDay(),
      })
      cur.setDate(cur.getDate() + 1)
    }

    // 5. Prepara os dados de exportação com prepareCalendarMultiPageData
    const multiPageResult = prepareCalendarMultiPageData({
      title: 'Escala de Plantões — Calendário Semanal',
      sectorName: uti2Sector.name,
      cycleName: utiCycle.name,
      cycleStart: utiCycle.start_date,
      cycleEnd: utiCycle.end_date,
      days: cycleDays,
      shifts: shifts.map((s) => ({
        id: s.id,
        staff_profile: s.staff_profile,
        start_time: s.start_time,
        end_time: s.end_time,
      })),
      contracts: [],
      staffProfiles: staffProfiles.map((sp) => ({
        id: sp.id,
        name: sp.name,
        professional_id: sp.professional_id,
        staff_role: sp.staff_role,
        shift_parity: sp.shift_parity,
      })),
      weekendOffMap: new Map(),
    })

    console.log(`UTI 2 Ciclo 11/2026 páginas geradas: ${multiPageResult.pages.length}`)

    // Critério 1 e 3: Nenhuma página é continuation ou day_continuation
    const contPages = multiPageResult.pages.filter(
      (p) => p.pageType === 'continuation' || p.pageType === 'day_continuation',
    )
    expect(contPages.length).toBe(0)
    expect(multiPageResult.pages.every((p) => p.pageType === 'week')).toBe(true)

    // Critério 2: No dia 26/10 há 23 colaboradores (ou mais de 20).
    // Todas as partes da semana 1 (que contém 26/10) mostram os colaboradores na grade
    const week1Pages = multiPageResult.pages.filter((p) =>
      p.weekData?.days.some((d) => d?.dateKey === '2026-10-26'),
    )
    expect(week1Pages.length).toBeGreaterThan(1) // 23 colaboradores divididos por 4 por página = 6 partes!
    const partTotal = week1Pages[0].weekData?.partTotal || 1
    expect(partTotal).toBe(6)

    // Coleta todos os colaboradores mostrados no dia 26/10 em todas as partes da semana 1
    const day26Items: string[] = []
    week1Pages.forEach((p) => {
      const cell = p.weekData?.days.find((d) => d?.dateKey === '2026-10-26')
      cell?.shifts.forEach((s) => day26Items.push(s.name))
    })

    // 23 colaboradores no dia 26/10
    expect(day26Items.length).toBe(23)
    // Sem duplicados — cada nome aparece exatamente UMA vez na grade
    expect(new Set(day26Items).size).toBe(23)

    // Gera o HTML e garante que não há "+20 na continuação" nem tabelas de continuação
    const html = buildCalendarHtml({
      title: 'Escala de Plantões — Calendário Semanal',
      sectorName: uti2Sector.name,
      cycleName: utiCycle.name,
      cycleStart: utiCycle.start_date,
      cycleEnd: utiCycle.end_date,
      days: cycleDays,
      shifts: shifts.map((s) => ({
        id: s.id,
        staff_profile: s.staff_profile,
        start_time: s.start_time,
        end_time: s.end_time,
      })),
      contracts: [],
      staffProfiles: staffProfiles.map((sp) => ({
        id: sp.id,
        name: sp.name,
        professional_id: sp.professional_id,
        staff_role: sp.staff_role,
        shift_parity: sp.shift_parity,
      })),
      weekendOffMap: new Map(),
    })

    expect(html).not.toContain('continuation-wrapper')
    expect(html).not.toContain('continuation-columns')
    expect(html).not.toContain('na continuação')
    expect(html).not.toContain('+20')
    expect(html).not.toContain('+19')
    expect(html).toContain('Parte 1 de 6')
    expect(html).toContain('Parte 6 de 6')
  })
})
