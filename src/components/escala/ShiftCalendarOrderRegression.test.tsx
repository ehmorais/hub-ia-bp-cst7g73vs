import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import {
  buildClassifiedDayItems,
  resolveContractPeriodLetter,
  getBasePeriodLetterForStaff,
} from '@/lib/escala-calendar-order'
import { ShiftCalendarGrid } from '@/components/escala/ShiftCalendarGrid'
import { buildCalendarHtml } from '@/utils/scalePdfExport'

describe('Ordenação e Classificação de Colaboradores no Calendário (6 Grupos a–f)', () => {
  // Configuração de dados de teste
  const dateKey = '2026-10-10' // Sábado (fim de semana)
  const dayOfWeek = 6

  const contracts = [
    {
      staff_profile: 'p-diurno-trabalha-1',
      expand: {
        shift_type: { name: '12X36D Plantão Diurno', start_time: '07:00', end_time: '19:00' },
      },
    },
    {
      staff_profile: 'p-diurno-trabalha-2',
      expand: {
        shift_type: { name: 'Escala MANHÃ 07h-19h', start_time: '07:00', end_time: '19:00' },
      },
    },
    {
      staff_profile: 'p-diurno-folga',
      expand: { shift_type: { name: '12x36 Diurno', start_time: '07:00', end_time: '19:00' } },
    },
    {
      staff_profile: 'p-diurno-ferias',
      expand: { shift_type: { code: 'DIA', start_time: '07:00', end_time: '19:00' } },
    },
    {
      staff_profile: 'p-noturno-trabalha',
      expand: {
        shift_type: { name: '12X36N Plantão Noturno', start_time: '19:00', end_time: '07:00' },
      },
    },
    {
      staff_profile: 'p-noturno-folga',
      expand: { shift_type: { name: 'SDN Noturno 19h', start_time: '19:00', end_time: '07:00' } },
    },
    {
      staff_profile: 'p-noturno-ferias',
      expand: { shift_type: { name: 'Plantão Noturno', start_time: '19:00', end_time: '07:00' } },
    },
  ]

  const staffProfiles = [
    {
      id: 'p-diurno-trabalha-1',
      name: 'Bernardo Silva (Escalado D)',
      professional_id: '1001',
      vacation_enabled: false,
    },
    {
      id: 'p-diurno-trabalha-2',
      name: 'Ana Carolina (Escalado D)',
      professional_id: '1002',
      vacation_enabled: false,
    },
    {
      id: 'p-diurno-folga',
      name: 'Carlos Mendes (Folga D)',
      professional_id: '1003',
      vacation_enabled: false,
    },
    {
      id: 'p-diurno-ferias',
      name: 'Daniela Castro (Férias D)',
      professional_id: '1004',
      vacation_enabled: true,
      vacation_start: '2026-10-01',
      vacation_end: '2026-10-20',
    },
    {
      id: 'p-noturno-trabalha',
      name: 'Eduardo Ramos (Escalado N)',
      professional_id: '1005',
      vacation_enabled: false,
    },
    {
      id: 'p-noturno-folga',
      name: 'Fernanda Lima (Folga N)',
      professional_id: '1006',
      vacation_enabled: false,
    },
    {
      id: 'p-noturno-ferias',
      name: 'Gabriel Souza (Férias N)',
      professional_id: '1007',
      vacation_enabled: true,
      vacation_start: '2026-10-05',
      vacation_end: '2026-10-15',
    },
  ]

  const sectorStaffProfiles = staffProfiles.map((p) => ({
    id: p.id,
    name: p.name,
    professional_id: p.professional_id,
  }))

  const weekendOffMap = new Map<string, Set<string>>()
  weekendOffMap.set('p-diurno-folga', new Set([dateKey]))
  weekendOffMap.set('p-noturno-folga', new Set([dateKey]))

  const dayShifts = [
    {
      id: 'sh-1',
      staff_profile: 'p-diurno-trabalha-1',
      start_time: `${dateKey} 07:00:00`,
      end_time: `${dateKey} 19:00:00`,
    },
    {
      id: 'sh-2',
      staff_profile: 'p-diurno-trabalha-2',
      start_time: `${dateKey} 07:00:00`,
      end_time: `${dateKey} 19:00:00`,
    },
    {
      id: 'sh-3',
      staff_profile: 'p-noturno-trabalha',
      start_time: `${dateKey} 19:00:00`,
      end_time: '2026-10-11 07:00:00',
    },
  ]

  it('1. Classifica exatamente os 6 grupos no mesmo dia na sequência a–f com ordem alfabética em cada grupo', () => {
    const items = buildClassifiedDayItems({
      dateKey,
      dayOfWeek,
      dayShifts,
      contracts,
      staffProfiles,
      sectorStaffProfiles,
      weekendOffMap,
    })

    // Deve ter exatamente 7 colaboradores (2 escalados D, 1 folga D, 1 férias D, 1 escalado N, 1 folga N, 1 férias N)
    expect(items.length).toBe(7)

    // Grupo a) Escalados D (ordem alfabética: Ana Carolina antes de Bernardo Silva)
    expect(items[0].groupOrder).toBe(1)
    expect(items[0].staffId).toBe('p-diurno-trabalha-2') // Ana Carolina
    expect(items[0].periodLetter).toBe('D')

    expect(items[1].groupOrder).toBe(1)
    expect(items[1].staffId).toBe('p-diurno-trabalha-1') // Bernardo Silva
    expect(items[1].periodLetter).toBe('D')

    // Grupo b) Folga D (Carlos Mendes)
    expect(items[2].groupOrder).toBe(2)
    expect(items[2].staffId).toBe('p-diurno-folga')
    expect(items[2].periodLetter).toBe('D')
    expect(items[2].absenceType).toBe('FOLGA')

    // Grupo c) Férias D (Daniela Castro)
    expect(items[3].groupOrder).toBe(3)
    expect(items[3].staffId).toBe('p-diurno-ferias')
    expect(items[3].periodLetter).toBe('D')
    expect(items[3].absenceType).toBe('FÉRIAS')

    // Grupo d) Escalados N (Eduardo Ramos)
    expect(items[4].groupOrder).toBe(4)
    expect(items[4].staffId).toBe('p-noturno-trabalha')
    expect(items[4].periodLetter).toBe('N')

    // Grupo e) Folga N (Fernanda Lima)
    expect(items[5].groupOrder).toBe(5)
    expect(items[5].staffId).toBe('p-noturno-folga')
    expect(items[5].periodLetter).toBe('N')
    expect(items[5].absenceType).toBe('FOLGA')

    // Grupo f) Férias N (Gabriel Souza)
    expect(items[6].groupOrder).toBe(6)
    expect(items[6].staffId).toBe('p-noturno-ferias')
    expect(items[6].periodLetter).toBe('N')
    expect(items[6].absenceType).toBe('FÉRIAS')
  })

  it('2. Precedência: férias ativas vencem folga na mesma data -> classificado apenas como FÉRIAS, sem duplicar', () => {
    // Adiciona folga para Daniela Castro (que já tem férias ativas nesta data)
    const conflictMap = new Map<string, Set<string>>()
    conflictMap.set('p-diurno-ferias', new Set([dateKey]))

    const items = buildClassifiedDayItems({
      dateKey,
      dayOfWeek,
      dayShifts: [], // Sem plantão
      contracts,
      staffProfiles,
      sectorStaffProfiles,
      weekendOffMap: conflictMap,
    })

    const danielaItems = items.filter((i) => i.staffId === 'p-diurno-ferias')
    expect(danielaItems.length).toBe(1)
    expect(danielaItems[0].absenceType).toBe('FÉRIAS')
    expect(danielaItems[0].groupOrder).toBe(3) // Grupo c
  })

  it('3. Precedência: colaborador escalado no dia entra exclusivamente no grupo escalado e NUNCA como ausente', () => {
    // Adiciona folga e férias ativas para Bernardo Silva, que tem plantão escalado
    const conflictMap = new Map<string, Set<string>>()
    conflictMap.set('p-diurno-trabalha-1', new Set([dateKey]))

    const profilesWithVacation = staffProfiles.map((p) =>
      p.id === 'p-diurno-trabalha-1'
        ? { ...p, vacation_enabled: true, vacation_start: '2026-10-01', vacation_end: '2026-10-20' }
        : p,
    )

    const items = buildClassifiedDayItems({
      dateKey,
      dayOfWeek,
      dayShifts: [dayShifts[0]], // Bernardo escalado
      contracts,
      staffProfiles: profilesWithVacation,
      sectorStaffProfiles,
      weekendOffMap: conflictMap,
    })

    const bernardoItems = items.filter((i) => i.staffId === 'p-diurno-trabalha-1')
    expect(bernardoItems.length).toBe(1)
    expect(bernardoItems[0].groupOrder).toBe(1) // Grupo a (escalado D)
    expect(bernardoItems[0].shift).toBeDefined()
    expect(bernardoItems[0].absenceType).toBeUndefined()
  })

  it('4. Detecção de D/N pelo contrato vigente (horários, códigos e fallback D)', () => {
    // Noturno por hora >= 18h
    expect(
      resolveContractPeriodLetter({
        expand: { shift_type: { start_time: '19:00', end_time: '07:00' } },
      }),
    ).toBe('N')
    // Noturno por cruzar meia-noite
    expect(
      resolveContractPeriodLetter({
        expand: { shift_type: { start_time: '22:00', end_time: '06:00' } },
      }),
    ).toBe('N')
    // Noturno por palavras-chave
    expect(
      resolveContractPeriodLetter({ expand: { shift_type: { name: '12X36N Plantão' } } }),
    ).toBe('N')
    expect(resolveContractPeriodLetter({ expand: { shift_type: { code: 'SDN' } } })).toBe('N')
    expect(resolveContractPeriodLetter({ expand: { shift_type: { name: 'TURNO NOITE' } } })).toBe(
      'N',
    )

    // Diurno por horário 06h-17h
    expect(
      resolveContractPeriodLetter({
        expand: { shift_type: { start_time: '07:00', end_time: '19:00' } },
      }),
    ).toBe('D')
    // Diurno por palavras-chave
    expect(resolveContractPeriodLetter({ expand: { shift_type: { name: '12X36D Diurno' } } })).toBe(
      'D',
    )
    expect(resolveContractPeriodLetter({ expand: { shift_type: { name: 'Escala Manhã' } } })).toBe(
      'D',
    )
    expect(resolveContractPeriodLetter({ expand: { shift_type: { code: 'TARDE' } } })).toBe('D')

    // Fallback seguro = D quando sem contrato ou sem horários
    expect(resolveContractPeriodLetter(undefined)).toBe('D')
    expect(resolveContractPeriodLetter({})).toBe('D')
    expect(getBasePeriodLetterForStaff('inexistente', [])).toBe('D')
  })

  it('5. Card de ausentes exibe nome completo, COREN (formatCorenLabel), letra D/N e tag FOLGA ou FÉRIAS', () => {
    const singleDay = [{ date: new Date(2026, 9, 10), key: dateKey, dayOfWeek: 6 }]

    render(
      <ShiftCalendarGrid
        days={singleDay}
        shifts={[]}
        contracts={contracts}
        staffProfiles={staffProfiles}
        weekendOffMap={weekendOffMap}
        isInteractive={false}
      />,
    )

    // Daniela Castro (Férias D)
    const vacCard = screen.getByTestId(`vacation-p-diurno-ferias-${dateKey}`)
    expect(vacCard.textContent).toContain('Daniela Castro (Férias D)')
    expect(vacCard.textContent).toContain('COREN 1004')
    expect(vacCard.textContent).toContain('D')
    expect(vacCard.textContent).toContain('FÉRIAS')

    // Carlos Mendes (Folga D)
    const offCard = screen.getByTestId(`weekend-off-p-diurno-folga-${dateKey}`)
    expect(offCard.textContent).toContain('Carlos Mendes (Folga D)')
    expect(offCard.textContent).toContain('COREN 1003')
    expect(offCard.textContent).toContain('D')
    expect(offCard.textContent).toContain('FOLGA')

    // Gabriel Souza (Férias N)
    const vacNCard = screen.getByTestId(`vacation-p-noturno-ferias-${dateKey}`)
    expect(vacNCard.textContent).toContain('Gabriel Souza (Férias N)')
    expect(vacNCard.textContent).toContain('COREN 1007')
    expect(vacNCard.textContent).toContain('N')
    expect(vacNCard.textContent).toContain('FÉRIAS')

    // Fernanda Lima (Folga N)
    const offNCard = screen.getByTestId(`weekend-off-p-noturno-folga-${dateKey}`)
    expect(offNCard.textContent).toContain('Fernanda Lima (Folga N)')
    expect(offNCard.textContent).toContain('COREN 1006')
    expect(offNCard.textContent).toContain('N')
    expect(offNCard.textContent).toContain('FOLGA')
  })

  it('6. O HTML do PDF preserva a ordem estrita dos 6 grupos nas páginas semanais e de continuação', () => {
    const days = [{ date: new Date(2026, 9, 10), key: dateKey, dayOfWeek: 6 }]

    const html = buildCalendarHtml({
      title: 'Escala 6 Grupos Teste',
      sectorName: 'PS Adulto',
      days,
      shifts: dayShifts,
      contracts,
      staffProfiles,
      weekendOffMap,
    })

    // Verifica que todos os 7 nomes estão no documento
    staffProfiles.forEach((p) => {
      expect(html).toContain(p.name)
      expect(html).toContain(`COREN ${p.professional_id}`)
    })

    // Na continuação ou grade semanal, a ordem dos nomes deve seguir a sequência a–f:
    // 1: Ana Carolina (Escalado D)
    // 2: Bernardo Silva (Escalado D)
    // 3: Carlos Mendes (Folga D)
    // 4: Daniela Castro (Férias D)
    // 5: Eduardo Ramos (Escalado N)
    // 6: Fernanda Lima (Folga N)
    // 7: Gabriel Souza (Férias N)
    const idxAna = html.indexOf('Ana Carolina (Escalado D)')
    const idxBernardo = html.indexOf('Bernardo Silva (Escalado D)')
    const idxCarlos = html.indexOf('Carlos Mendes (Folga D)')
    const idxDaniela = html.indexOf('Daniela Castro (Férias D)')
    const idxEduardo = html.indexOf('Eduardo Ramos (Escalado N)')
    const idxFernanda = html.indexOf('Fernanda Lima (Folga N)')
    const idxGabriel = html.indexOf('Gabriel Souza (Férias N)')

    expect(idxAna).toBeLessThan(idxBernardo)
    expect(idxBernardo).toBeLessThan(idxCarlos)
    expect(idxCarlos).toBeLessThan(idxDaniela)
    expect(idxDaniela).toBeLessThan(idxEduardo)
    expect(idxEduardo).toBeLessThan(idxFernanda)
    expect(idxFernanda).toBeLessThan(idxGabriel)
  })
})
