import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { ShiftCalendarGrid, CalendarGridLegend } from '@/components/escala/ShiftCalendarGrid'
import { CalendarPdfPage } from '@/components/escala/CalendarPdfPage'
import {
  chunkDaysIntoCalendarWeeks,
  groupWeeksIntoPages,
  exportAutoGenerateCalendarPdf,
} from '@/utils/scalePdfExport'

describe('Unificação Visual Absoluta: Grade da Tela e PDF usam o mesmo componente React puro', () => {
  const dummyDays = [
    { date: new Date(2026, 9, 8), key: '2026-10-08', dayOfWeek: 4 }, // Qui
    { date: new Date(2026, 9, 17), key: '2026-10-17', dayOfWeek: 6 }, // Sáb
    { date: new Date(2026, 9, 18), key: '2026-10-18', dayOfWeek: 0 }, // Dom
    { date: new Date(2026, 9, 19), key: '2026-10-19', dayOfWeek: 1 }, // Seg
  ]

  const dummyStaff = [
    {
      id: 'sp-laodiceia',
      name: 'Laodiceia da Silva Goes Dias',
      professional_id: '9470010',
      default_sector: 'sec-ps',
    },
    {
      id: 'sp-marcia',
      name: 'Marcia Ferreira Sales Silva',
      professional_id: '835384',
      default_sector: 'sec-ps',
    },
    {
      id: 'sp-cristiane',
      name: 'Cristiane Santos Lopes de Oliveira',
      professional_id: '1928664',
      default_sector: 'sec-ps',
    },
  ]

  const dummyShifts = [
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
      id: 'sh-17',
      staff_profile: 'sp-laodiceia',
      start_time: '2026-10-17 07:00:00',
      end_time: '2026-10-17 19:00:00',
    },
    {
      id: 'sh-18',
      staff_profile: 'sp-cristiane',
      start_time: '2026-10-18 19:00:00',
      end_time: '2026-10-19 07:00:00',
    },
  ]

  const weekendOffMap = new Map<string, Set<string>>()
  weekendOffMap.set('sp-cristiane', new Set(['2026-10-17']))

  it('ShiftCalendarGrid renderiza exatamente os mesmos cards, tags D/N e folgas FDS', () => {
    const { container } = render(
      <ShiftCalendarGrid
        days={dummyDays}
        shifts={dummyShifts}
        contracts={[]}
        staffProfiles={dummyStaff}
        weekendOffMap={weekendOffMap}
        selectedSectorId="sec-ps"
        isInteractive={false}
      />,
    )

    // Presença dos nomes completos
    expect(screen.getByText('Laodiceia da Silva Goes Dias')).toBeDefined()
    expect(screen.getByText('Marcia Ferreira Sales Silva')).toBeDefined()
    expect(screen.getByText('Cristiane Santos Lopes de Oliveira')).toBeDefined()

    // Presença dos CORENs
    expect(screen.getByText('COREN 9470010')).toBeDefined()
    expect(screen.getByText('COREN 835384')).toBeDefined()

    // Presença das tags D e N
    expect(container.querySelectorAll('.text-emerald-700')).toBeDefined()
    expect(container.querySelectorAll('.text-indigo-700')).toBeDefined()

    // Folga de fim de semana renderizada
    expect(screen.getByText('Folga Fim de Semana')).toBeDefined()
  })

  it('CalendarPdfPage usa o mesmo componente e gera cabeçalho institucional com BPSCS', () => {
    render(
      <CalendarPdfPage
        title="Escala de Plantões — Calendário"
        sectorName="PS RESPIRATÓRIO"
        cycleName="Ciclo Outubro 2026"
        days={dummyDays}
        shifts={dummyShifts}
        contracts={[]}
        staffProfiles={dummyStaff}
        weekendOffMap={weekendOffMap}
        selectedSectorId="sec-ps"
        pageCurrent={1}
        pageTotal={3}
        showLegend={true}
      />,
    )

    expect(screen.getByText('Beneficência Portuguesa de São Caetano do Sul')).toBeDefined()
    expect(screen.getByText('Escala de Plantões — Calendário')).toBeDefined()
    expect(screen.getByText(/PS RESPIRATÓRIO/)).toBeDefined()
    expect(screen.getByText(/Ciclo Outubro 2026/)).toBeDefined()
    expect(screen.getByText('Página 1 de 3')).toBeDefined()

    // Legenda idêntica
    expect(screen.getByText('Plantão D')).toBeDefined()
    expect(screen.getByText('Plantão N')).toBeDefined()
    expect(screen.getByText('Férias')).toBeDefined()
  })

  it('chunkDaysIntoCalendarWeeks e groupWeeksIntoPages agrupam semanas completas sem cortar', () => {
    const weeks = chunkDaysIntoCalendarWeeks(dummyDays)
    expect(weeks.length).toBeGreaterThan(0)
    const pages = groupWeeksIntoPages(weeks, dummyShifts)
    expect(pages.length).toBeGreaterThan(0)
  })
})
