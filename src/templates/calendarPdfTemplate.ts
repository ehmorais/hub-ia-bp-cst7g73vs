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
  dateKey?: string // "YYYY-MM-DD"
  dayOfWeekName?: string // "Domingo", "Segunda-feira", etc.
  isWeekend: boolean
  isOtherMonth?: boolean
  shifts: ShiftItemData[]
  weekendOffs: Array<{ id: string; name: string }>
}

export interface DayOverflowItem {
  dayFormatted: string
  dateKey: string
  dayOfWeekName: string
  isWeekend: boolean
  remainingShifts: ShiftItemData[]
  remainingWeekendOffs: Array<{ id: string; name: string }>
}

export interface CalendarPageData {
  pageType: 'grid' | 'continuation'
  pageIndex: number // 0-based
  weeks?: Array<Array<CalendarDayCellData | null>>
  overflowDays?: DayOverflowItem[]
}

export interface CalendarPdfTemplateData {
  title: string
  subtitle: string
  logoBase64: string
  monthYearHeader?: string
  generatedAt: string
  pageCurrent: number
  pageTotal: number
  weekDayHeaders: string[] // ex: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
  weeksHtml?: string
  pagesHtml?: string
}

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
 * Encurta ou formata nomes longos com segurança preservando acentos em português.
 * Se o nome tiver mais de 24 caracteres e vários sobrenomes, abrevia os nomes intermediários.
 * Ex: "Laodiceia da Silva Goes Dias" -> "Laodiceia da S. G. Dias"
 */
export function formatCompactStaffName(name: string, maxLen = 22): string {
  if (!name) return 'Sem nome'
  const trimmed = name.trim()
  if (trimmed.length <= maxLen) return trimmed

  const parts = trimmed.split(/\s+/)
  if (parts.length <= 2) {
    return trimmed.length > maxLen ? `${trimmed.substring(0, maxLen - 1)}…` : trimmed
  }

  const firstName = parts[0]
  const lastName = parts[parts.length - 1]
  const middle = parts.slice(1, parts.length - 1)

  const prepositions = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
  const abbreviatedMiddle = middle.map((p) => {
    if (prepositions.has(p.toLowerCase())) return p
    return `${p.charAt(0).toUpperCase()}.`
  })

  const candidate = [firstName, ...abbreviatedMiddle, lastName].join(' ')
  if (candidate.length <= maxLen) return candidate

  // Se ainda assim for longo, deixa apenas primeiro nome e último
  const shorter = `${firstName} ${lastName}`
  if (shorter.length <= maxLen) return shorter
  return `${shorter.substring(0, maxLen - 1)}…`
}

/**
 * CSS oficial compartilhado para páginas A4 Paisagem (297x210 mm)
 */
export const CALENDAR_PDF_COMMON_STYLES = `
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
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .pdf-pages-container {
      width: 297mm;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    .page-container {
      width: 297mm;
      height: 210mm;
      max-width: 297mm;
      max-height: 210mm;
      padding: 8mm 10mm 6mm 10mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      background: #ffffff;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }
    .page-container:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    /* Cabeçalho Institucional alinhado com o modelo BPSCS */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #047857;
      padding-bottom: 5px;
      margin-bottom: 5px;
      height: 48px;
      flex-shrink: 0;
    }
    .header-info {
      flex: 1;
      padding-right: 16px;
      min-width: 0;
    }
    .header-org {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #047857;
      margin-bottom: 1px;
    }
    .header-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: nowrap;
    }
    .header-title {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-badge {
      display: inline-block;
      font-size: 8px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 2px 6px;
      border-radius: 3px;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      white-space: nowrap;
    }
    .header-badge.badge-continuation {
      background: #fef3c7;
      color: #b45309;
      border-color: #fde68a;
    }
    .header-subtitle {
      font-size: 9px;
      color: #475569;
      margin-top: 2px;
      line-height: 1.2;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-logo {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      width: 130px;
      height: 42px;
    }
    .header-logo img {
      max-height: 38px;
      max-width: 120px;
      width: auto;
      height: auto;
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
    .calendar-table colgroup col {
      width: 14.285714%;
    }
    .calendar-table thead th {
      background: #047857;
      color: #ffffff;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4px 2px;
      text-align: center;
      border-right: 1px solid #065f46;
      border-bottom: 1px solid #065f46;
      height: 22px;
      box-sizing: border-box;
    }
    .calendar-table thead th:last-child {
      border-right: none;
    }
    .calendar-table tbody td {
      border-right: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
      padding: 2px 3px;
      background: #ffffff;
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
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
      margin-bottom: 2px;
      padding-bottom: 1px;
      border-bottom: 1px solid #f1f5f9;
      height: 15px;
      flex-shrink: 0;
    }
    .day-number {
      font-size: 10px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.2px;
      line-height: 1;
    }
    .day-badge-weekend {
      font-size: 7px;
      font-weight: 700;
      color: #b45309;
      background: #fef3c7;
      padding: 1px 3px;
      border-radius: 2px;
      border: 1px solid #fde68a;
      letter-spacing: 0.2px;
      line-height: 1;
    }
    .day-shifts-list {
      display: flex;
      flex-direction: column;
      gap: 1.5px;
      overflow: hidden;
      max-height: calc(100% - 17px);
    }

    /* Fichas de plantonistas */
    .shift-chip {
      font-size: 7.2px;
      line-height: 1.15;
      padding: 1.5px 3px;
      border-radius: 2px;
      background: #f8fafc;
      color: #0f172a;
      border-left: 2.5px solid #047857;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
      box-sizing: border-box;
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
      gap: 2.5px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .shift-period-tag {
      font-weight: 800;
      font-size: 7.2px;
      letter-spacing: 0.2px;
      flex-shrink: 0;
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
      font-size: 7.2px;
    }
    .shift-chip-details {
      color: #64748b;
      font-size: 6.5px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .empty-notice {
      font-size: 7px;
      color: #94a3b8;
      font-style: italic;
      padding-top: 2px;
      text-align: center;
    }

    /* Tag de mais profissionais na célula */
    .shift-more-tag {
      font-size: 6.8px;
      font-weight: 700;
      color: #047857;
      background: #ecfdf5;
      border: 1px dashed #a7f3d0;
      border-radius: 2px;
      padding: 1px 3px;
      text-align: center;
      line-height: 1.1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 1px;
    }

    /* Página de Continuação */
    .continuation-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      overflow: hidden;
      background: #ffffff;
      padding: 8px 10px;
      min-height: 0;
    }
    .continuation-intro {
      font-size: 9px;
      color: #334155;
      background: #f8fafc;
      border-left: 3px solid #047857;
      padding: 4px 8px;
      margin-bottom: 8px;
      font-weight: 500;
    }
    .continuation-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      align-content: start;
      overflow: hidden;
      flex: 1;
    }
    .continuation-day-card {
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      background: #ffffff;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .continuation-day-header {
      background: #047857;
      color: #ffffff;
      padding: 4px 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      font-weight: 700;
    }
    .continuation-day-header.weekend {
      background: #065f46;
    }
    .continuation-day-header .badge-fds {
      font-size: 7px;
      background: #fef3c7;
      color: #b45309;
      padding: 1px 4px;
      border-radius: 2px;
      font-weight: 700;
    }
    .continuation-day-body {
      padding: 5px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      overflow: hidden;
    }

    /* Legenda horizontal compacta */
    .legend-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 3px 6px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      font-size: 7.5px;
      color: #475569;
      height: 18px;
      flex-shrink: 0;
    }
    .legend-title {
      font-weight: 700;
      color: #1e293b;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 2px;
      display: inline-block;
    }
    .legend-dot-day {
      background: #047857;
    }
    .legend-dot-night {
      background: #1e3a8a;
    }
    .legend-dot-off {
      background: #f59e0b;
    }

    /* Rodapé Institucional */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 4px;
      padding-top: 3px;
      border-top: 1px solid #e2e8f0;
      font-size: 7.8px;
      color: #64748b;
      height: 16px;
      flex-shrink: 0;
    }
    .footer-left {
      display: flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
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
      white-space: nowrap;
    }
`

/**
 * Template HTML fiel ao padrão institucional Beneficência Portuguesa de São Caetano do Sul (BPSCS).
 * Layout A4 Paisagem (297x210 mm) com proporções equilibradas:
 * - Cabeçalho limpo com logotipo oficial BPSCS no canto superior direito
 * - Título e subtítulo organizados à esquerda com tipografia sóbria
 * - Tabela do calendário com cabeçalho institucional em tom esmeralda (#047857)
 * - 7 colunas de largura idêntica (14.2857%), bordas contínuas e alinhadas
 * - Células de dias com número em destaque, badges para plantonistas (D verde, N azul escuro, COREN/CRM)
 *   e folgas de fim de semana (FDS em âmbar)
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
    ${CALENDAR_PDF_COMMON_STYLES}
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
        <colgroup>
          <col /><col /><col /><col /><col /><col /><col />
        </colgroup>
        <thead>
          <tr>
            {{WEEK_HEADERS_HTML}}
          </tr>
        </thead>
        <tbody>
          {{WEEKS_HTML}}
        </tbody>
      </table>
      <div class="legend-bar">
        <span class="legend-title">Legenda:</span>
        <div class="legend-item"><span class="legend-dot legend-dot-day"></span><span>D (Dia / 07:00–19:00)</span></div>
        <div class="legend-item"><span class="legend-dot legend-dot-night"></span><span>N (Noite / 19:00–07:00)</span></div>
        <div class="legend-item"><span class="legend-dot legend-dot-off"></span><span>FDS (Folga Fim de Semana)</span></div>
      </div>
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
 * Renderiza uma única célula de dia na tabela da grade mensal.
 */
function renderCalendarCellHtml(cell: CalendarDayCellData | null, maxChipsPerCell = 3): string {
  if (!cell) {
    return `<td class="empty-day"></td>`
  }

  const tdClass = cell.isWeekend ? 'weekend-day' : ''
  const weekendBadge = cell.isWeekend ? `<span class="day-badge-weekend">FDS</span>` : ''

  const allItems: Array<{ type: 'shift' | 'off'; data: any }> = []
  cell.shifts.forEach((s) => allItems.push({ type: 'shift', data: s }))
  cell.weekendOffs.forEach((off) => allItems.push({ type: 'off', data: off }))

  const visibleItems = allItems.slice(0, maxChipsPerCell)
  const remainingCount = allItems.length - maxChipsPerCell

  const chipsHtml: string[] = []

  visibleItems.forEach((item) => {
    if (item.type === 'shift') {
      const s = item.data as ShiftItemData
      const shiftClass = s.periodLetter === 'N' ? 'shift-night' : 'shift-day'
      const timeInfo = s.timeRange ? ` (${escapeHtml(s.timeRange)})` : ''
      const corenInfo = s.corenText ? ` • ${escapeHtml(s.corenText)}` : ''
      const compactName = formatCompactStaffName(s.name, 20)
      chipsHtml.push(
        `<div class="shift-chip ${shiftClass}" title="${escapeHtml(s.name)} - ${s.periodLetter} ${corenInfo}">
          <div class="shift-chip-row">
            <span class="shift-period-tag">${s.periodLetter}</span>
            <span class="shift-chip-name">${escapeHtml(compactName)}</span>
          </div>
          <div class="shift-chip-details">${escapeHtml(s.corenText || '')}${timeInfo}</div>
        </div>`,
      )
    } else {
      const off = item.data as { id: string; name: string }
      const compactName = formatCompactStaffName(off.name, 20)
      chipsHtml.push(
        `<div class="shift-chip shift-off" title="Folga: ${escapeHtml(off.name)}">
          <div class="shift-chip-row">
            <span class="shift-period-tag">FDS</span>
            <span class="shift-chip-name">${escapeHtml(compactName)}</span>
          </div>
          <div class="shift-chip-details">Folga Fim de Semana</div>
        </div>`,
      )
    }
  })

  if (remainingCount > 0) {
    chipsHtml.push(
      `<div class="shift-more-tag" title="${remainingCount} plantonistas adicionais na página de continuação">+${remainingCount} profissional(is) (vide pág. seg.)</div>`,
    )
  }

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
}

/**
 * Renderiza o HTML da grade de semanas a partir de uma matriz de semanas.
 */
export function renderWeeksHtml(
  weeks: Array<Array<CalendarDayCellData | null>>,
  maxChipsPerCell?: number,
): string {
  // Ajusta dinamicamente a densidade se maxChipsPerCell não foi fornecido
  const defaultMaxChips = weeks.length >= 6 ? 2 : weeks.length === 5 ? 3 : 4
  const chipsLimit = maxChipsPerCell ?? defaultMaxChips

  return weeks
    .map((week) => {
      const cellsHtml = week
        .map((cell) => renderCalendarCellHtml(cell, chipsLimit))
        .join('\n            ')
      return `<tr>\n            ${cellsHtml}\n          </tr>`
    })
    .join('\n          ')
}

/**
 * Renderiza o card de continuação de um dia de alta densidade
 */
function renderContinuationDayCard(item: DayOverflowItem): string {
  const headerClass = item.isWeekend ? 'continuation-day-header weekend' : 'continuation-day-header'
  const fdsBadge = item.isWeekend ? `<span class="badge-fds">FDS</span>` : ''

  const chips: string[] = []
  item.remainingShifts.forEach((s) => {
    const shiftClass = s.periodLetter === 'N' ? 'shift-night' : 'shift-day'
    const timeInfo = s.timeRange ? ` (${escapeHtml(s.timeRange)})` : ''
    const compactName = formatCompactStaffName(s.name, 28)
    chips.push(
      `<div class="shift-chip ${shiftClass}" title="${escapeHtml(s.name)} - ${s.periodLetter} • ${escapeHtml(s.corenText || '')}">
        <div class="shift-chip-row">
          <span class="shift-period-tag">${s.periodLetter}</span>
          <span class="shift-chip-name">${escapeHtml(compactName)}</span>
        </div>
        <div class="shift-chip-details">${escapeHtml(s.corenText || '')}${timeInfo}</div>
      </div>`,
    )
  })

  item.remainingWeekendOffs.forEach((off) => {
    const compactName = formatCompactStaffName(off.name, 28)
    chips.push(
      `<div class="shift-chip shift-off" title="Folga FDS: ${escapeHtml(off.name)}">
        <div class="shift-chip-row">
          <span class="shift-period-tag">FDS</span>
          <span class="shift-chip-name">${escapeHtml(compactName)}</span>
        </div>
        <div class="shift-chip-details">Folga Fim de Semana</div>
      </div>`,
    )
  })

  return `
    <div class="continuation-day-card">
      <div class="${headerClass}">
        <span>${escapeHtml(item.dayFormatted)} — ${escapeHtml(item.dayOfWeekName || '')}</span>
        ${fdsBadge}
      </div>
      <div class="continuation-day-body">
        ${chips.join('')}
      </div>
    </div>
  `
}

/**
 * Renderiza uma página completa de documento HTML para uma página da escala.
 */
export function renderSinglePdfPageHtml(options: {
  pageType: 'grid' | 'continuation'
  pageNumber: number
  pageTotal: number
  title: string
  subtitle: string
  logoBase64: string
  generatedAt: string
  weekHeadersHtml?: string
  weeksHtml?: string
  overflowDays?: DayOverflowItem[]
}): string {
  const {
    pageType,
    pageNumber,
    pageTotal,
    title,
    subtitle,
    logoBase64,
    generatedAt,
    weekHeadersHtml,
    weeksHtml,
    overflowDays,
  } = options

  const isContinuation = pageType === 'continuation'
  const pageBadge = isContinuation
    ? `<span class="header-badge badge-continuation">Continuação de Plantões</span>`
    : `<span class="header-badge">Formato Calendário</span>`

  let mainContentHtml = ''
  if (!isContinuation) {
    mainContentHtml = `
    <main class="calendar-wrapper">
      <table class="calendar-table">
        <colgroup>
          <col /><col /><col /><col /><col /><col /><col />
        </colgroup>
        <thead>
          <tr>
            ${weekHeadersHtml || ''}
          </tr>
        </thead>
        <tbody>
          ${weeksHtml || ''}
        </tbody>
      </table>
      <div class="legend-bar">
        <span class="legend-title">Legenda:</span>
        <div class="legend-item"><span class="legend-dot legend-dot-day"></span><span>D (Dia / 07:00–19:00)</span></div>
        <div class="legend-item"><span class="legend-dot legend-dot-night"></span><span>N (Noite / 19:00–07:00)</span></div>
        <div class="legend-item"><span class="legend-dot legend-dot-off"></span><span>FDS (Folga Fim de Semana)</span></div>
      </div>
    </main>
    `
  } else {
    const cardsHtml = (overflowDays || []).map(renderContinuationDayCard).join('\n')
    mainContentHtml = `
    <main class="continuation-wrapper">
      <div class="continuation-intro">
        <strong>Continuação de Plantonistas:</strong> Detalhamento dos profissionais escalados cujos plantões excederam a capacidade visual da grade mensal principal.
      </div>
      <div class="continuation-grid">
        ${cardsHtml}
      </div>
      <div class="legend-bar">
        <span class="legend-title">Legenda:</span>
        <div class="legend-item"><span class="legend-dot legend-dot-day"></span><span>D (Dia)</span></div>
        <div class="legend-item"><span class="legend-dot legend-dot-night"></span><span>N (Noite)</span></div>
        <div class="legend-item"><span class="legend-dot legend-dot-off"></span><span>FDS (Folga)</span></div>
      </div>
    </main>
    `
  }

  return `
  <div class="page-container" id="calendar-pdf-page-${pageNumber}">
    <header class="header">
      <div class="header-info">
        <div class="header-org">Beneficência Portuguesa de São Caetano do Sul</div>
        <div class="header-title-row">
          <h1 class="header-title">${escapeHtml(title)}</h1>
          ${pageBadge}
        </div>
        <div class="header-subtitle">
          ${subtitle}
        </div>
      </div>
      <div class="header-logo">
        <img src="${logoBase64}" alt="Logo Institucional BPSCS" />
      </div>
    </header>

    ${mainContentHtml}

    <footer class="footer">
      <div class="footer-left">
        <strong>Beneficência Portuguesa de São Caetano do Sul</strong>
        <span class="footer-divider">|</span>
        <span>Gerado em: ${escapeHtml(generatedAt)}</span>
        <span class="footer-divider">|</span>
        <span>Documento confidencial / Uso interno</span>
      </div>
      <div class="footer-right">
        <span>Página ${pageNumber} de ${pageTotal}</span>
      </div>
    </footer>
  </div>
  `
}

/**
 * Preenche o template CALENDAR_PDF_HTML_TEMPLATE com os dados informados.
 * Mantém compatibilidade integral com a chamada tradicional para 1 página única.
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
  maxChipsPerCell?: number
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
  const weeksHtml = renderWeeksHtml(data.weeks, data.maxChipsPerCell)

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

/**
 * Constrói o HTML com suporte a múltiplas páginas (Grade + Continuações).
 */
export function renderMultiPageCalendarHtml(options: {
  title: string
  subtitle: string
  logoBase64: string
  generatedAt: string
  weekDayHeaders: string[]
  pages: CalendarPageData[]
  maxChipsPerCell?: number
}): string {
  const { title, subtitle, logoBase64, generatedAt, weekDayHeaders, pages, maxChipsPerCell } =
    options
  const totalPages = pages.length

  const weekHeadersHtml = weekDayHeaders
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join('\n            ')

  const pagesHtml = pages
    .map((page, idx) => {
      const pageNumber = idx + 1
      const weeksHtml = page.weeks ? renderWeeksHtml(page.weeks, maxChipsPerCell) : undefined

      return renderSinglePdfPageHtml({
        pageType: page.pageType,
        pageNumber,
        pageTotal: totalPages,
        title,
        subtitle,
        logoBase64,
        generatedAt,
        weekHeadersHtml,
        weeksHtml,
        overflowDays: page.overflowDays,
      })
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    ${CALENDAR_PDF_COMMON_STYLES}
  </style>
</head>
<body>
  <div class="pdf-pages-container">
    ${pagesHtml}
  </div>
</body>
</html>`
}
