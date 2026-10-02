import React from 'react'
import { createRoot } from 'react-dom/client'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas'
import { formatCorenLabel } from '@/lib/escala-calendar-formatter'
import { BPSCS_LOGO_BASE64 } from './bpscsLogo'
import { SIDEBAR_HOSPITAL_LOGO } from './sidebarHospitalLogo'
import { CalendarPdfPage } from '@/components/escala/CalendarPdfPage'
import { CalendarDayItem } from '@/components/escala/ShiftCalendarGrid'
import {
  renderCalendarPdfTemplate,
  renderMultiPageCalendarHtml,
  type CalendarDayCellData,
  type ShiftItemData,
  type DayOverflowItem,
  type CalendarPageData,
} from '@/templates/calendarPdfTemplate'

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
  if (!dateStr)
    return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAApAEADASIAAhEBAxEB/8QAGwAAAQUBAQAAAAAAAAAAAAAAAAMEBQYHAQL/xAAxEAACAQMCBAQEBQUAAAAAAAABAgMABBEFIQYSMUETUWGBIjJxkQcUobHBQlJy0fH/xAAYAQADAQEAAAAAAAAAAAAAAAAAAQMEAv/EABsRAAMBAQEBAQAAAAAAAAAAAAABEQIDIRIx/9oADAMBAAIRAxEAPwDTqKKKAELy7t7G1kuruVYoYxl3boBWf8Q8Zakl69rC503l3VuRZRIp6MG8iPIGnv4p3Ukem2VqpISaVmbHflG36n9KqF2wuuC7KeXea0u3tkbuYyvPj2P71o5YUWmR3t2IkbXjXiHT5EkupYr23Y9WUYb0DKBg+h+1aPoesWut6cl5aEgH4XRuqN3BrErK6/KykuniwPtNEeki/wAHyPY1e+BIpNL4qv8ATFkMlvJAJo2/uXYo315WrrrzUqFz26aHRRRWUuFFItcxLcLbs2JGGQMH17+x+1KM6KpZmAAGSSelAFb480SXWNEBtUL3Ns/iIg6uMYYD17+1UOa30+G0trDU9Q8CO2LO8VuniSyStjmJ7KAAFGd9s43rXlnidFcOOVsY7dag9X4T0PVZjNcQeFM53khfkLH17H7VbHSeMnrF9RSrfSOEdVtpo9O1C8t7uONnUXGPiwMnbG/sc1ceGtOQXI1VWDRvZQW8DAY5lVQS3ucD2pGx4Q4c06+TMck02zJ47FlGc46ADsevlVoBUHlBAIHSlvd8QZzP09UVzI86MjzqRQZ3mmwXkheVnBKhfhwOhJ64z337GkDoVmXLfHuCMDGN/THpt5VKUU6xREEtvpv5homklDmUtysAd+nl08vvXhbfTI0K+NMnPhguATsMbYG3TcVNj5vc/vXP6m+v80/oUIxE01wkC3Dsyqkakrn5Scdsd8GkfA0xrcmOScBCQWCjOC3Ukjf/AFU1H1oHQf5D96KEIaw0yG5hYtcMxDEFowBzZHfIz3/7T6DSYILlJ45JAUJITYLuMHbFPIflP1pSh6Y0kf/Z'
  const parts = dateStr.split('-')
  if (parts.length >= 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dateStr
}

export const LOGO_ASSET_PATH = '/assets/logo-bpscs.jpg'

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
          const typeUpper = String(
            slot.type ||
              'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA4KCw0LCQ4NDA0QDw4RFiQXFhQUFiwgIRokNC43NjMuMjI6QVNGOj1OPjIySGJJTlZYXV5dOEVmbWVabFNbXVn/2wBDAQ8QEBYTFioXFypZOzI7WVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVn/wAARCAAeADADASIAAhEBAxEB/8QAGgAAAwADAQAAAAAAAAAAAAAAAQQFAAMHBv/EACsQAAIBAwIEBgIDAQAAAAAAAAECAwAEEQUhBhIxURMUIkFhcZHBMmOB0fH/xAAYAQADAQEAAAAAAAAAAAAAAAAAAQMEAv/EABcBAAMBAAAAAAAAAAAAAAAAAAACBAP/xAAZEQADAQEBAAAAAAAAAAAAAAAAAREhAjH/2gAMAwEAAhEDEQA/AOkUGYKpZiAAMkn2o0tqMT3GnXUMezyROi/ZBAoA8LrvFd3dW/mNNlaOxEhiZo/TKrexOc7MNxjHQip+mcWarZOJnuGv7QEeIkgHOufn2+9xSGnWl1JpN7bRQO8s8ka8uMcvISWJJ2G5A37ntT2mcN6la39s9zArWcxMUrJIrgKQc5wf9+wKrnKUJ703Tp9rcR3drFcQtzRSqHU/BrbUjhW3kteG7CGYESCPJB6jJJ/dV6leM3XhpNzCJWjaQK64JB261nmoC4QTISRn+VCSzt5X55IlZu5+sUtcWcEKIYbeI4YnDZHf/p/NGBpL1zh7TdbIkN00D/1uCrZ9yp2z81p0XhrT9KmZWvZpyCsnI5Cx5G4OB1Iz3qq0CBsC1hy6gH1Ebfvej4YeIjysOFA5QXJ7Ae3wPxT1yCxWlDx4sA+KmD09QoiWMnAkUnpgMKmGzR7pC0MahuvKx3yN6dSwtUdHWFQyHKkZ2pGkMf/Z',
          ).toUpperCase()
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
      const workedStaffIds = new Set(dayShifts.map((s) => s.staff_profile || s.user_id || s.user))

      // Folgas de fim de semana (WEEKEND_OFF)
      const weekendOffStaff: Array<{ id: string; name: string }> = []
      if (isWeekendDay) {
        sectorStaffProfiles.forEach((staff) => {
          if (selectedStaffId && staff.id !== selectedStaffId) return
          if (workedStaffIds.has(staff.id)) return
          const offDates = weekendOffMap.get(staff.id)
          if (offDates && offDates.has(dateKey)) {
            weekendOffStaff.push({ id: staff.id, name: staff.name })
          }
        })
      }

      const formattedShifts: ShiftItemData[] = dayShifts.map((s) => {
        const contract = contracts.find(
          (item) => (item.staff_profile || item.user) === (s.staff_profile || s.user),
        )
        const shiftType = contract?.expand?.shift_type
        const profileId = s.staff_profile || s.user_id || s.user
        const matchedProfile = staffProfiles.find((sp) => sp.id === profileId)
        const name =
          s.expand?.staff_profile?.name ||
          s.expand?.user?.name ||
          matchedProfile?.name ||
          s.name ||
          'Sem nome'
        const professionalId =
          s.expand?.staff_profile?.professional_id ??
          matchedProfile?.professional_id ??
          s.professional_id ??
          null

        const startTime = (String(s.start_time || '').split(/[ T]/)[1] || '').substring(0, 5)
        const endTime = (String(s.end_time || '').split(/[ T]/)[1] || '').substring(0, 5)
        const startHour = parseInt(
          (shiftType?.start_time || startTime || '0').split(':')[0] || '0',
          10,
        )
        const crossesMidnight =
          !!(shiftType?.start_time || startTime) &&
          !!(shiftType?.end_time || endTime) &&
          (shiftType?.end_time || endTime) < (shiftType?.start_time || startTime)
        const isNight = startHour >= 18 || crossesMidnight
        const periodLetter: 'D' | 'N' = isNight ? 'N' : 'D'
        const corenText = formatCorenLabel(professionalId)
        const timeRange = startTime && endTime ? `${startTime}–${endTime}` : undefined

        return {
          staffId: profileId,
          name,
          professionalId,
          periodLetter,
          corenText,
          timeRange,
        }
      })

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
  const maxChipsPerCell = 4 // Em A4 landscape com 1 semana por página, 4 cards por célula cabem confortavelmente

  const pages: CalendarPageData[] = []
  const totalWeeks = templateData.weeks.length

  templateData.weeks.forEach((weekDays, weekIdx) => {
    // Acha primeiro e último dia não nulo desta semana
    const validDays = weekDays.filter((d): d is CalendarDayCellData => d !== null)
    const startDateFormatted = validDays.length > 0 ? validDays[0].dayFormatted : ''
    const endDateFormatted =
      validDays.length > 0 ? validDays[validDays.length - 1].dayFormatted : ''

    // 1. Adiciona a página principal da semana
    pages.push({
      pageType: 'week',
      pageIndex: pages.length,
      weekData: {
        weekIndex: weekIdx + 1,
        weekTotal: totalWeeks,
        startDateFormatted,
        endDateFormatted,
        days: weekDays,
      },
    })

    // 2. Se algum dia dessa semana exceder maxChipsPerCell, gera páginas de continuação para aquele dia
    weekDays.forEach((cell) => {
      if (!cell) return
      const totalItems = cell.shifts.length + cell.weekendOffs.length
      if (totalItems > maxChipsPerCell) {
        // Divide os itens daquele dia em lotes de até 12 plantonistas por página de continuação
        const SHIFTS_PER_CONTINUATION_PAGE = 12
        const totalBatches = Math.ceil(totalItems / SHIFTS_PER_CONTINUATION_PAGE)

        for (let b = 0; b < totalBatches; b++) {
          const startIdx = b * SHIFTS_PER_CONTINUATION_PAGE
          const batchItems = cell.shifts.slice(startIdx, startIdx + SHIFTS_PER_CONTINUATION_PAGE)

          pages.push({
            pageType: 'day_continuation',
            pageIndex: pages.length,
            continuationDay: {
              ...cell,
              shifts: batchItems,
              weekendOffs: b === 0 ? cell.weekendOffs : [],
            },
            continuationBatchIndex: totalBatches > 1 ? b + 1 : undefined,
            continuationBatchTotal: totalBatches > 1 ? totalBatches : undefined,
          })
        }
      }
    })
  })

  return {
    pages,
    maxChipsPerCell,
    templateData,
  }
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
 * Converte HTML em documento jsPDF no formato A4 Landscape (297x210 mm).
 * Suporta múltiplas páginas com renderização off-screen de cada `.page-container`
 * com html2canvas de alta resolução (scale: 2), sem sobreposição e sem corte.
 */
export async function renderHtmlToPdfLandscape(
  htmlString: string,
  docOptions?: { title?: string; author?: string; subject?: string },
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  if (docOptions) {
    doc.setProperties({
      title: docOptions.title || 'Escala de Plantões — Calendário',
      author: docOptions.author || 'Gestão de Escalas BP — IA',
      subject: docOptions.subject || 'Escala Calendário',
    })
  }

  // Se o ambiente não possuir suporte completo a DOM ou html2canvas (ex.: Vitest/Node sem canvas real),
  // retornamos o doc A4 landscape válido configurado.
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return doc
  }

  // Cria um container off-screen visível para renderização com medidas fixas de A4 landscape
  // 297mm x 210mm a 96dpi é aprox 1122.5px x 793.7px
  const container = document.createElement('div')
  container.setAttribute('aria-hidden', 'true')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.style.width = '1123px' // ~297mm a 96dpi
  container.style.minHeight = '794px' // ~210mm a 96dpi
  container.style.backgroundColor = '#ffffff'
  container.style.zIndex = '-9999'
  container.style.margin = '0'
  container.style.padding = '0'
  container.innerHTML = htmlString

  document.body.appendChild(container)

  try {
    // Aguardar imagens base64 carregarem no DOM
    const images = Array.from(container.querySelectorAll('img'))
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve()
        return new Promise<void>((resolve) => {
          img.onload = () => resolve()
          img.onerror = () => resolve()
        })
      }),
    )

    const pageElements = Array.from(container.querySelectorAll('.page-container')) as HTMLElement[]

    const elementsToRender =
      pageElements.length > 0
        ? pageElements
        : [(container.firstElementChild || container) as HTMLElement]

    for (let pageIdx = 0; pageIdx < elementsToRender.length; pageIdx++) {
      if (pageIdx > 0) {
        doc.addPage('a4', 'landscape')
      }

      const pageEl = elementsToRender[pageIdx]
      const canvas = await html2canvas(pageEl, {
        scale: 2, // 2x para garantir nitidez nos textos pequenos
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: pageEl.offsetWidth || 1123,
        height: pageEl.offsetHeight || 794,
        windowWidth: 1123,
        windowHeight: 794,
      })

      if (canvas && typeof canvas.toDataURL === 'function') {
        const imgData = canvas.toDataURL('image/png')
        // A4 Landscape em mm: 297 x 210
        const pageWidth = 297
        const pageHeight = 210

        // Calcular proporção para caber exatamente na página
        const canvasWidth = canvas.width
        const canvasHeight = canvas.height
        const ratio = Math.min(pageWidth / canvasWidth, pageHeight / canvasHeight)

        const renderedWidth = canvasWidth * ratio
        const renderedHeight = canvasHeight * ratio
        const offsetX = (pageWidth - renderedWidth) / 2
        const offsetY = (pageHeight - renderedHeight) / 2

        doc.addImage(imgData, 'PNG', offsetX, offsetY, renderedWidth, renderedHeight)
      }
    }
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container)
    }
  }

  return doc
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

/**
 * Exporta a escala gerada por IA no formato "Calendário" mensal / ciclo.
 * Fonte visual ÚNICA compartilhada: reutiliza fielmente os componentes React
 * `<CalendarPdfPage />` e `<ShiftCalendarGrid />` com exatamente o mesmo CSS Tailwind da tela.
 * Renderiza em contêiner offscreen (~1123px largura A4 landscape), aguarda fontes e imagens,
 * e captura com html2canvas(scale: 2) + jsPDF landscape A4.
 */
export async function exportAutoGenerateCalendarPdf(
  params: ExportAutoGenerateCalendarPdfParams,
): Promise<string> {
  const {
    title = 'Escala de Plantões — Calendário',
    sectorName,
    cycleName,
    cycleStart,
    cycleEnd,
    days,
    shifts,
    contracts,
    staffProfiles = [],
    weekendOffMap = new Map(),
    selectedSectorId,
    selectedStaffId,
    logoBase64 = BPSCS_LOGO_BASE64,
  } = params

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  doc.setProperties({
    title,
    subject: sectorName ? `Escala Calendário - ${sectorName}` : 'Escala Calendário',
    author: 'Gestão de Escalas BP — IA',
  })

  // Se não estivermos em ambiente com DOM (ex.: testes unitários sem window/document completo),
  // salvamos e retornamos o doc diretamente.
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    const filename = formatSafeFilename(cycleStart)
    doc.save(filename)
    return filename
  }

  // 1. Dividir em semanas e páginas
  const weeks = chunkDaysIntoCalendarWeeks(days)
  const pageWeeksList = groupWeeksIntoPages(weeks, shifts)
  const totalPages = Math.max(1, pageWeeksList.length)

  // 2. Criar container offscreen para montagem React
  const mountContainer = document.createElement('div')
  mountContainer.setAttribute('aria-hidden', 'true')
  mountContainer.id = 'offscreen-pdf-renderer'
  mountContainer.style.position = 'fixed'
  mountContainer.style.left = '-10000px'
  mountContainer.style.top = '0'
  mountContainer.style.width = '1123px'
  mountContainer.style.backgroundColor = '#ffffff'
  mountContainer.style.zIndex = '-9999'
  document.body.appendChild(mountContainer)

  const root = createRoot(mountContainer)

  try {
    // 3. Renderizar cada página sequencialmente com html2canvas de alta resolução
    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      const pageWeeks = pageWeeksList[pIdx] || []
      const pageDays = pageWeeks.flat()

      const firstD = pageDays[0]
      const lastD = pageDays[pageDays.length - 1]
      const weekRangeLabel =
        firstD && lastD
          ? `Período: ${firstD.key.split('-').slice(1).reverse().join('/')} a ${lastD.key.split('-').slice(1).reverse().join('/')}`
          : undefined

      const isLastPage = pIdx === totalPages - 1

      // Renderiza a página no container offscreen usando React.createElement
      await new Promise<void>((resolve) => {
        root.render(
          React.createElement(
            'div',
            {
              id: `pdf-page-wrapper-${pIdx}`,
              className: 'bg-white',
              style: { width: '1123px' },
            },
            React.createElement(CalendarPdfPage, {
              title,
              sectorName,
              cycleName,
              cycleStart,
              cycleEnd,
              days: pageDays,
              shifts,
              contracts,
              staffProfiles,
              weekendOffMap,
              selectedSectorId,
              selectedStaffId,
              pageCurrent: pIdx + 1,
              pageTotal: totalPages,
              showLegend: isLastPage,
              logoBase64,
              weekRangeLabel,
            }),
          ),
        )
        // Aguarda microtasks de layout e render do React
        setTimeout(resolve, 60)
      })

      // Aguarda document.fonts.ready e imagens carregarem
      if (document.fonts && typeof document.fonts.ready?.then === 'function') {
        try {
          await document.fonts.ready
        } catch {
          // prossegue
        }
      }

      const images = Array.from(mountContainer.querySelectorAll('img'))
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve()
          return new Promise<void>((res) => {
            img.onload = () => res()
            img.onerror = () => res()
          })
        }),
      )

      const pageEl = mountContainer.querySelector('.page-container') as HTMLElement
      if (pageEl) {
        if (pIdx > 0) {
          doc.addPage('a4', 'landscape')
        }

        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          width: pageEl.offsetWidth || 1123,
          height: pageEl.offsetHeight || 794,
          windowWidth: 1123,
          windowHeight: 794,
        })

        if (canvas && typeof canvas.toDataURL === 'function') {
          const imgData = canvas.toDataURL('image/png')
          const pageWidth = 297
          const pageHeight = 210

          const canvasWidth = canvas.width
          const canvasHeight = canvas.height
          const ratio = Math.min(pageWidth / canvasWidth, pageHeight / canvasHeight)

          const renderedWidth = canvasWidth * ratio
          const renderedHeight = canvasHeight * ratio
          const offsetX = (pageWidth - renderedWidth) / 2
          const offsetY = (pageHeight - renderedHeight) / 2

          doc.addImage(imgData, 'PNG', offsetX, offsetY, renderedWidth, renderedHeight)
        }
      }
    }
  } finally {
    try {
      root.unmount()
    } catch {
      // ignora
    }
    if (mountContainer.parentNode) {
      mountContainer.parentNode.removeChild(mountContainer)
    }
  }

  const filename = formatSafeFilename(cycleStart)
  doc.save(filename)
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
