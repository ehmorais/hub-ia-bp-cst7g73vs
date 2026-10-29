import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCorenLabel } from '@/lib/escala-calendar-formatter'
import { BPSCS_LOGO_BASE64 } from './bpscsLogo'
import { SIDEBAR_HOSPITAL_LOGO } from './sidebarHospitalLogo'
import {
  renderMultiPageCalendarHtml,
  type CalendarDayCellData,
  type ShiftItemData,
  type DayOverflowItem,
  type CalendarPageData,
} from '@/templates/calendarPdfTemplate'
import { buildClassifiedDayItems } from '@/lib/escala-calendar-order'

export interface ShiftSlot {
  type: 'day' | 'night' | 'morning' | 'afternoon' | 'leave' | string
  start?: string
  end?: string
  coren?: string | null
}

export interface ExportScalePdfParams {
  title?: string
  sectorName?: string
  cycleStart?: string
  cycleEnd?: string
  staffNames: Record<string, string> // staffId → nome completo
  staffRows: string[] // staffIds ordenados
  dateHeaders: string[] // datas "YYYY-MM-DD" ordenadas
  cellMap: Record<string, Record<string, ShiftSlot | undefined>> // cellMap[staffId][dateKey]
  weekendOffMap: Map<string, Set<string>> // staffId → Set<"YYYY-MM-DD">
  staffCorens?: Record<string, string | null | undefined> // staffId → professional_id
  returnDoc?: boolean
}

export function formatSafeFilename(cycleStart?: string): string {
  if (cycleStart && /^\d{4}-\d{2}/.test(cycleStart)) {
    const parts = cycleStart.split('-')
    return `escala-${parts[0]}-${parts[1]}.pdf`
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `escala-${year}-${month}.pdf`
}

function formatDateHeader(dateStr: string): string {
  const parts = dateStr.split('-')
  if (parts.length >= 3) {
    return `${parts[2]}/${parts[1]}`
  }
  return dateStr
}

function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length >= 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dateStr
}

export const LOGO_ASSET_PATH = '/assets/logo-bpscs.jpg'

const A4_LANDSCAPE_WIDTH_MM = 297
const A4_LANDSCAPE_HEIGHT_MM = 210
const PDF_CONTENT_WIDTH_RATIO = 0.85
const PDF_CONTENT_WIDTH_MM = A4_LANDSCAPE_WIDTH_MM * PDF_CONTENT_WIDTH_RATIO
const PDF_HORIZONTAL_MARGIN_MM = (A4_LANDSCAPE_WIDTH_MM - PDF_CONTENT_WIDTH_MM) / 2
const PDF_WEEK_COLUMN_WIDTH_MM = PDF_CONTENT_WIDTH_MM / 7

// Re-exporta BPSCS_LOGO_BASE64 para compatibilidade retroativa
export { BPSCS_LOGO_BASE64 } from './bpscsLogo'

export function exportScalePdf(data: ExportScalePdfParams) {
  const {
    title = 'Escala de Plantões',
    sectorName,
    cycleStart,
    cycleEnd,
    staffNames,
    staffRows,
    dateHeaders,
    cellMap,
    weekendOffMap,
  } = data

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  doc.setProperties({
    title,
    subject: sectorName ? `Escala - ${sectorName}` : 'Escala de Plantões',
    author: 'Gestão de Escalas BP',
  })

  // Chunk dates if there are more than 12 columns per page for readable layout in A4 landscape
  const MAX_DAYS_PER_PAGE = 12
  const dateChunks: string[][] = []

  if (dateHeaders.length === 0) {
    dateChunks.push([])
  } else {
    for (let i = 0; i < dateHeaders.length; i += MAX_DAYS_PER_PAGE) {
      dateChunks.push(dateHeaders.slice(i, i + MAX_DAYS_PER_PAGE))
    }
  }

  dateChunks.forEach((currentChunkDates, chunkIndex) => {
    if (chunkIndex > 0) {
      doc.addPage('a4', 'landscape')
    }

    const subtitleParts: string[] = []
    if (sectorName) subtitleParts.push(`Setor: ${sectorName}`)
    if (cycleStart && cycleEnd) {
      subtitleParts.push(
        `Período: ${formatDateDisplay(cycleStart)} a ${formatDateDisplay(cycleEnd)}`,
      )
    } else if (cycleStart) {
      subtitleParts.push(`Início: ${formatDateDisplay(cycleStart)}`)
    }
    if (dateChunks.length > 1) {
      subtitleParts.push(`Parte ${chunkIndex + 1} de ${dateChunks.length}`)
    }

    const headRow: string[] = ['Colaborador', ...currentChunkDates.map(formatDateHeader)]

    // Prepare table body
    const bodyRows = staffRows.map((staffId) => {
      const staffName = staffNames[staffId] || staffId
      const rowCells: any[] = [
        { content: staffName, styles: { fontStyle: 'bold', halign: 'left' } },
      ]

      currentChunkDates.forEach((dateKey) => {
        const isWeekendOff = weekendOffMap?.get(staffId)?.has(dateKey)
        const slot = cellMap?.[staffId]?.[dateKey]

        if (isWeekendOff) {
          rowCells.push({
            content: 'FOLGA',
            styles: {
              fillColor: [255, 243, 224], // #FFF3E0 Laranja Claro
              textColor: [194, 65, 12], // #C2410C Laranja Escuro
              fontStyle: 'bold',
              halign: 'center',
            },
          })
        } else if (slot) {
          const typeUpper = String(slot.type || '').toUpperCase()
          const isDay = typeUpper === 'D' || typeUpper === 'DAY'
          const isNight = typeUpper === 'N' || typeUpper === 'NIGHT'

          let displayText = ''
          if (isDay) {
            displayText = slot.start && slot.end ? `D ${slot.start}–${slot.end}` : 'D 07:00–19:00'
          } else if (isNight) {
            displayText = slot.start && slot.end ? `N ${slot.start}–${slot.end}` : 'N 19:00–07:00'
          } else {
            displayText = typeUpper
          }

          if (isDay) {
            rowCells.push({
              content: displayText,
              styles: {
                fillColor: [4, 120, 87], // Verde Escuro (#047857)
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
              },
            })
          } else if (isNight) {
            rowCells.push({
              content: displayText,
              styles: {
                fillColor: [30, 58, 138], // Azul Escuro (#1E3A8A)
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
              },
            })
          } else {
            rowCells.push({
              content: displayText,
              styles: {
                fillColor: [241, 245, 249],
                textColor: [30, 41, 59],
                halign: 'center',
              },
            })
          }
        } else {
          rowCells.push({
            content: '',
            styles: {
              fillColor: [255, 255, 255],
            },
          })
        }
      })

      return rowCells
    })

    autoTable(doc, {
      startY: 25,
      head: [headRow],
      body: bodyRows,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 6.5,
        cellPadding: 1.2,
        overflow: 'ellipsize',
        valign: 'middle',
        lineColor: [203, 213, 225], // Slate 300
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [15, 23, 42], // Slate 900
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 42, halign: 'left' },
      },
      margin: { top: 25, right: 10, bottom: 12, left: 10 },
      showHead: 'everyPage',
      didDrawPage: () => {
        // Logotipo institucional BPSCS no canto superior direito (x=263, y=6, w=24, h=18)
        try {
          if (typeof (doc as any).addImage === 'function') {
            doc.addImage(BPSCS_LOGO_BASE64, 'PNG', 263, 6, 24, 18)
          }
        } catch (imgErr) {
          console.warn('Falha ao renderizar logo no PDF Escala:', imgErr)
        }

        // Título e subtítulo no topo de cada página
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.setTextColor(30, 41, 59)
        doc.text(title, 14, 12)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(71, 85, 105)
        if (subtitleParts.length > 0) {
          doc.text(subtitleParts.join(' | '), 14, 18)
        }
      },
    })
  })

  // Add footer with page numbers
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Página ${i} de ${totalPages} | Gerado via BP Escalas`,
      doc.internal.pageSize.getWidth() - 10,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'right' },
    )
  }

  const filename = formatSafeFilename(cycleStart)
  if ((data as any).returnDoc) {
    return doc as any
  }
  doc.save(filename)
  return filename
}

/**
 * Parâmetros para exportação do Calendário Mensal em PDF para a Escala Gerada por IA
 */
export interface ExportAutoGenerateCalendarPdfParams {
  title?: string
  sectorName?: string
  cycleName?: string
  cycleStart?: string
  cycleEnd?: string
  days: Array<{
    date: Date
    key: string // "YYYY-MM-DD"
    dayOfWeek: number // 0 = Dom, 6 = Sáb
  }>
  shifts: any[] // Lista de plantões da visualização atual
  contracts: any[]
  staffProfiles: Array<{
    id: string
    name: string
    professional_id?: string | null
    default_sector?: string
    [key: string]: any
  }>
  draft?: any
  weekendOffMap: Map<string, Set<string>>
  selectedSectorId?: string
  selectedStaffId?: string
  logoBase64?: string
  logoOnLeft?: boolean
  returnDoc?: boolean
}

/**
 * Prepara a estrutura de dados (células, dias e semanas) necessária para renderizar o template HTML do calendário.
 */
export function prepareCalendarTemplateData(params: ExportAutoGenerateCalendarPdfParams) {
  const {
    title = 'Escala de Plantões — Calendário',
    sectorName,
    cycleName,
    cycleStart,
    cycleEnd,
    days,
    shifts,
    contracts,
    staffProfiles,
    weekendOffMap,
    selectedSectorId,
    selectedStaffId,
    logoBase64,
    logoOnLeft = false,
  } = params

  // Setor staff profiles para exibição de folgas de fim de semana
  const sectorStaffMap = new Map<
    string,
    { id: string; name: string; professional_id?: string | null }
  >()
  staffProfiles.forEach((sp) => {
    if (sp.default_sector === selectedSectorId || !selectedSectorId) {
      sectorStaffMap.set(sp.id, {
        id: sp.id,
        name: sp.name || 'Sem nome',
        professional_id: sp.professional_id,
      })
    }
  })
  shifts.forEach((s) => {
    const pid = s.staff_profile || s.user_id || s.user
    if (pid && !sectorStaffMap.has(pid)) {
      const sp = staffProfiles.find((item) => item.id === pid)
      const name =
        s.expand?.staff_profile?.name || s.expand?.user?.name || sp?.name || s.name || 'Sem nome'
      const profId =
        s.expand?.staff_profile?.professional_id ?? sp?.professional_id ?? s.professional_id ?? null
      sectorStaffMap.set(pid, { id: pid, name, professional_id: profId })
    }
  })
  const sectorStaffProfiles = Array.from(sectorStaffMap.values())

  // Cabeçalhos dos 7 dias da semana (sempre calendário padrão: Domingo a Sábado)
  const standardWeekLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const dayNamesFull = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ]

  // Montar semanas estruturadas rigorosamente de Domingo (0) a Sábado (6)
  const rawWeeks: Array<Array<{ date: Date; key: string; dayOfWeek: number } | null>> = []
  let currentWeek: Array<{ date: Date; key: string; dayOfWeek: number } | null> = []

  // Preencher com nulls os dias anteriores ao primeiro dia da grade até o domingo correspondente
  const firstDay = days.length > 0 ? days[0] : null
  const initialEmptyDaysCount = firstDay ? firstDay.dayOfWeek : 0
  for (let i = 0; i < initialEmptyDaysCount; i++) {
    currentWeek.push(null)
  }

  days.forEach((dayItem) => {
    currentWeek.push(dayItem)
    if (currentWeek.length === 7) {
      rawWeeks.push(currentWeek)
      currentWeek = []
    }
  })
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null)
    }
    rawWeeks.push(currentWeek)
  }

  const weeks: Array<Array<CalendarDayCellData | null>> = rawWeeks.map((week) => {
    return week.map((dayItem) => {
      if (!dayItem) {
        return null
      }

      const dateKey = dayItem.key
      const dayFormatted = `${String(dayItem.date.getDate()).padStart(2, '0')}/${String(
        dayItem.date.getMonth() + 1,
      ).padStart(2, '0')}`

      // Plantões do dia
      const dayShifts = shifts
        .filter((s) => {
          const sDateStr = s.start_time ? s.start_time.split(' ')[0].split('T')[0] : ''
          if (sDateStr !== dateKey) return false
          if (selectedStaffId) {
            const pid = s.staff_profile || s.user_id || s.user
            if (pid !== selectedStaffId) return false
          }
          return true
        })
        .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))

      const isWeekendDay = dayItem.dayOfWeek === 6 || dayItem.dayOfWeek === 0

      // Constrói os 6 grupos na sequência estrita a–f com ordem alfabética por nome
      const classifiedItems = buildClassifiedDayItems({
        dateKey,
        dayOfWeek: dayItem.dayOfWeek,
        dayShifts,
        contracts,
        staffProfiles,
        sectorStaffProfiles,
        weekendOffMap,
        selectedStaffId,
      })

      const formattedShifts: ShiftItemData[] = classifiedItems.map((item) => ({
        staffId: item.staffId,
        name: item.name,
        professionalId: item.professionalId,
        periodLetter: item.periodLetter,
        corenText: item.corenText,
        timeRange: item.timeRange,
        isVacation: item.absenceType === 'FÉRIAS' || item.isShiftOnVacation,
        isWeekendOff: item.absenceType === 'FOLGA',
        absenceType: item.absenceType,
      }))

      // Mantém weekendOffStaff vazio porque todos os ausentes (folga/férias) já estão integrados
      // em formattedShifts na ordem estrita dos 6 grupos (a–f)
      const weekendOffStaff: Array<{ id: string; name: string }> = []

      return {
        dayFormatted,
        dayNumber: dayItem.date.getDate(),
        dateKey,
        dayOfWeekName: dayNamesFull[dayItem.dayOfWeek],
        isWeekend: isWeekendDay,
        shifts: formattedShifts,
        weekendOffs: weekendOffStaff,
      }
    })
  })

  const cycleStartFormatted = cycleStart ? formatDateDisplay(cycleStart) : undefined
  const cycleEndFormatted = cycleEnd ? formatDateDisplay(cycleEnd) : undefined

  return {
    title,
    sectorName,
    cycleName,
    cycleStart: cycleStartFormatted,
    cycleEnd: cycleEndFormatted,
    weekDayHeaders: standardWeekLabels,
    weeks,
    logoBase64: logoBase64 || BPSCS_LOGO_BASE64,
    logoOnLeft,
  }
}

/**
 * Prepara páginas do documento de calendário com paginação SEMANAL (exatamente 1 semana por página)
 * e continuações dedicadas para dias com excesso de plantonistas (alta densidade).
 *
 * Cada semana (domingo a sábado, 7 colunas iguais) ganha sua própria página A4 Paisagem,
 * com células espaçosas e fontes legíveis (mínimo 9.5pt para nomes, 8.5pt para COREN/metadados).
 * Dias com mais de 4 profissionais mantêm os 4 primeiros na grade semanal e desdobram
 * o dia completo em páginas adicionais de continuação, garantindo que nenhum nome seja cortado
 * ou comprimido.
 */

export function prepareCalendarMultiPageData(params: ExportAutoGenerateCalendarPdfParams): {
  pages: CalendarPageData[]
  maxChipsPerCell: number
  templateData: ReturnType<typeof prepareCalendarTemplateData>
} {
  const templateData = prepareCalendarTemplateData(params)
  const maxChipsPerCell = 4
  const continuationRowsPerPage = 16
  const weekPages: CalendarPageData[] = []
  const overflowChunks: DayOverflowItem[] = []
  const totalWeeks = templateData.weeks.length

  templateData.weeks.forEach((weekDays, weekIdx) => {
    const validDays = weekDays.filter((day): day is CalendarDayCellData => day !== null)
    weekPages.push({
      pageType: 'week',
      pageIndex: 0,
      weekData: {
        weekIndex: weekIdx + 1,
        weekTotal: totalWeeks,
        startDateFormatted: validDays[0]?.dayFormatted || '',
        endDateFormatted: validDays[validDays.length - 1]?.dayFormatted || '',
        days: weekDays,
      },
    })

    weekDays.forEach((cell) => {
      if (!cell) return
      const orderedItems = [
        ...cell.shifts.map((item) => ({ kind: 'shift' as const, item })),
        ...cell.weekendOffs.map((item) => ({ kind: 'off' as const, item })),
      ]
      const excessItems = orderedItems.slice(maxChipsPerCell)

      for (let offset = 0; offset < excessItems.length; offset += continuationRowsPerPage) {
        const batch = excessItems.slice(offset, offset + continuationRowsPerPage)
        overflowChunks.push({
          dayFormatted: cell.dayFormatted,
          dateKey: cell.dateKey || cell.dayFormatted,
          dayOfWeekName: cell.dayOfWeekName || '',
          isWeekend: cell.isWeekend,
          remainingShifts: batch
            .filter((entry) => entry.kind === 'shift')
            .map((entry) => entry.item as ShiftItemData),
          remainingWeekendOffs: batch
            .filter((entry) => entry.kind === 'off')
            .map((entry) => entry.item as { id: string; name: string }),
        })
      }
    })
  })

  const continuationPages: CalendarPageData[] = []
  let pendingDays: DayOverflowItem[] = []
  let pendingRows = 0

  const flushContinuationPage = () => {
    if (pendingDays.length === 0) return
    continuationPages.push({
      pageType: 'continuation',
      pageIndex: 0,
      overflowDays: pendingDays,
    })
    pendingDays = []
    pendingRows = 0
  }

  overflowChunks.forEach((overflowDay) => {
    const rowCount = overflowDay.remainingShifts.length + overflowDay.remainingWeekendOffs.length
    if (pendingRows > 0 && pendingRows + rowCount > continuationRowsPerPage) {
      flushContinuationPage()
    }
    pendingDays.push(overflowDay)
    pendingRows += rowCount
  })
  flushContinuationPage()

  const pages = [...weekPages, ...continuationPages]
  pages.forEach((page, pageIndex) => {
    page.pageIndex = pageIndex
  })

  return { pages, maxChipsPerCell, templateData }
}

/**
 * Gera a string HTML completa do Calendário Mensal a partir dos parâmetros de exportação,
 * gerando documento multi-página com páginas de continuação quando necessário.
 */
export function buildCalendarHtml(params: ExportAutoGenerateCalendarPdfParams): string {
  const { pages, maxChipsPerCell, templateData } = prepareCalendarMultiPageData(params)

  const subtitleParts: string[] = []
  if (templateData.sectorName) subtitleParts.push(`Setor: ${templateData.sectorName}`)
  if (templateData.cycleName) subtitleParts.push(`Ciclo: ${templateData.cycleName}`)
  else if (templateData.cycleStart && templateData.cycleEnd) {
    subtitleParts.push(`Período: ${templateData.cycleStart} a ${templateData.cycleEnd}`)
  } else if (templateData.cycleStart) {
    subtitleParts.push(`Início: ${templateData.cycleStart}`)
  }
  const subtitle = subtitleParts.join(' &bull; ')

  const now = new Date()
  const generatedAt = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} às ${String(
    now.getHours(),
  ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return renderMultiPageCalendarHtml({
    title: templateData.title,
    subtitle,
    logoBase64: templateData.logoBase64,
    logoOnLeft: templateData.logoOnLeft,
    generatedAt,
    weekDayHeaders: templateData.weekDayHeaders,
    pages,
  })
}

/**
 * Agrupa a lista de dias do ciclo em semanas completas (domingo a sábado).
 */
export function chunkDaysIntoCalendarWeeks(
  days: Array<{ date: Date; key: string; dayOfWeek: number }>,
): Array<Array<{ date: Date; key: string; dayOfWeek: number }>> {
  if (days.length === 0) return []

  const weeks: Array<Array<{ date: Date; key: string; dayOfWeek: number }>> = []
  let currentWeek: Array<{ date: Date; key: string; dayOfWeek: number }> = []

  days.forEach((d) => {
    // Se o dia for domingo (0) e já tivermos dias acumulados na semana atual, fecha e abre nova
    if (d.dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    currentWeek.push(d)
    // Se o dia for sábado (6), fecha a semana
    if (d.dayOfWeek === 6) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  })

  if (currentWeek.length > 0) {
    weeks.push(currentWeek)
  }

  return weeks
}

/**
 * Agrupa semanas em páginas para o PDF, com no máximo 2 ou 3 semanas por página,
 * garantindo semanas COMPLETAS por página e nunca cortando linhas, nomes ou cards.
 * Dias densos (com muitos plantões) recebem alocação conservadora (1 ou 2 semanas por página).
 */
export function groupWeeksIntoPages(
  weeks: Array<Array<{ date: Date; key: string; dayOfWeek: number }>>,
  shifts: any[],
): Array<Array<Array<{ date: Date; key: string; dayOfWeek: number }>>> {
  if (weeks.length === 0) return []

  const pages: Array<Array<Array<{ date: Date; key: string; dayOfWeek: number }>>> = []
  let currentPageWeeks: Array<Array<{ date: Date; key: string; dayOfWeek: number }>> = []

  weeks.forEach((week) => {
    // Calcula o pico de densidade de plantões nos dias da semana
    let maxShiftsInDay = 0
    week.forEach((d) => {
      const count = shifts.filter((s) => {
        const sDateStr = s.start_time ? s.start_time.split(' ')[0].split('T')[0] : ''
        return sDateStr === d.key
      }).length
      if (count > maxShiftsInDay) maxShiftsInDay = count
    })

    // Se o dia tiver 4 ou mais plantões, a semana é alta -> limite de 1 ou 2 semanas por página
    const maxWeeksForThisPage = maxShiftsInDay >= 4 ? 1 : 2

    if (currentPageWeeks.length >= maxWeeksForThisPage) {
      pages.push(currentPageWeeks)
      currentPageWeeks = [week]
    } else {
      currentPageWeeks.push(week)
      // Se esta semana que acabou de entrar é alta, fecha a página imediatamente
      if (maxShiftsInDay >= 4) {
        pages.push(currentPageWeeks)
        currentPageWeeks = []
      }
    }
  })

  if (currentPageWeeks.length > 0) {
    pages.push(currentPageWeeks)
  }

  return pages
}

type VectorCardColor = [number, number, number]

interface VectorStaffCardPalette {
  fill: VectorCardColor
  border: VectorCardColor
  accent: VectorCardColor
  badge: VectorCardColor
}

function getVectorStaffCardPalette(shift: ShiftItemData): VectorStaffCardPalette {
  const absenceType = String((shift as any).absenceType || '').toUpperCase()
  const isVacation = Boolean((shift as any).isVacation) || absenceType === 'FÉRIAS'
  const isOff = Boolean(shift.isWeekendOff) || absenceType === 'FOLGA'

  if (isVacation) {
    return {
      fill: [250, 245, 255],
      border: [168, 85, 247],
      accent: [126, 34, 206],
      badge: [126, 34, 206],
    }
  }
  if (isOff) {
    return {
      fill: [255, 251, 235],
      border: [245, 158, 11],
      accent: [217, 119, 6],
      badge: [217, 119, 6],
    }
  }
  if (shift.periodLetter === 'N') {
    return {
      fill: [241, 245, 249],
      border: [148, 163, 184],
      accent: [30, 58, 138],
      badge: [30, 58, 138],
    }
  }
  return {
    fill: [255, 255, 255],
    border: [148, 163, 184],
    accent: [4, 120, 87],
    badge: [4, 120, 87],
  }
}

/**
 * Desenha um card vetorial ao redor dos dados de um colaborador.
 * O contorno arredondado replica no PDF o mesmo agrupamento visual usado
 * pelos cards dos demais setores, sem rasterizar a página.
 */
function drawVectorStaffCard(
  doc: jsPDF,
  shift: ShiftItemData,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const palette = getVectorStaffCardPalette(shift)
  const radius = 1.6
  const paddingX = 3.2
  const absenceType = String((shift as any).absenceType || '').toUpperCase()
  const statusLabel =
    absenceType === 'FÉRIAS'
      ? 'FÉRIAS'
      : shift.isWeekendOff || absenceType === 'FOLGA'
        ? 'FOLGA'
        : shift.periodLetter

  doc.setLineWidth(0.25)
  doc.setDrawColor(...palette.border)
  doc.setFillColor(...palette.fill)
  doc.roundedRect(x, y, width, height, radius, radius, 'FD')

  // Faixa lateral de identificação do plantão, preservando o contorno externo.
  doc.setFillColor(...palette.accent)
  doc.roundedRect(x + 0.45, y + 0.45, 1.45, height - 0.9, 0.7, 0.7, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.7)
  const badgeWidth = Math.max(6.3, doc.getTextWidth(statusLabel) + 2.4)
  const badgeX = x + width - badgeWidth - 1.4
  const badgeY = y + 1.6
  doc.setFillColor(...palette.badge)
  doc.roundedRect(badgeX, badgeY, badgeWidth, 4.5, 1.1, 1.1, 'F')
  doc.setTextColor(255, 255, 255)
  doc.text(statusLabel, badgeX + badgeWidth / 2, badgeY + 3.05, { align: 'center' })

  const textX = x + paddingX
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.2)
  const nameWidth = Math.max(10, badgeX - textX - 1.2)
  const nameLines = doc.splitTextToSize(shift.name || 'Sem nome', nameWidth).slice(0, 2)
  doc.setTextColor(15, 23, 42)
  doc.text(nameLines, textX, y + 4.1)

  const detailsY = y + (nameLines.length > 1 ? 10.1 : 8.1)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.3)
  doc.setTextColor(71, 85, 105)
  const detailLines = [shift.corenText, shift.timeRange].filter(Boolean) as string[]
  if (detailLines.length > 0) {
    doc.text(detailLines.slice(0, 2), textX, detailsY)
  }
}

function drawVectorPageHeader(
  doc: jsPDF,
  templateData: ReturnType<typeof prepareCalendarTemplateData>,
  subtitle: string,
): void {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(6, 95, 70)
  doc.text(templateData.title, 5, 9)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(71, 85, 105)
  doc.text(subtitle || 'Escala de colaboradores', 5, 14)

  try {
    doc.addImage(templateData.logoBase64, 'PNG', 274, 2.5, 17, 13, 'bpscs-logo', 'FAST')
  } catch {
    // Mantém o cabeçalho textual caso o logotipo não seja decodificado.
  }
}

function renderCalendarPagesAsVector(
  doc: jsPDF,
  pages: CalendarPageData[],
  templateData: ReturnType<typeof prepareCalendarTemplateData>,
  subtitle: string,
  generatedAt: string,
): void {
  const pagesToRender: CalendarPageData[] =
    pages.length > 0 ? pages : [{ pageType: 'week', pageIndex: 0 }]

  pagesToRender.forEach((pageData, pageIndex) => {
    if (pageIndex > 0) doc.addPage('a4', 'landscape')
    drawVectorPageHeader(doc, templateData, subtitle)

    if (pageData.weekData) {
      const week = pageData.weekData
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(15, 23, 42)
      doc.text(
        `Semana ${week.weekIndex} de ${week.weekTotal} — ${week.startDateFormatted} a ${week.endDateFormatted}`,
        5,
        20,
      )

      const cells = week.days.map(() => '')

      autoTable(doc, {
        startY: 23,
        head: [templateData.weekDayHeaders],
        body: [cells],
        theme: 'grid',
        tableWidth: PDF_CONTENT_WIDTH_MM,
        columnStyles: {
          0: { cellWidth: PDF_WEEK_COLUMN_WIDTH_MM },
          1: { cellWidth: PDF_WEEK_COLUMN_WIDTH_MM },
          2: { cellWidth: PDF_WEEK_COLUMN_WIDTH_MM },
          3: { cellWidth: PDF_WEEK_COLUMN_WIDTH_MM },
          4: { cellWidth: PDF_WEEK_COLUMN_WIDTH_MM },
          5: { cellWidth: PDF_WEEK_COLUMN_WIDTH_MM },
          6: { cellWidth: PDF_WEEK_COLUMN_WIDTH_MM },
        },
        margin: {
          left: PDF_HORIZONTAL_MARGIN_MM,
          right: PDF_HORIZONTAL_MARGIN_MM,
          top: 23,
          bottom: 9,
        },
        styles: {
          font: 'helvetica',
          fontSize: 7.1,
          cellPadding: 1.5,
          overflow: 'linebreak',
          valign: 'top',
          lineColor: [148, 163, 184],
          lineWidth: 0.15,
          // 169 mm de corpo + 8 mm de cabeçalho ocupam praticamente toda
          // a altura útil entre y=23 mm e a margem inferior de 9 mm.
          minCellHeight: 169,
        },
        headStyles: {
          fillColor: [6, 95, 70],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          minCellHeight: 8,
        },
        didParseCell: (hookData: any) => {
          if (hookData.section === 'body' && hookData.row.index === 0) {
            // O conteúdo é desenhado manualmente para permitir cards arredondados vetoriais.
            hookData.cell.text = []
          }
        },
        didDrawCell: (hookData: any) => {
          if (hookData.section !== 'body' || hookData.row.index !== 0) return
          const day = week.days[hookData.column.index]
          if (!day) return

          const cell = hookData.cell
          const dateY = cell.y + 5.2
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7.2)
          doc.setTextColor(15, 23, 42)
          doc.text(day.dayFormatted, cell.x + cell.width / 2, dateY, { align: 'center' })

          const items: ShiftItemData[] = [
            ...day.shifts,
            ...day.weekendOffs.map((off) => ({
              staffId: off.id,
              name: off.name,
              periodLetter: 'D' as const,
              corenText: '',
              isWeekendOff: true,
            })),
          ]
          const visibleItems = items.slice(0, 4)
          const hiddenCount = items.length - visibleItems.length

          if (visibleItems.length === 0) {
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(6.3)
            doc.setTextColor(100, 116, 139)
            doc.text('Sem plantões', cell.x + cell.width / 2, dateY + 7, { align: 'center' })
            return
          }

          const cardX = cell.x + 1.45
          const cardWidth = cell.width - 2.9
          const cardGap = 2
          const cardsTop = cell.y + 8.3
          const overflowLabelHeight = hiddenCount > 0 ? 5 : 0
          const availableHeight = cell.height - 10.5 - overflowLabelHeight
          const cardHeight = Math.min(
            32,
            Math.max(
              18,
              (availableHeight - cardGap * (visibleItems.length - 1)) / visibleItems.length,
            ),
          )

          visibleItems.forEach((shift, itemIndex) => {
            drawVectorStaffCard(
              doc,
              shift,
              cardX,
              cardsTop + itemIndex * (cardHeight + cardGap),
              cardWidth,
              cardHeight,
            )
          })

          if (hiddenCount > 0) {
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(5.7)
            doc.setTextColor(71, 85, 105)
            doc.text(
              `+${hiddenCount} na continuação`,
              cell.x + cell.width / 2,
              cell.y + cell.height - 2.2,
              { align: 'center' },
            )
          }
        },
      })
    } else {
      const overflowDays =
        pageData.overflowDays ||
        (pageData.continuationDay
          ? [
              {
                dayFormatted: pageData.continuationDay.dayFormatted,
                dateKey: pageData.continuationDay.dateKey || pageData.continuationDay.dayFormatted,
                dayOfWeekName: pageData.continuationDay.dayOfWeekName || '',
                isWeekend: pageData.continuationDay.isWeekend,
                remainingShifts: pageData.continuationDay.shifts,
                remainingWeekendOffs: pageData.continuationDay.weekendOffs,
              },
            ]
          : [])

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(15, 23, 42)
      doc.text('Continuação — somente excedentes após os 4 primeiros', 5, 20)

      const rows: string[][] = []
      overflowDays.forEach((day) => {
        day.remainingShifts.forEach((shift) => {
          const dayLabel = day.dayOfWeekName
            ? day.dayFormatted + ' (' + day.dayOfWeekName + ')'
            : day.dayFormatted
          rows.push([
            dayLabel,
            shift.name,
            shift.corenText || '-',
            shift.periodLetter === 'D'
              ? 'Dia'
              : shift.periodLetter === 'N'
                ? 'Noite'
                : shift.periodLetter,
            shift.timeRange || '-',
          ])
        })
        day.remainingWeekendOffs.forEach((off) => {
          const dayLabel = day.dayOfWeekName
            ? day.dayFormatted + ' (' + day.dayOfWeekName + ')'
            : day.dayFormatted
          rows.push([dayLabel, off.name, '-', 'Folga FDS', '-'])
        })
      })

      autoTable(doc, {
        startY: 23,
        head: [['Data', 'Colaborador', 'COREN/Registro', 'Período', 'Horário']],
        body: rows,
        theme: 'grid',
        tableWidth: PDF_CONTENT_WIDTH_MM,
        margin: {
          left: PDF_HORIZONTAL_MARGIN_MM,
          right: PDF_HORIZONTAL_MARGIN_MM,
          top: 23,
          bottom: 9,
        },
        styles: {
          font: 'helvetica',
          fontSize: 8,
          cellPadding: 1.6,
          overflow: 'linebreak',
          valign: 'middle',
          lineColor: [203, 213, 225],
          lineWidth: 0.15,
        },
        headStyles: {
          fillColor: [6, 95, 70],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: PDF_CONTENT_WIDTH_MM * (44 / 287) },
          1: { cellWidth: PDF_CONTENT_WIDTH_MM * (108 / 287) },
          2: { cellWidth: PDF_CONTENT_WIDTH_MM * (49 / 287) },
          3: { cellWidth: PDF_CONTENT_WIDTH_MM * (38 / 287) },
          4: { cellWidth: PDF_CONTENT_WIDTH_MM * (48 / 287) },
        },
      })
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(100, 116, 139)
    doc.text(`Gerado em: ${generatedAt}`, 5, A4_LANDSCAPE_HEIGHT_MM - 4)
    doc.text(
      `Página ${pageIndex + 1} de ${pagesToRender.length}`,
      A4_LANDSCAPE_WIDTH_MM - 5,
      A4_LANDSCAPE_HEIGHT_MM - 4,
      { align: 'right' },
    )
  })
}

function downloadVectorPdf(doc: jsPDF, filename: string): void {
  const pdfBuffer = doc.output('arraybuffer')
  const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' })
  const objectUrl = URL.createObjectURL(pdfBlob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

/**
 * Exporta a escala gerada por IA como PDF vetorial A4 Landscape.
 * Não há captura do DOM, canvas, data URL ou bitmap de página.
 */
export async function exportAutoGenerateCalendarPdf(
  params: ExportAutoGenerateCalendarPdfParams,
): Promise<string> {
  const { title = 'Escala de Plantões — Calendário', sectorName, cycleName, cycleStart } = params

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  doc.setProperties({
    title,
    subject: sectorName ? `Escala Calendário - ${sectorName}` : 'Escala Calendário',
    author: 'Gestão de Escalas BP — IA',
  })

  const { pages, templateData } = prepareCalendarMultiPageData(params)
  const now = new Date()
  const generatedAt = `${String(now.getDate()).padStart(2, '0')}/${String(
    now.getMonth() + 1,
  ).padStart(2, '0')}/${now.getFullYear()} às ${String(now.getHours()).padStart(
    2,
    '0',
  )}:${String(now.getMinutes()).padStart(2, '0')}`

  const subtitleParts: string[] = []
  if (templateData.sectorName) subtitleParts.push(`Setor: ${templateData.sectorName}`)
  if (cycleName) subtitleParts.push(`Ciclo: ${cycleName}`)
  else if (templateData.cycleStart && templateData.cycleEnd) {
    subtitleParts.push(`Período: ${templateData.cycleStart} a ${templateData.cycleEnd}`)
  } else if (templateData.cycleStart) {
    subtitleParts.push(`Início: ${templateData.cycleStart}`)
  }

  renderCalendarPagesAsVector(doc, pages, templateData, subtitleParts.join(' • '), generatedAt)

  if ((params as any).returnDoc) return doc as any

  const filename = formatSafeFilename(cycleStart)
  if (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  ) {
    downloadVectorPdf(doc, filename)
  }
  return filename
}

/**
 * Parâmetros para exportação do Relatório "Lista por dia" da Escala Gerada por IA
 */
export interface ExportAutoGenerateDailyListPdfParams {
  title?: string
  sectorName?: string
  cycleName?: string
  cycleStart?: string
  cycleEnd?: string
  draftShifts: any[]
  contracts: any[]
  staffProfiles: Array<{
    id: string
    name: string
    professional_id?: string | null
    [key: string]: any
  }>
}

/**
 * Exporta a escala gerada por IA no formato "Lista por dia" com COREN
 */
export function exportAutoGenerateDailyListPdf(
  params: ExportAutoGenerateDailyListPdfParams,
): string {
  const {
    title = 'Escala de Plantões — Rascunho',
    sectorName,
    cycleName,
    cycleStart,
    cycleEnd,
    draftShifts,
    contracts,
    staffProfiles,
  } = params

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  doc.setProperties({
    title: `Escala - ${sectorName || 'Setor'}`,
    subject: 'Rascunho de escala gerado por IA (Lista por dia)',
    author: 'Gestão de Escalas BP',
  })

  const sortedShifts = [...draftShifts].sort((a, b) =>
    String(a.start_time).localeCompare(String(b.start_time)),
  )

  const body = sortedShifts.map((shift) => {
    const profileId = shift.staff_profile || shift.user
    const matchedProfile = staffProfiles.find((sp) => sp.id === profileId)
    const contract = contracts.find((item) => (item.staff_profile || item.user) === profileId)
    const shiftType = contract?.expand?.shift_type
    const startValue = String(shift.start_time || '')
    const endValue = String(shift.end_time || '')
    const dateKey = startValue.split(/[ T]/)[0]
    const displayDate = dateKey ? new Date(`${dateKey}T12:00:00`) : new Date('')
    const startTime = (startValue.split(/[ T]/)[1] || '').substring(0, 5)
    const endTime = (endValue.split(/[ T]/)[1] || '').substring(0, 5)

    const professionalId =
      shift.expand?.staff_profile?.professional_id ??
      matchedProfile?.professional_id ??
      shift.professional_id ??
      null

    const corenText = formatCorenLabel(professionalId)
    const name =
      shift.expand?.staff_profile?.name ||
      shift.expand?.user?.name ||
      matchedProfile?.name ||
      shift.name ||
      'Sem nome'

    const dateFormatted = !isNaN(displayDate.getTime())
      ? `${String(displayDate.getDate()).padStart(2, '0')}/${String(
          displayDate.getMonth() + 1,
        ).padStart(2, '0')}/${displayDate.getFullYear()}`
      : ''

    const dayOfWeekShort = !isNaN(displayDate.getTime())
      ? ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][displayDate.getDay()]
      : ''

    return [
      dateFormatted,
      dayOfWeekShort,
      name,
      corenText,
      shiftType?.name || shiftType?.code || 'Padrão',
      startTime,
      endTime,
      shift.expand?.sector?.name || sectorName || 'Sem setor',
    ]
  })

  autoTable(doc, {
    startY: 34,
    head: [['Data', 'Dia', 'Colaborador', 'COREN', 'Tipo', 'Início', 'Fim', 'Setor']],
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 1.6,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [241, 245, 249],
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 12 },
      2: { cellWidth: 55 },
      3: { cellWidth: 36 },
      4: { cellWidth: 34 },
      5: { cellWidth: 16 },
      6: { cellWidth: 16 },
      7: { cellWidth: 46 },
    },
    margin: { top: 34, right: 14, bottom: 14, left: 14 },
    showHead: 'everyPage',
    didDrawPage: () => {
      try {
        if (typeof (doc as any).addImage === 'function') {
          doc.addImage(SIDEBAR_HOSPITAL_LOGO, 'PNG', 14, 5, 18, 18)
        }
      } catch (imgErr) {
        console.warn('Falha ao renderizar logo no PDF Lista por dia (didDrawPage):', imgErr)
      }

      // Identidade institucional, título e metadados repetidos no topo de cada página
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(5, 120, 80)
      doc.text('Beneficência Portuguesa de São Caetano do Sul', 36, 10)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.setTextColor(30, 41, 59)
      doc.text(title, 36, 17)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(71, 85, 105)
      doc.text(
        `Setor: ${sectorName || 'Sem setor'}   |   Ciclo: ${cycleName || 'Sem ciclo'}   |   Total: ${body.length} plantões`,
        36,
        23,
      )

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(180, 83, 9)
      doc.text('Documento não publicado', 36, 28)
      doc.setTextColor(0, 0, 0)
    },
  })

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(
      `Página ${page} de ${pageCount}`,
      doc.internal.pageSize.getWidth() - 14,
      doc.internal.pageSize.getHeight() - 7,
      { align: 'right' },
    )
  }

  const filename = formatSafeFilename(cycleStart)
  doc.save(filename)
  return filename
}
