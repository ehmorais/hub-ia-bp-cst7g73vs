import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface ShiftSlot {
  type: 'day' | 'night' | 'morning' | 'afternoon' | 'leave' | string
  start?: string
  end?: string
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
