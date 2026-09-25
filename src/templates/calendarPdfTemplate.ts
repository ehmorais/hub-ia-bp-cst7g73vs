import { BPSCS_LOGO_BASE64 } from '@/utils/bpscsLogo'

export interface CalendarDayItem {
  date: Date
  key: string // "YYYY-MM-DD"
  dayOfWeek: number // 0 = Dom, 6 = Sáb
}

export interface ShiftItemData {
  staffId: string
  name: string
  professionalId?: string | null
  periodLetter: 'D' | 'N'
  corenText: string
  timeRange?: string
  isWeekendOff?: boolean
}

export interface CalendarDayCellData {
  dayFormatted: string // "DD/MM"
  dayNumber: number // 1..31
  isWeekend: boolean
  isOtherMonth?: boolean
  shifts: ShiftItemData[]
  weekendOffs: Array<{ id: string; name: string }>
}

export interface CalendarPdfTemplateData {
  title: string
  subtitle: string
  logoBase64: string
  monthYearHeader: string
  generatedAt: string
  pageCurrent: number
  pageTotal: number
  weekDayHeaders: string[] // ex: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
  weeksHtml: string
}

/**
 * Template HTML fiel ao padrão institucional Beneficência Portuguesa de São Caetano do Sul (BPSCS).
 * Layout A4 Paisagem (297x210 mm) com proporções equilibradas:
 * - Cabeçalho limpo com logotipo oficial BPSCS no canto superior direito (idêntico ao modelo)
 * - Título e subtítulo organizados à esquerda com tipografia sóbria
 * - Tabela do calendário com cabeçalho institucional em tom esmeralda (#047857)
 * - Células de dias com número em destaque, badges para plantonistas (D verde, N azul escuro, COREN/CRM)
 *   e folgas de fim de semana (FDS)
 * - Rodapé com identificação institucional, data/hora de geração e numeração "Página X de Y"
 *
 * Utiliza placeholders {{TITLE}}, {{SUBTITLE}}, {{LOGO_BASE64}}, {{WEEK_HEADERS_HTML}},
 * {{WEEKS_HTML}}, {{GENERATED_AT}}, {{PAGE_CURRENT}}, {{PAGE_TOTAL}}.
 */
export const CALENDAR_PDF_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>{{TITLE}}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page {
      size: 297mm 210mm landscape;
      margin: 0;
    }
    html, body {
      width: 297mm;
      height: 210mm;
      max-width: 297mm;
      max-height: 210mm;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
    }
    .page-container {
      width: 297mm;
      height: 210mm;
      padding: 8mm 10mm 6mm 10mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      background: #ffffff;
    }

    /* Cabeçalho Institucional alinhado com o modelo BPSCS */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #047857;
      padding-bottom: 8px;
      margin-bottom: 6px;
      min-height: 48px;
    }
    .header-info {
      flex: 1;
      padding-right: 16px;
    }
    .header-org {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #047857;
      margin-bottom: 2px;
    }
    .header-title-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
    }
    .header-badge {
      display: inline-block;
      font-size: 8.5px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 2px 7px;
      border-radius: 3px;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
    }
    .header-subtitle {
      font-size: 9.5px;
      color: #475569;
      margin-top: 3px;
      line-height: 1.3;
      font-weight: 500;
    }
    .header-logo {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }
    .header-logo img {
      height: 40px;
      width: auto;
      max-width: 150px;
      object-fit: contain;
      display: block;
    }

    /* Tabela do calendário A4 Paisagem */
    .calendar-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      overflow: hidden;
      background: #ffffff;
      min-height: 0;
    }
    .calendar-table {
      width: 100%;
      height: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .calendar-table thead th {
      background: #047857;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding: 5px 4px;
      text-align: center;
      border-right: 1px solid #065f46;
      border-bottom: 1px solid #065f46;
      height: 24px;
    }
    .calendar-table thead th:last-child {
      border-right: none;
    }
    .calendar-table tbody td {
      border-right: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
      padding: 3px 4px;
      background: #ffffff;
      position: relative;
    }
    .calendar-table tbody td:last-child {
      border-right: none;
    }
    .calendar-table tbody tr:last-child td {
      border-bottom: none;
    }
    .calendar-table tbody td.weekend-day {
      background: #fafcff;
    }
    .calendar-table tbody td.empty-day {
      background: #f8fafc;
    }

    /* Conteúdo do dia */
    .day-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3px;
      padding-bottom: 2px;
      border-bottom: 1px solid #f1f5f9;
    }
    .day-number {
      font-size: 10.5px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.2px;
    }
    .day-badge-weekend {
      font-size: 7.5px;
      font-weight: 700;
      color: #047857;
      background: #ecfdf5;
      padding: 1px 4px;
      border-radius: 2px;
      border: 1px solid #d1fae5;
      letter-spacing: 0.3px;
    }
    .day-shifts-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;
    }

    /* Fichas de plantonistas */
    .shift-chip {
      font-size: 7.5px;
      line-height: 1.2;
      padding: 2px 3.5px;
      border-radius: 2.5px;
      background: #f8fafc;
      color: #0f172a;
      border-left: 2.5px solid #047857;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }
    .shift-chip.shift-night {
      border-left-color: #1e3a8a;
      background: #f0f7ff;
    }
    .shift-chip.shift-day {
      border-left-color: #047857;
      background: #f0fdf4;
    }
    .shift-chip.shift-off {
      border-left-color: #f59e0b;
      background: #fffbeb;
      color: #92400e;
    }
    .shift-chip-row {
      display: flex;
      align-items: baseline;
      gap: 3px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .shift-period-tag {
      font-weight: 800;
      font-size: 7.5px;
      letter-spacing: 0.2px;
    }
    .shift-night .shift-period-tag {
      color: #1e3a8a;
    }
    .shift-day .shift-period-tag {
      color: #047857;
    }
    .shift-off .shift-period-tag {
      color: #b45309;
    }
    .shift-chip-name {
      font-weight: 600;
      color: #1e293b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .shift-chip-details {
      color: #64748b;
      font-size: 6.8px;
      font-weight: 400;
    }
    .empty-notice {
      font-size: 7.5px;
      color: #94a3b8;
      font-style: italic;
      padding-top: 3px;
      text-align: center;
    }

    /* Rodapé Institucional */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 6px;
      padding-top: 4px;
      border-top: 1px solid #e2e8f0;
      font-size: 8px;
      color: #64748b;
    }
    .footer-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .footer-left strong {
      color: #334155;
      font-weight: 600;
    }
    .footer-divider {
      color: #cbd5e1;
    }
    .footer-right {
      font-weight: 600;
      color: #334155;
      font-size: 8px;
    }
  </style>
</head>
<body>
  <div class="page-container" id="calendar-pdf-page">
    <header class="header">
      <div class="header-info">
        <div class="header-org">Beneficência Portuguesa de São Caetano do Sul</div>
        <div class="header-title-row">
          <h1 class="header-title">{{TITLE}}</h1>
          <span class="header-badge">Formato Calendário</span>
        </div>
        <div class="header-subtitle">
          {{SUBTITLE}}
        </div>
      </div>
      <div class="header-logo">
        <img src="{{LOGO_BASE64}}" alt="Logo Institucional BPSCS" />
      </div>
    </header>

    <main class="calendar-wrapper">
      <table class="calendar-table">
        <thead>
          <tr>
            {{WEEK_HEADERS_HTML}}
          </tr>
        </thead>
        <tbody>
          {{WEEKS_HTML}}
        </tbody>
      </table>
    </main>

    <footer class="footer">
      <div class="footer-left">
        <strong>Beneficência Portuguesa de São Caetano do Sul</strong>
        <span class="footer-divider">|</span>
        <span>Gerado em: {{GENERATED_AT}}</span>
        <span class="footer-divider">|</span>
        <span>Documento confidencial / Uso interno</span>
      </div>
      <div class="footer-right">
        <span>Página {{PAGE_CURRENT}} de {{PAGE_TOTAL}}</span>
      </div>
    </footer>
  </div>
</body>
</html>`

/**
 * Escapa strings contra quebras de injeção HTML dentro do template.
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Preenche o template CALENDAR_PDF_HTML_TEMPLATE com os dados informados.
 */
export function renderCalendarPdfTemplate(data: {
  title?: string
  sectorName?: string
  cycleName?: string
  cycleStart?: string
  cycleEnd?: string
  generatedAt?: string
  pageCurrent?: number
  pageTotal?: number
  weekDayHeaders: string[]
  weeks: Array<Array<CalendarDayCellData | null>>
  logoBase64?: string
}): string {
  const title = data.title || 'Escala de Plantões — Calendário'
  const logo = data.logoBase64 || BPSCS_LOGO_BASE64

  const subtitleParts: string[] = []
  if (data.sectorName) subtitleParts.push(`Setor: ${data.sectorName}`)
  if (data.cycleName) subtitleParts.push(`Ciclo: ${data.cycleName}`)
  else if (data.cycleStart && data.cycleEnd) {
    subtitleParts.push(`Período: ${data.cycleStart} a ${data.cycleEnd}`)
  } else if (data.cycleStart) {
    subtitleParts.push(`Início: ${data.cycleStart}`)
  }
  const subtitle = subtitleParts.join(' &nbsp;|&nbsp; ')

  const now = new Date()
  const generatedAt =
    data.generatedAt ||
    `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} às ${String(
      now.getHours(),
    ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const pageCurrent = data.pageCurrent ?? 1
  const pageTotal = data.pageTotal ?? 1

  // Cabeçalhos dos dias da semana
  const weekHeadersHtml = data.weekDayHeaders
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join('\n            ')

  // Linhas das semanas
  const weeksHtml = data.weeks
    .map((week) => {
      const cellsHtml = week
        .map((cell) => {
          if (!cell) {
            return `<td class="empty-day"></td>`
          }

          const tdClass = cell.isWeekend ? 'weekend-day' : ''
          const weekendBadge = cell.isWeekend ? `<span class="day-badge-weekend">FDS</span>` : ''

          const chipsHtml: string[] = []

          cell.shifts.forEach((s) => {
            const shiftClass = s.periodLetter === 'N' ? 'shift-night' : 'shift-day'
            const timeInfo = s.timeRange ? ` (${escapeHtml(s.timeRange)})` : ''
            const corenInfo = s.corenText ? ` • ${escapeHtml(s.corenText)}` : ''
            chipsHtml.push(
              `<div class="shift-chip ${shiftClass}" title="${escapeHtml(s.name)} - ${s.periodLetter} ${corenInfo}">
                <div class="shift-chip-row">
                  <span class="shift-period-tag">${s.periodLetter}</span>
                  <span class="shift-chip-name">${escapeHtml(s.name)}</span>
                </div>
                <div class="shift-chip-details">${escapeHtml(s.corenText || '')}${timeInfo}</div>
              </div>`,
            )
          })

          cell.weekendOffs.forEach((off) => {
            chipsHtml.push(
              `<div class="shift-chip shift-off" title="Folga: ${escapeHtml(off.name)}">
                <div class="shift-chip-row">
                  <span class="shift-period-tag">FDS</span>
                  <span class="shift-chip-name">${escapeHtml(off.name)}</span>
                </div>
                <div class="shift-chip-details">Folga FDS</div>
              </div>`,
            )
          })

          const contentInside =
            chipsHtml.length > 0
              ? `<div class="day-shifts-list">${chipsHtml.join('')}</div>`
              : `<div class="empty-notice">(Sem plantões)</div>`

          return `<td class="${tdClass}">
            <div class="day-header">
              <span class="day-number">${cell.dayFormatted}</span>
              ${weekendBadge}
            </div>
            ${contentInside}
          </td>`
        })
        .join('\n            ')

      return `<tr>\n            ${cellsHtml}\n          </tr>`
    })
    .join('\n          ')

  let html = CALENDAR_PDF_HTML_TEMPLATE
  html = html.replace(/{{TITLE}}/g, escapeHtml(title))
  html = html.replace(/{{SUBTITLE}}/g, subtitle)
  html = html.replace(/{{LOGO_BASE64}}/g, logo)
  html = html.replace(/{{WEEK_HEADERS_HTML}}/g, weekHeadersHtml)
  html = html.replace(/{{WEEKS_HTML}}/g, weeksHtml)
  html = html.replace(/{{GENERATED_AT}}/g, escapeHtml(generatedAt))
  html = html.replace(/{{PAGE_CURRENT}}/g, String(pageCurrent))
  html = html.replace(/{{PAGE_TOTAL}}/g, String(pageTotal))

  return html
}
