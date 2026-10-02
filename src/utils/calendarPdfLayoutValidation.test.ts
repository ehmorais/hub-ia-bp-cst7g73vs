import { describe, it, expect } from 'vitest'
import {
  CALENDAR_PDF_COMMON_STYLES,
  renderStaffCardHtml,
  renderWeeklyCellHtml,
  renderMultiPageCalendarHtml,
  ShiftItemData,
  CalendarDayCellData,
} from '@/templates/calendarPdfTemplate'
import { prepareCalendarMultiPageData, buildCalendarHtml } from '@/utils/scalePdfExport'

describe('Validação Avançada de Medição, Wrap e Paginação contra Sobreposição e Negrito Indevido', () => {
  it('FALHA se qualquer elemento de conteúdo (nomes, COREN, horários, tipos) usar font-weight bold ou > 400', () => {
    // Lista exata de classes de conteúdo que JAMAIS podem estar em negrito
    const contentClasses = [
      'staff-entry-name',
      'staff-coren-text',
      'staff-time-text',
      'staff-entry-details',
      'staff-type-tag',
      'day-cell-badge-weekend',
      'empty-day-notice',
      'day-more-notice',
      'legend-item',
      'footer-right',
    ]

    contentClasses.forEach((cls) => {
      const regex = new RegExp(`\\.${cls}\\s*\\{([^}]+)\\}`, 'm')
      const match = CALENDAR_PDF_COMMON_STYLES.match(regex)
      expect(match, `Classe .${cls} deve existir no CSS`).not.toBeNull()
      if (match) {
        const body = match[1]
        expect(body, `Classe .${cls} não pode conter font-weight: bold`).not.toMatch(
          /font-weight:\s*bold/,
        )
        expect(body, `Classe .${cls} não pode conter font-weight: 700`).not.toMatch(
          /font-weight:\s*700/,
        )
        expect(body, `Classe .${cls} não pode conter font-weight: 800`).not.toMatch(
          /font-weight:\s*800/,
        )
        expect(body, `Classe .${cls} não pode conter font-weight: 900`).not.toMatch(
          /font-weight:\s*900/,
        )
        expect(body, `Classe .${cls} deve especificar explicitamente font-weight: 400`).toMatch(
          /font-weight:\s*400/,
        )
      }
    })
  })

  it('valida que nomes longos sofrem wrap com quebra de linha permitida (word-break/overflow-wrap) e altura flexível', () => {
    const shift: ShiftItemData = {
      staffId: 'sp-laodiceia',
      name: 'Laodiceia da Silva Goes Dias de Souza Alcantara Albuquerque',
      professionalId: 'COREN 9470010',
      periodLetter: 'D',
      corenText: 'COREN 9470010',
      timeRange: '07:00–19:00',
    }

    const html = renderStaffCardHtml({ type: 'shift', data: shift })
    expect(html).toContain('Laodiceia da Silva Goes Dias de Souza Alcantara Albuquerque')
    expect(html).toContain('COREN 9470010')
    expect(html).toContain('07:00–19:00')
    expect(html).toContain('staff-entry-name')
    expect(html).toContain('staff-entry-details')

    // Estilos de wrap garantidos no CSS
    expect(CALENDAR_PDF_COMMON_STYLES).toMatch(
      /\.staff-entry-name\s*\{[^}]*overflow-wrap:\s*break-word/,
    )
  })

  it('verifica que em dias com múltiplos colaboradores não há sobreposição: fluxo vertical com gap e display flex column', () => {
    // Verifica regras de layout do container de itens do dia
    expect(CALENDAR_PDF_COMMON_STYLES).toMatch(/\.day-shifts-list\s*\{[^}]*display:\s*flex/)
    expect(CALENDAR_PDF_COMMON_STYLES).toMatch(
      /\.day-shifts-list\s*\{[^}]*flex-direction:\s*column/,
    )
    expect(CALENDAR_PDF_COMMON_STYLES).toMatch(/\.day-shifts-list\s*\{[^}]*gap:\s*3px/)

    // Verifica regras de cada card individual (box-sizing border-box, sem altura fixa, sem coordenadas absolutas)
    expect(CALENDAR_PDF_COMMON_STYLES).toMatch(/\.staff-entry\s*\{[^}]*box-sizing:\s*border-box/)
    expect(CALENDAR_PDF_COMMON_STYLES).not.toMatch(/\.staff-entry\s*\{[^}]*position:\s*absolute/)
    expect(CALENDAR_PDF_COMMON_STYLES).not.toMatch(/\.staff-entry\s*\{[^}]*height:\s*\d+px/)
  })

  it('paginação por conteúdo: limita a 4 itens na grade semanal e move excesso para página de continuação dedicada', () => {
    const days: Array<{ date: Date; key: string; dayOfWeek: number }> = [
      { date: new Date(2026, 9, 8), key: '2026-10-08', dayOfWeek: 4 }, // Quinta 08/10
    ]

    const shifts: any[] = [
      {
        id: 's1',
        staff_profile: 'p1',
        start_time: '2026-10-08 07:00:00',
        end_time: '2026-10-08 19:00:00',
      },
      {
        id: 's2',
        staff_profile: 'p2',
        start_time: '2026-10-08 07:00:00',
        end_time: '2026-10-08 19:00:00',
      },
      {
        id: 's3',
        staff_profile: 'p3',
        start_time: '2026-10-08 19:00:00',
        end_time: '2026-10-09 07:00:00',
      },
      {
        id: 's4',
        staff_profile: 'p4',
        start_time: '2026-10-08 19:00:00',
        end_time: '2026-10-09 07:00:00',
      },
      {
        id: 's5',
        staff_profile: 'p5',
        start_time: '2026-10-08 19:00:00',
        end_time: '2026-10-09 07:00:00',
      },
    ]

    const staffProfiles = [
      { id: 'p1', name: 'Plantão 1', professional_id: '111' },
      { id: 'p2', name: 'Plantão 2', professional_id: '222' },
      { id: 'p3', name: 'Plantão 3', professional_id: '333' },
      { id: 'p4', name: 'Plantão 4', professional_id: '444' },
      { id: 'p5', name: 'Plantão 5', professional_id: '555' },
    ]

    const { pages } = prepareCalendarMultiPageData({
      days,
      shifts,
      contracts: [],
      staffProfiles,
      weekendOffMap: new Map(),
    })

    // Deve gerar página de semana + página de continuação do dia 08/10
    expect(pages.length).toBe(2)
    expect(pages[0].pageType).toBe('week')
    expect(pages[1].pageType).toBe('day_continuation')
    expect(pages[1].continuationDay?.shifts.length).toBe(5)
  })

  it('diferencia turno diurno, noturno, folga FDS e férias com tags discretas sem negrito generalizado', () => {
    const shiftD: ShiftItemData = {
      staffId: '1',
      name: 'Colaborador Diurno',
      periodLetter: 'D',
      corenText: 'COREN 100',
    }
    const shiftN: ShiftItemData = {
      staffId: '2',
      name: 'Colaborador Noturno',
      periodLetter: 'N',
      corenText: 'COREN 200',
    }
    const off = { id: '3', name: 'Colaborador Folga' }

    const htmlD = renderStaffCardHtml({ type: 'shift', data: shiftD })
    const htmlN = renderStaffCardHtml({ type: 'shift', data: shiftN })
    const htmlOff = renderStaffCardHtml({ type: 'off', data: off })

    expect(htmlD).toContain('tag-d')
    expect(htmlD).toContain('>D<')
    expect(htmlN).toContain('tag-n')
    expect(htmlN).toContain('>N<')
    expect(htmlOff).toContain('tag-fds')
    expect(htmlOff).toContain('Folga Fim de Semana')
  })
})
