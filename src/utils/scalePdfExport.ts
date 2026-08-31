import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCorenLabel } from '@/lib/escala-calendar-formatter'

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
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length >= 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dateStr
}

export const LOGO_ASSET_PATH = '/assets/logo-bpscs.jpg'

// Beneficência Portuguesa São Caetano do Sul Logo (incorporado em Base64 para funcionamento 100% offline)
export const BPSCS_LOGO_BASE64 =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAEgAKADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/2Q=='

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

    // Header Title & Subtitle
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(30, 41, 59)
    doc.text(title, 14, 12)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)

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

    if (subtitleParts.length > 0) {
      doc.text(subtitleParts.join(' | '), 14, 18)
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
      startY: 23,
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
      margin: { top: 12, right: 10, bottom: 12, left: 10 },
      showHead: 'everyPage',
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
}

/**
 * Exporta a escala gerada por IA no formato "Calendário" mensal / ciclo (grade equivalente à tela)
 */
export function exportAutoGenerateCalendarPdf(params: ExportAutoGenerateCalendarPdfParams): string {
  const {
    title = 'Escala de Plantões — Rascunho',
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

  // Dias da semana rotacionados conforme o primeiro dia da lista (idêntico à tela do ShiftCalendar)
  const baseWeekLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const firstDayDow = days.length > 0 ? days[0].dayOfWeek : 0
  const rotatedHeadLabels = [
    ...baseWeekLabels.slice(firstDayDow),
    ...baseWeekLabels.slice(0, firstDayDow),
  ]

  // Montar semanas (linhas de 7 dias)
  const weeks: Array<Array<{ date: Date; key: string; dayOfWeek: number } | null>> = []
  let currentWeek: Array<{ date: Date; key: string; dayOfWeek: number } | null> = []

  days.forEach((dayItem) => {
    currentWeek.push(dayItem)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  })
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null)
    }
    weeks.push(currentWeek)
  }

  // Montar células de dados para cada dia
  const bodyRows = weeks.map((week) => {
    return week.map((dayItem) => {
      if (!dayItem) {
        return {
          content: '',
          styles: { fillColor: [248, 250, 252], textColor: [148, 163, 184] },
        }
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

      // Montar texto descritivo da célula
      const lines: string[] = [`[ ${dayFormatted} ]`]

      dayShifts.forEach((s) => {
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

        lines.push(`• ${name}`)
        lines.push(`  ${periodLetter} • ${corenText}`)
      })

      weekendOffStaff.forEach((staff) => {
        lines.push(`• ${staff.name}`)
        lines.push(`  Folga Fim de Semana`)
      })

      if (dayShifts.length === 0 && weekendOffStaff.length === 0) {
        lines.push('(Sem plantões)')
      }

      return {
        content: lines.join('\n'),
        styles: {
          valign: 'top',
          halign: 'left',
          fillColor: isWeekendDay ? [254, 252, 232] : [255, 255, 255], // Amarelinho bem suave no fim de semana ou branco
          textColor: [30, 41, 59],
        },
      }
    })
  })

  // Cabeçalho da página
  const subtitleParts: string[] = []
  if (sectorName) subtitleParts.push(`Setor: ${sectorName}`)
  if (cycleName) subtitleParts.push(`Ciclo: ${cycleName}`)
  else if (cycleStart && cycleEnd) {
    subtitleParts.push(`Período: ${formatDateDisplay(cycleStart)} a ${formatDateDisplay(cycleEnd)}`)
  }

  autoTable(doc, {
    startY: 28,
    head: [rotatedHeadLabels],
    body: bodyRows as any,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 6.5,
      cellPadding: 1.8,
      overflow: 'linebreak',
      valign: 'top',
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [5, 150, 105], // Esmeralda escuro
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    margin: { top: 28, right: 10, bottom: 12, left: 10 },
    didDrawPage: () => {
      // Logotipo no cabeçalho superior direito (proporção 4:3 ~ 24x18mm)
      try {
        if (typeof (doc as any).addImage === 'function') {
          doc.addImage(BPSCS_LOGO_BASE64, 'JPEG', 263, 6, 24, 18)
        }
      } catch (imgErr) {
        console.warn('Falha ao renderizar logo no PDF Calendário:', imgErr)
      }

      // Título e subtítulo no topo de cada página
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(30, 41, 59)
      doc.text(title, 10, 12)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(71, 85, 105)
      if (subtitleParts.length > 0) {
        doc.text(subtitleParts.join('  |  '), 10, 18)
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(180, 83, 9)
      doc.text('Documento não publicado — Formato Calendário', 10, 23)
      doc.setTextColor(0, 0, 0)
    },
  })

  // Rodapé com número de páginas
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

  // Logotipo no cabeçalho superior direito (proporção 4:3 ~ 24x18mm)
  try {
    if (typeof (doc as any).addImage === 'function') {
      doc.addImage(BPSCS_LOGO_BASE64, 'JPEG', 259, 7, 24, 18)
    }
  } catch (imgErr) {
    console.warn('Falha ao renderizar logo no PDF Lista por dia:', imgErr)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(title, 14, 15)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(
    `Setor: ${sectorName || 'Sem setor'}   |   Ciclo: ${cycleName || 'Sem ciclo'}   |   Total: ${body.length} plantões`,
    14,
    21,
  )
  doc.setTextColor(180, 83, 9)
  doc.text('Documento não publicado', 14, 26)
  doc.setTextColor(0, 0, 0)

  autoTable(doc, {
    startY: 31,
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
    margin: { top: 31, right: 14, bottom: 14, left: 14 },
    didDrawPage: () => {
      try {
        if (typeof (doc as any).addImage === 'function') {
          doc.addImage(BPSCS_LOGO_BASE64, 'JPEG', 259, 7, 24, 18)
        }
      } catch (imgErr) {
        console.warn('Falha ao renderizar logo no PDF Lista por dia (didDrawPage):', imgErr)
      }
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
