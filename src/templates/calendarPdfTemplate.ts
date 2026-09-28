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

export interface CalendarWeekData {
  weekIndex: number // 1-based (Semana 1 de 5)
  weekTotal: number
  startDateFormatted: string // "DD/MM"
  endDateFormatted: string // "DD/MM"
  days: Array<CalendarDayCellData | null> // Exatamente 7 dias (domingo a sábado)
}

export interface CalendarPageData {
  pageType: 'week' | 'day_continuation' | 'grid' | 'continuation'
  pageIndex: number // 0-based
  weekData?: CalendarWeekData
  continuationDay?: CalendarDayCellData
  continuationBatchIndex?: number // ex: 2 para parte 2 do dia
  continuationBatchTotal?: number
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
  weekDayHeaders: string[] // ex: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
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
 * Retorna o nome completo do profissional preservando acentos e quebras sem compactar para iniciais,
 * pois agora dispomos de células semanais grandes em A4 paisagem com largura de ~38mm.
 */
export function formatCompactStaffName(name: string, _maxLen = 40): string {
  if (!name) return 'Sem nome'
  return name.trim()
}

/**
 * CSS oficial compartilhado para páginas A4 Paisagem (297x210 mm)
 * EXIGÊNCIAS RÍGIDAS DE TIPOGRAFIA E IMPRESSÃO:
 * - Sem transforms/scale de compressão
 * - Fonte mínima de 9.5pt para nomes e cabeçalhos principais
 * - Fonte mínima de 8.5pt para registros (COREN/CRM), metadados e badges
 * - Cores com alto contraste adequadas para impressão P&B e leitura nítida
 * - 7 colunas iguais (14.285714%) em A4 paisagem
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
      color: #0f172a;
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
      padding: 7mm 8mm 6mm 8mm;
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

    /* Cabeçalho Institucional compacto BPSCS */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #047857;
      padding-bottom: 4px;
      margin-bottom: 4px;
      height: 48px;
      flex-shrink: 0;
    }
    .header-info {
      flex: 1;
      padding-right: 14px;
      min-width: 0;
    }
    .header-org {
      font-size: 9.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #047857;
      line-height: 1.1;
      margin-bottom: 2px;
    }
    .header-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: nowrap;
    }
    .header-title {
      font-size: 13pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-badge {
      display: inline-block;
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      padding: 2px 7px;
      border-radius: 3px;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #047857;
      white-space: nowrap;
    }
    .header-badge.badge-week {
      background: #047857;
      color: #ffffff;
      border-color: #047857;
    }
    .header-badge.badge-continuation {
      background: #fffbeb;
      color: #92400e;
      border-color: #d97706;
    }
    .header-subtitle {
      font-size: 9pt;
      color: #1e293b;
      margin-top: 2px;
      line-height: 1.2;
      font-weight: 600;
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
      height: 44px;
    }
    .header-logo img {
      max-height: 40px;
      max-width: 124px;
      width: auto;
      height: auto;
      object-fit: contain;
      display: block;
    }

    /* Faixa de identificação da semana ativa */
    .week-headline-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f1f5f9;
      border: 1.5px solid #0f172a;
      border-radius: 4px;
      padding: 3px 10px;
      margin-bottom: 5px;
      height: 24px;
      flex-shrink: 0;
    }
    .week-headline-title {
      font-size: 10pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.2px;
    }
    .week-headline-meta {
      font-size: 8.5pt;
      font-weight: 700;
      color: #334155;
    }

    /* Container do Calendário Semanal (1 semana por página) */
    .calendar-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      border: 1.5px solid #0f172a;
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
      font-size: 9.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 5px 2px;
      text-align: center;
      border-right: 1.5px solid #065f46;
      border-bottom: 1.5px solid #0f172a;
      height: 28px;
      box-sizing: border-box;
    }
    .calendar-table thead th:last-child {
      border-right: none;
    }
    .calendar-table tbody td {
      border-right: 1.5px solid #94a3b8;
      border-bottom: none;
      vertical-align: top;
      padding: 4px 4px;
      background: #ffffff;
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
      height: 100%;
    }
    .calendar-table tbody td:last-child {
      border-right: none;
    }
    .calendar-table tbody td.weekend-day {
      background: #fafaf9;
    }
    .calendar-table tbody td.empty-day {
      background: #f1f5f9;
    }

    /* Cabeçalho da Célula Diária */
    .day-cell-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
      padding-bottom: 3px;
      border-bottom: 1.5px solid #cbd5e1;
      height: 22px;
      flex-shrink: 0;
    }
    .day-cell-date {
      font-size: 11pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.2px;
      line-height: 1;
    }
    .day-cell-badge-weekend {
      font-size: 8.5pt;
      font-weight: 800;
      color: #78350f;
      background: #fef3c7;
      padding: 2px 5px;
      border-radius: 3px;
      border: 1.5px solid #d97706;
      letter-spacing: 0.3px;
      line-height: 1;
    }

    /* Lista vertical de cards de colaboradores */
    .day-shifts-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      overflow: hidden;
      height: calc(100% - 26px);
    }

    /* Card individual do profissional (linha/card separado com alta legibilidade) */
    .staff-card {
      padding: 3.5px 4px;
      border-radius: 3px;
      background: #f8fafc;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      border-left: 4px solid #047857;
      display: flex;
      flex-direction: column;
      gap: 1.5px;
      box-sizing: border-box;
      page-break-inside: avoid;
    }
    .staff-card.shift-night {
      border-left-color: #1e3a8a;
      background: #f1f5f9;
      border-color: #94a3b8;
    }
    .staff-card.shift-day {
      border-left-color: #047857;
      background: #ffffff;
      border-color: #94a3b8;
    }
    .staff-card.shift-off {
      border-left-color: #d97706;
      background: #fffbeb;
      border-color: #f59e0b;
    }

    .staff-card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 4px;
    }
    .staff-card-name {
      font-size: 9.5pt;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
      word-break: normal;
      overflow-wrap: break-word;
      hyphens: manual;
      flex: 1;
    }
    .badge-shift-type {
      font-size: 8.5pt;
      font-weight: 900;
      letter-spacing: 0.3px;
      padding: 1px 4.5px;
      border-radius: 2px;
      line-height: 1.1;
      flex-shrink: 0;
      text-align: center;
      min-width: 17px;
    }
    .badge-shift-type.badge-d {
      background: #047857;
      color: #ffffff;
      border: 1px solid #065f46;
    }
    .badge-shift-type.badge-n {
      background: #1e3a8a;
      color: #ffffff;
      border: 1px solid #172554;
    }
    .badge-shift-type.badge-fds {
      background: #d97706;
      color: #ffffff;
      border: 1px solid #b45309;
    }

    .staff-card-details {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      font-size: 8.5pt;
      font-weight: 600;
      color: #1e293b;
      line-height: 1.15;
    }
    .staff-coren-text {
      color: #0f172a;
      font-weight: 700;
    }
    .staff-time-text {
      color: #334155;
    }

    .empty-day-notice {
      font-size: 9pt;
      color: #64748b;
      font-style: italic;
      padding-top: 12px;
      text-align: center;
    }

    .day-more-notice {
      font-size: 8.5pt;
      font-weight: 700;
      color: #92400e;
      background: #fef3c7;
      border: 1px solid #d97706;
      border-radius: 3px;
      padding: 2px 4px;
      text-align: center;
      line-height: 1.15;
      margin-top: 2px;
    }

    /* Página de Continuação de Dia de Alta Densidade */
    .continuation-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      border: 1.5px solid #0f172a;
      border-radius: 4px;
      overflow: hidden;
      background: #ffffff;
      padding: 10px 14px;
      min-height: 0;
    }
    .continuation-intro {
      font-size: 10pt;
      color: #0f172a;
      background: #f8fafc;
      border-left: 4px solid #047857;
      border: 1px solid #cbd5e1;
      border-left-width: 4px;
      padding: 6px 10px;
      margin-bottom: 10px;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .continuation-intro strong {
      color: #047857;
    }
    .continuation-intro-tag {
      font-size: 9pt;
      font-weight: 800;
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #d97706;
      padding: 2px 8px;
      border-radius: 3px;
    }
    .continuation-columns {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      align-content: start;
      overflow: hidden;
      flex: 1;
    }

    /* Legenda horizontal compacta com alto contraste */
    .legend-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 3px 8px;
      background: #f8fafc;
      border-top: 1.5px solid #cbd5e1;
      font-size: 8.5pt;
      color: #1e293b;
      height: 20px;
      flex-shrink: 0;
      font-weight: 600;
    }
    .legend-title {
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .legend-chip {
      font-size: 8.5pt;
      font-weight: 900;
      padding: 1px 4px;
      border-radius: 2px;
      color: #ffffff;
      line-height: 1;
    }
    .legend-chip-day {
      background: #047857;
    }
    .legend-chip-night {
      background: #1e3a8a;
    }
    .legend-chip-off {
      background: #d97706;
    }

    /* Rodapé Institucional */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 4px;
      padding-top: 3px;
      border-top: 1.5px solid #cbd5e1;
      font-size: 8.5pt;
      color: #334155;
      height: 18px;
      flex-shrink: 0;
      font-weight: 600;
    }
    .footer-left {
      display: flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
    }
    .footer-left strong {
      color: #0f172a;
      font-weight: 800;
    }
    .footer-divider {
      color: #94a3b8;
    }
    .footer-right {
      font-weight: 800;
      color: #0f172a;
      font-size: 9pt;
      white-space: nowrap;
    }
`

/**
 * Renderiza um card/linha legível para um profissional escalado ou em folga FDS.
 * Atende às exigências:
 * - Nomes COMPLETOS com quebra de linha legível
 * - Fonte mínima de 9.5pt para nome e 8.5pt para COREN/CRM
 * - Badge visível D (dia), N (noite) ou FDS (folga)
 */
export function renderStaffCardHtml(item: {
  type: 'shift' | 'off'
  data: ShiftItemData | { id: string; name: string }
}): string {
  if (item.type === 'shift') {
    const s = item.data as ShiftItemData
    const isNight = s.periodLetter === 'N'
    const cardClass = isNight ? 'shift-night' : 'shift-day'
    const badgeClass = isNight ? 'badge-n' : 'badge-d'
    const timeInfo = s.timeRange
      ? `<span class="staff-time-text">(${escapeHtml(s.timeRange)})</span>`
      : ''
    const corenInfo = s.corenText
      ? `<span class="staff-coren-text">${escapeHtml(s.corenText)}</span>`
      : ''

    return `
      <div class="staff-card ${cardClass}">
        <div class="staff-card-header">
          <span class="staff-card-name">${escapeHtml(s.name)}</span>
          <span class="badge-shift-type ${badgeClass}">${s.periodLetter}</span>
        </div>
        <div class="staff-card-details">
          ${corenInfo}
          ${timeInfo}
        </div>
      </div>
    `
  }

  // Folga de Fim de Semana (FDS)
  const off = item.data as { id: string; name: string }
  return `
    <div class="staff-card shift-off">
      <div class="staff-card-header">
        <span class="staff-card-name">${escapeHtml(off.name)}</span>
        <span class="badge-shift-type badge-fds">FDS</span>
      </div>
      <div class="staff-card-details">
        <span class="staff-coren-text">Folga Fim de Semana</span>
      </div>
    </div>
  `
}

/**
 * Renderiza uma célula diária semanal (7 colunas iguais na página da semana).
 */
export function renderWeeklyCellHtml(
  cell: CalendarDayCellData | null,
  maxCardsPerCell = 4,
): string {
  if (!cell) {
    return `<td class="empty-day"><div class="empty-day-notice">—</div></td>`
  }

  const tdClass = cell.isWeekend ? 'weekend-day' : ''
  const weekendBadge = cell.isWeekend ? `<span class="day-cell-badge-weekend">FDS</span>` : ''

  const allItems: Array<{ type: 'shift' | 'off'; data: any }> = []
  cell.shifts.forEach((s) => allItems.push({ type: 'shift', data: s }))
  cell.weekendOffs.forEach((off) => allItems.push({ type: 'off', data: off }))

  const visibleItems = allItems.slice(0, maxCardsPerCell)
  const remainingCount = allItems.length - maxCardsPerCell

  const cardsHtml = visibleItems.map(renderStaffCardHtml)

  if (remainingCount > 0) {
    cardsHtml.push(`
      <div class="day-more-notice">
        +${remainingCount} profissional(is) na pág. de continuação
      </div>
    `)
  }

  const contentInside =
    cardsHtml.length > 0
      ? `<div class="day-shifts-list">${cardsHtml.join('')}</div>`
      : `<div class="empty-day-notice">(Sem plantões)</div>`

  return `
    <td class="${tdClass}">
      <div class="day-cell-header">
        <span class="day-cell-date">${cell.dayFormatted}</span>
        ${weekendBadge}
      </div>
      ${contentInside}
    </td>
  `
}

/**
 * Renderiza o corpo de 1 semana (7 colunas iguais).
 */
export function renderWeeklyTableBody(
  days: Array<CalendarDayCellData | null>,
  maxCardsPerCell = 4,
): string {
  const cellsHtml = days.map((day) => renderWeeklyCellHtml(day, maxCardsPerCell)).join('\n')
  return `<tr>\n${cellsHtml}\n</tr>`
}

/**
 * Renderiza a página única semanal ou página de continuação de dia.
 */
export function renderSinglePdfPageHtml(options: {
  pageType: 'week' | 'day_continuation' | 'grid' | 'continuation'
  pageNumber: number
  pageTotal: number
  title: string
  subtitle: string
  logoBase64: string
  generatedAt: string
  weekDayHeaders: string[]
  weekData?: CalendarWeekData
  continuationDay?: CalendarDayCellData
  continuationBatchIndex?: number
  continuationBatchTotal?: number
  weeksHtml?: string // fallback para compatibilidade
  overflowDays?: DayOverflowItem[] // fallback para compatibilidade
}): string {
  const {
    pageType,
    pageNumber,
    pageTotal,
    title,
    subtitle,
    logoBase64,
    generatedAt,
    weekDayHeaders,
    weekData,
    continuationDay,
    continuationBatchIndex,
    continuationBatchTotal,
  } = options

  const isContinuation = pageType === 'day_continuation' || pageType === 'continuation'
  const isWeek = pageType === 'week' || (!isContinuation && !!weekData)

  let headlineBarHtml = ''
  let mainContentHtml = ''
  let pageBadge = `<span class="header-badge">Semanal</span>`

  if (isWeek && weekData) {
    pageBadge = `<span class="header-badge badge-week">Semana ${weekData.weekIndex} de ${weekData.weekTotal}</span>`
    headlineBarHtml = `
      <div class="week-headline-bar">
        <span class="week-headline-title">Semana ${weekData.weekIndex} de ${weekData.weekTotal} — ${weekData.startDateFormatted} a ${weekData.endDateFormatted}</span>
        <span class="week-headline-meta">Grade Semanal Paginada A4 Paisagem</span>
      </div>
    `

    const theadThs = weekDayHeaders.map((hdr) => `<th>${escapeHtml(hdr)}</th>`).join('')
    const tbodyRows = renderWeeklyTableBody(weekData.days, 4)

    mainContentHtml = `
      <main class="calendar-wrapper">
        <table class="calendar-table">
          <colgroup>
            <col /><col /><col /><col /><col /><col /><col />
          </colgroup>
          <thead>
            <tr>
              ${theadThs}
            </tr>
          </thead>
          <tbody>
            ${tbodyRows}
          </tbody>
        </table>
        <div class="legend-bar">
          <span class="legend-title">Legenda:</span>
          <div class="legend-item"><span class="legend-chip legend-chip-day">D</span><span>Dia (07:00–19:00)</span></div>
          <div class="legend-item"><span class="legend-chip legend-chip-night">N</span><span>Noite (19:00–07:00)</span></div>
          <div class="legend-item"><span class="legend-chip legend-chip-off">FDS</span><span>Folga de Fim de Semana</span></div>
        </div>
      </main>
    `
  } else if (continuationDay) {
    // Continuação de um dia de alta densidade
    const batchPart = continuationBatchIndex
      ? ` (Parte ${continuationBatchIndex} de ${continuationBatchTotal || 2})`
      : ''
    pageBadge = `<span class="header-badge badge-continuation">Continuação${batchPart}</span>`
    headlineBarHtml = `
      <div class="week-headline-bar">
        <span class="week-headline-title">Continuação — ${escapeHtml(continuationDay.dayOfWeekName || '')}, ${continuationDay.dayFormatted}${batchPart}</span>
        <span class="week-headline-meta">Detalhamento dos profissionais excedentes</span>
      </div>
    `

    const allItems: Array<{ type: 'shift' | 'off'; data: any }> = []
    continuationDay.shifts.forEach((s) => allItems.push({ type: 'shift', data: s }))
    continuationDay.weekendOffs.forEach((off) => allItems.push({ type: 'off', data: off }))

    const cardsHtml = allItems.map(renderStaffCardHtml).join('\n')

    mainContentHtml = `
      <main class="continuation-wrapper">
        <div class="continuation-intro">
          <span><strong>Dia de Alta Densidade:</strong> Lista detalhada e completa de profissionais escalados para <strong>${escapeHtml(continuationDay.dayFormatted)} (${escapeHtml(continuationDay.dayOfWeekName || '')})</strong> sem cortes nem redução de fonte.</span>
          <span class="continuation-intro-tag">Total no dia: ${allItems.length} plantonista(s)</span>
        </div>
        <div class="continuation-columns">
          ${cardsHtml}
        </div>
        <div class="legend-bar">
          <span class="legend-title">Legenda:</span>
          <div class="legend-item"><span class="legend-chip legend-chip-day">D</span><span>Dia (07:00–19:00)</span></div>
          <div class="legend-item"><span class="legend-chip legend-chip-night">N</span><span>Noite (19:00–07:00)</span></div>
          <div class="legend-item"><span class="legend-chip legend-chip-off">FDS</span><span>Folga de Fim de Semana</span></div>
        </div>
      </main>
    `
  } else if (options.overflowDays && options.overflowDays.length > 0) {
    // Fallback compatibilidade com overflowDays legados
    pageBadge = `<span class="header-badge badge-continuation">Continuação</span>`
    const cardsHtml = options.overflowDays
      .map((d) => {
        const items: Array<{ type: 'shift' | 'off'; data: any }> = []
        d.remainingShifts.forEach((s) => items.push({ type: 'shift', data: s }))
        d.remainingWeekendOffs.forEach((off) => items.push({ type: 'off', data: off }))
        return items.map(renderStaffCardHtml).join('')
      })
      .join('')

    mainContentHtml = `
      <main class="continuation-wrapper">
        <div class="continuation-intro">
          <span><strong>Continuação de Plantonistas:</strong> Detalhamento sem redução de fonte.</span>
        </div>
        <div class="continuation-columns">
          ${cardsHtml}
        </div>
      </main>
    `
  } else {
    // Fallback genérico de tabela
    mainContentHtml = `
      <main class="calendar-wrapper">
        <table class="calendar-table">
          <tbody>${options.weeksHtml || ''}</tbody>
        </table>
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

      ${headlineBarHtml}

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
 * Constrói o HTML com suporte a múltiplas páginas semanais paginadas + continuações por dia de alta densidade.
 */
export function renderMultiPageCalendarHtml(options: {
  title: string
  subtitle: string
  logoBase64: string
  generatedAt: string
  weekDayHeaders: string[]
  pages: CalendarPageData[]
}): string {
  const { title, subtitle, logoBase64, generatedAt, weekDayHeaders, pages } = options
  const totalPages = pages.length

  const pagesHtml = pages
    .map((page, idx) => {
      const pageNumber = idx + 1
      return renderSinglePdfPageHtml({
        pageType: page.pageType,
        pageNumber,
        pageTotal: totalPages,
        title,
        subtitle,
        logoBase64,
        generatedAt,
        weekDayHeaders,
        weekData: page.weekData,
        continuationDay: page.continuationDay,
        continuationBatchIndex: page.continuationBatchIndex,
        continuationBatchTotal: page.continuationBatchTotal,
        weeksHtml: page.weeks ? renderWeeklyTableBody(page.weeks[0] || [], 4) : undefined,
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

/**
 * Funções e constantes retrocompatíveis mantidas para evitar quebras em chamadas legadas
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
          <span class="header-badge">Semana 1 de 1</span>
        </div>
        <div class="header-subtitle">{{SUBTITLE}}</div>
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
          <tr>{{WEEK_HEADERS_HTML}}</tr>
        </thead>
        <tbody>{{WEEKS_HTML}}</tbody>
      </table>
    </main>
    <footer class="footer">
      <div class="footer-left">
        <strong>Beneficência Portuguesa de São Caetano do Sul</strong>
        <span class="footer-divider">|</span>
        <span>Gerado em: {{GENERATED_AT}}</span>
      </div>
      <div class="footer-right">
        <span>Página {{PAGE_CURRENT}} de {{PAGE_TOTAL}}</span>
      </div>
    </footer>
  </div>
</body>
</html>`

export function renderWeeksHtml(
  weeks: Array<Array<CalendarDayCellData | null>>,
  maxCardsPerCell = 4,
): string {
  return weeks
    .map((week) => {
      const cellsHtml = week
        .map((cell) => renderWeeklyCellHtml(cell, maxCardsPerCell))
        .join('\n            ')
      return `<tr>\n            ${cellsHtml}\n          </tr>`
    })
    .join('\n          ')
}

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
  const title = data.title || 'Escala de Plantões — Calendário Semanal'
  const logo = data.logoBase64 || BPSCS_LOGO_BASE64

  const subtitleParts: string[] = []
  if (data.sectorName) subtitleParts.push(`Setor: ${data.sectorName}`)
  if (data.cycleName) subtitleParts.push(`Ciclo: ${data.cycleName}`)
  else if (data.cycleStart && data.cycleEnd) {
    subtitleParts.push(`Período: ${data.cycleStart} a ${data.cycleEnd}`)
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

  const weekHeadersHtml = data.weekDayHeaders
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join('\n            ')

  const weeksHtml = renderWeeksHtml(data.weeks, data.maxChipsPerCell ?? 4)

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
