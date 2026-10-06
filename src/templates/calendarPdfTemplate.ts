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
  isVacation?: boolean
  isLeave?: boolean
  notes?: string
  absenceType?: 'FOLGA' | 'FÉRIAS'
}

export interface CalendarDayCellData {
  dayFormatted: string // "DD/MM"
  dayNumber: number // 1..31
  dateKey?: string // "YYYY-MM-DD"
  dayOfWeekName?: string // "Domingo", "Segunda-feira", etc.
  isWeekend: boolean
  isOtherMonth?: boolean
  shifts: ShiftItemData[]
  weekendOffs: Array<{
    id: string
    name: string
    professionalId?: string | null
    periodLetter?: 'D' | 'N'
    corenText?: string
  }>
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
 * Retorna o nome completo do profissional preservando acentos e quebras sem truncar nem abreviar,
 * em peso normal (400) com alta legibilidade.
 */
export function formatCompactStaffName(name: string, _maxLen = 40): string {
  if (!name) return 'Sem nome'
  return name.trim()
}

/**
 * CSS LIMPO, MODERNO E ROBUSTO PARA EXPORTAÇÃO A4 PAISAGEM (297x210 mm)
 *
 * REGRAS RÍGIDAS DE TIPOGRAFIA E LAYOUT (atendendo integralmente aos requisitos do usuário):
 * 1. Peso NORMAL (font-weight: 400, font-style: normal) para TODOS os dados de conteúdo:
 *    nomes, COREN, horários, tipos de turno, folgas, férias e observações.
 *    Negrito SOMENTE em títulos e cabeçalhos de semana/dia.
 * 2. Sem fundos decorativos pesados ou sombras que disputam espaço. Grade limpa com fundo
 *    branco, bordas finas em cinza neutro (#cbd5e1), margens internas generosas e alto contraste.
 * 3. Sem coordenadas fixas desmedidas nem transform/scale de compressão: fluxo vertical limpo,
 *    wrap natural, quebra de linha por flexbox/grid sem colisões.
 * 4. 7 colunas rigorosamente uniformes (width: 14.285714%) em A4 paisagem (297x210 mm).
 * 5. Zonas de cabeçalho e rodapé reservadas e protegidas com altura fixa e flex-shrink: 0.
 * 6. Tamanhos de fonte conformes:
 *    - Cabeçalhos de dia: 11pt
 *    - Nomes de colaboradores: 10pt (peso 400 normal)
 *    - COREN / horários / detalhes / folgas: 9pt (peso 400 normal)
 *    - Entrelinha: mínima de 1.25 a 1.35.
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
      font-size: 10pt;
      font-weight: 400;
      line-height: 1.3;
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
      padding: 6mm 8mm 6mm 8mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      background: #ffffff;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
      box-sizing: border-box;
    }
    .page-container:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    /* =====================================================
       ZONA DE CABEÇALHO RESERVADA (Nunca invadida pelo conteúdo)
       ===================================================== */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 4px;
      margin-bottom: 4px;
      height: 48px;
      min-height: 48px;
      max-height: 48px;
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .header-info {
      flex: 1;
      padding-right: 12px;
      min-width: 0;
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .header-logo-left {
      flex: 0 0 auto;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .header-logo-left img {
      max-width: 40px;
      max-height: 40px;
      width: auto;
      height: auto;
      object-fit: contain;
      display: block;
    }
    .header-org {
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
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
      font-weight: 700;
      color: #0f172a;
      line-height: 1.15;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-badge {
      display: inline-block;
      font-size: 8.5pt;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 3px;
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
      white-space: nowrap;
      line-height: 1.2;
    }
    .header-badge.badge-week {
      background: #0f172a;
      color: #ffffff;
      border-color: #0f172a;
    }
    .header-badge.badge-continuation {
      background: #f8fafc;
      color: #0f172a;
      border-color: #64748b;
    }
    .header-subtitle {
      font-size: 8.5pt;
      font-weight: 400;
      color: #475569;
      margin-top: 2px;
      line-height: 1.2;
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
      max-height: 40px;
      max-width: 124px;
      width: auto;
      height: auto;
      object-fit: contain;
      display: block;
    }

    /* Faixa de Contexto da Semana (título em negrito e metadados discretos) */
    .week-headline-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 3px;
      padding: 2px 8px;
      margin-bottom: 4px;
      height: 22px;
      min-height: 22px;
      max-height: 22px;
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .week-headline-title {
      font-size: 9.5pt;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 0.1px;
    }
    .week-headline-meta {
      font-size: 8.5pt;
      font-weight: 400;
      color: #64748b;
    }

    /* =====================================================
       GRADE SEMANAL LIMPA (1 semana por página, 7 colunas iguais)
       ===================================================== */
    .calendar-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      border: 1px solid #94a3b8;
      border-radius: 3px;
      overflow: hidden;
      background: #ffffff;
      min-height: 0;
      box-sizing: border-box;
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
      background: #f8fafc;
      color: #0f172a;
      font-size: 10pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      padding: 4px 2px;
      text-align: center;
      border-right: 1px solid #cbd5e1;
      border-bottom: 1.5px solid #94a3b8;
      height: 26px;
      box-sizing: border-box;
    }
    .calendar-table thead th:last-child {
      border-right: none;
    }
    .calendar-table tbody td {
      border-right: 1px solid #cbd5e1;
      border-bottom: none;
      vertical-align: top;
      padding: 4px;
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
      background: #ffffff;
    }
    .calendar-table tbody td.empty-day {
      background: #f8fafc;
    }

    /* Cabeçalho da Célula Diária: 11pt, negrito */
    .day-cell-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
      padding-bottom: 2px;
      border-bottom: 1px solid #e2e8f0;
      height: 20px;
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .day-cell-date {
      font-size: 11pt;
      font-weight: 700;
      color: #0f172a;
      line-height: 1;
    }
    .day-cell-badge-weekend {
      font-size: 8.5pt;
      font-weight: 400;
      color: #475569;
      background: #f1f5f9;
      padding: 1px 4px;
      border-radius: 2px;
      border: 1px solid #cbd5e1;
      line-height: 1;
    }

    /* Lista vertical de plantonistas do dia */
    .day-shifts-list {
      display: flex;
      flex-direction: column;
      gap: 3px;
      overflow: hidden;
      height: calc(100% - 24px);
    }

    /* =====================================================
       ITEM DO PROFISSIONAL (Grade limpa, sem negrito, sem sobreposição)
       Requisito 1 e 2: peso normal (400) para nomes, COREN, horários, tipos.
       Bordas finas cinza, fundo branco, alto contraste.
       ===================================================== */
    .staff-entry {
      padding: 3px 4px;
      border-radius: 2px;
      background: #ffffff;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      border-left: 3px solid #64748b;
      display: flex;
      flex-direction: column;
      gap: 1.5px;
      box-sizing: border-box;
      page-break-inside: avoid;
    }
    .staff-entry.shift-day {
      border-left-color: #047857;
      background: #ffffff;
    }
    .staff-entry.shift-night {
      border-left-color: #1e3a8a;
      background: #ffffff;
    }
    .staff-entry.shift-off {
      border-left-color: #b45309;
      background: #ffffff;
    }
    .staff-entry.shift-vacation {
      border-left-color: #475569;
      background: #ffffff;
    }
    .staff-entry.shift-leave {
      border-left-color: #64748b;
      background: #ffffff;
    }

    .staff-entry-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 4px;
    }
    .staff-entry-name {
      font-size: 10pt;
      font-weight: 400;
      color: #0f172a;
      line-height: 1.25;
      word-break: normal;
      overflow-wrap: break-word;
      flex: 1;
    }
    .staff-type-tag {
      font-size: 8.5pt;
      font-weight: 400;
      line-height: 1.2;
      padding: 0 3px;
      border-radius: 2px;
      border: 1px solid #cbd5e1;
      color: #334155;
      background: #f8fafc;
      flex-shrink: 0;
      text-align: center;
      min-width: 15px;
    }
    .staff-type-tag.tag-d {
      border-color: #047857;
      color: #047857;
      background: #f0fdf4;
    }
    .staff-type-tag.tag-n {
      border-color: #1e3a8a;
      color: #1e3a8a;
      background: #eff6ff;
    }
    .staff-type-tag.tag-fds {
      border-color: #b45309;
      color: #b45309;
      background: #fffbeb;
    }
    .staff-type-tag.tag-folga {
      border-color: #ea580c;
      color: #9a3412;
      background: #ffedd5;
    }
    .staff-type-tag.tag-ferias {
      border-color: #059669;
      color: #065f46;
      background: #ecfdf5;
    }

    .staff-entry-details {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      font-size: 9pt;
      font-weight: 400;
      color: #475569;
      line-height: 1.25;
    }
    .staff-coren-text {
      color: #334155;
      font-weight: 400;
    }
    .staff-time-text {
      color: #64748b;
      font-weight: 400;
    }

    .empty-day-notice {
      font-size: 9pt;
      font-weight: 400;
      color: #94a3b8;
      padding-top: 10px;
      text-align: center;
    }

    .day-more-notice {
      font-size: 8.5pt;
      font-weight: 400;
      color: #475569;
      background: #f8fafc;
      border: 1px dashed #94a3b8;
      border-radius: 2px;
      padding: 2px 4px;
      text-align: center;
      line-height: 1.2;
      margin-top: 2px;
    }

    /* =====================================================
       PÁGINA DE CONTINUAÇÃO DEDICADA (Dias densos, ex: 08/10)
       Grade uniforme em 3 colunas, sem corte, sem negrito generalizado.
       ===================================================== */
    .continuation-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      border: 1px solid #94a3b8;
      border-radius: 3px;
      overflow: hidden;
      background: #ffffff;
      padding: 8px 12px;
      min-height: 0;
      box-sizing: border-box;
    }
    .continuation-intro {
      font-size: 9.5pt;
      font-weight: 400;
      color: #0f172a;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: 3px solid #047857;
      padding: 4px 8px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-sizing: border-box;
    }
    .continuation-intro strong {
      font-weight: 700;
      color: #0f172a;
    }
    .continuation-intro-tag {
      font-size: 8.5pt;
      font-weight: 400;
      background: #ffffff;
      color: #334155;
      border: 1px solid #cbd5e1;
      padding: 1px 6px;
      border-radius: 2px;
    }
    .continuation-columns {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      align-content: start;
      overflow: hidden;
      flex: 1;
    }

    /* =====================================================
       LEGENDA DISCRETA (Cores suaves, alto contraste, peso normal)
       ===================================================== */
    .legend-bar {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 2px 8px;
      background: #f8fafc;
      border-top: 1px solid #cbd5e1;
      font-size: 8.5pt;
      font-weight: 400;
      color: #475569;
      height: 20px;
      min-height: 20px;
      max-height: 20px;
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .legend-title {
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: 400;
      color: #334155;
    }
    .legend-chip {
      font-size: 8pt;
      font-weight: 400;
      padding: 0 4px;
      border-radius: 2px;
      line-height: 1.2;
      border: 1px solid #cbd5e1;
    }
    .legend-chip-day {
      border-color: #047857;
      color: #047857;
      background: #f0fdf4;
    }
    .legend-chip-night {
      border-color: #1e3a8a;
      color: #1e3a8a;
      background: #eff6ff;
    }
    .legend-chip-off {
      border-color: #b45309;
      color: #b45309;
      background: #fffbeb;
    }

    /* =====================================================
       ZONA DE RODAPÉ RESERVADA (Página X de Y correta e estável)
       ===================================================== */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 4px;
      padding-top: 3px;
      border-top: 1px solid #cbd5e1;
      font-size: 8.5pt;
      font-weight: 400;
      color: #64748b;
      height: 18px;
      min-height: 18px;
      max-height: 18px;
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .footer-left {
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .footer-org {
      font-weight: 600;
      color: #334155;
    }
    .footer-divider {
      color: #cbd5e1;
    }
    .footer-right {
      font-weight: 400;
      color: #0f172a;
      font-size: 8.5pt;
      white-space: nowrap;
    }
`

/**
 * Renderiza a linha de um profissional em formato limpo, fundo branco, bordas sutis
 * e tipografia 100% em peso normal (400) para nomes, COREN, horários e tipos de turno.
 */
export function renderStaffCardHtml(item: {
  type: 'shift' | 'off' | 'vacation'
  data:
    | ShiftItemData
    | {
        id: string
        name: string
        professionalId?: string | null
        periodLetter?: 'D' | 'N'
        corenText?: string
        absenceType?: string
      }
}): string {
  if (item.type === 'shift') {
    const s = item.data as ShiftItemData

    // Se o item for classificado como ausente (FÉRIAS ou FOLGA)
    if (s.absenceType === 'FÉRIAS' || s.isVacation) {
      const period = s.periodLetter || 'D'
      const isNight = period === 'N'
      const coren = s.corenText || 'COREN não informado'
      return `
        <div class="staff-entry shift-vacation">
          <div class="staff-entry-header">
            <span class="staff-entry-name">${escapeHtml(s.name)}</span>
            <span class="staff-type-tag tag-ferias">FÉRIAS</span>
          </div>
          <div class="staff-entry-details">
            <span class="staff-type-tag ${isNight ? 'tag-n' : 'tag-d'}">${period}</span>
            <span class="staff-coren-text">${escapeHtml(coren)}</span>
          </div>
        </div>
      `
    }

    if (s.absenceType === 'FOLGA' || s.isWeekendOff) {
      const period = s.periodLetter || 'D'
      const isNight = period === 'N'
      const coren = s.corenText || 'COREN não informado'
      return `
        <div class="staff-entry shift-off">
          <div class="staff-entry-header">
            <span class="staff-entry-name">${escapeHtml(s.name)}</span>
            <span class="staff-type-tag tag-folga">FOLGA</span>
            <span class="staff-type-tag tag-fds" style="display:none">FDS</span>
          </div>
          <div class="staff-entry-details">
            <span class="staff-type-tag ${isNight ? 'tag-n' : 'tag-d'}">${period}</span>
            <span class="staff-coren-text">${escapeHtml(coren)}</span>
            <span class="staff-time-text" style="display:none">Folga Fim de Semana</span>
          </div>
        </div>
      `
    }

    const isNight = s.periodLetter === 'N'
    const entryClass = isNight ? 'shift-night' : 'shift-day'
    const tagClass = isNight ? 'tag-n' : 'tag-d'

    const timeInfo = s.timeRange
      ? `<span class="staff-time-text">${escapeHtml(s.timeRange)}</span>`
      : ''
    const corenInfo = s.corenText
      ? `<span class="staff-coren-text">${escapeHtml(s.corenText)}</span>`
      : ''

    const detailsParts = [corenInfo, timeInfo].filter(Boolean)
    const detailsHtml =
      detailsParts.length > 0
        ? `<div class="staff-entry-details">${detailsParts.join(' &bull; ')}</div>`
        : ''

    return `
      <div class="staff-entry ${entryClass}">
        <div class="staff-entry-header">
          <span class="staff-entry-name">${escapeHtml(s.name)}</span>
          <span class="staff-type-tag ${tagClass}">${s.periodLetter}</span>
        </div>
        ${detailsHtml}
      </div>
    `
  }

  // Folga de Fim de Semana (FDS / FOLGA) - Card de Ausente
  const off = item.data as {
    id: string
    name: string
    professionalId?: string | null
    periodLetter?: 'D' | 'N'
    corenText?: string
    absenceType?: string
  }
  const isVacation = item.type === 'vacation' || off.absenceType === 'FÉRIAS'
  const period = off.periodLetter || 'D'
  const isNight = period === 'N'
  const coren =
    off.corenText || (off.professionalId ? `COREN ${off.professionalId}` : 'COREN não informado')

  if (isVacation) {
    return `
      <div class="staff-entry shift-vacation">
        <div class="staff-entry-header">
          <span class="staff-entry-name">${escapeHtml(off.name)}</span>
          <span class="staff-type-tag tag-ferias">FÉRIAS</span>
        </div>
        <div class="staff-entry-details">
          <span class="staff-type-tag ${isNight ? 'tag-n' : 'tag-d'}">${period}</span>
          <span class="staff-coren-text">${escapeHtml(coren)}</span>
        </div>
      </div>
    `
  }

  return `
    <div class="staff-entry shift-off">
      <div class="staff-entry-header">
        <span class="staff-entry-name">${escapeHtml(off.name)}</span>
        <span class="staff-type-tag tag-folga">FOLGA</span>
        <span class="staff-type-tag tag-fds">FDS</span>
      </div>
      <div class="staff-entry-details">
        <span class="staff-type-tag ${isNight ? 'tag-n' : 'tag-d'}">${period}</span>
        <span class="staff-coren-text">${escapeHtml(coren)}</span>
        <span class="staff-time-text">Folga Fim de Semana</span>
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
    return `<td class="empty-day"><div class="empty-day-notice">&mdash;</div></td>`
  }

  const tdClass = cell.isWeekend ? 'weekend-day' : ''
  const weekendBadge = cell.isWeekend ? `<span class="day-cell-badge-weekend">FDS</span>` : ''

  const allItems: Array<{ type: 'shift' | 'off' | 'vacation'; data: any }> = []
  cell.shifts.forEach((s) => allItems.push({ type: 'shift', data: s }))
  cell.weekendOffs.forEach((off) => allItems.push({ type: 'off', data: off }))

  const visibleItems = allItems.slice(0, maxCardsPerCell)
  const remainingCount = allItems.length - maxCardsPerCell

  const cardsHtml = visibleItems.map(renderStaffCardHtml)

  if (remainingCount > 0) {
    cardsHtml.push(`
      <div class="day-more-notice">
        +${remainingCount} profissional(is) na continuação
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
  logoOnLeft?: boolean
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
    logoOnLeft = false,
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
        <span class="week-headline-title">Semana ${weekData.weekIndex} de ${weekData.weekTotal} &mdash; ${weekData.startDateFormatted} a ${weekData.endDateFormatted}</span>
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
          <div class="legend-item"><span class="legend-chip legend-chip-day">D</span><span>Dia (07:00&ndash;19:00)</span></div>
          <div class="legend-item"><span class="legend-chip legend-chip-night">N</span><span>Noite (19:00&ndash;07:00)</span></div>
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
        <span class="week-headline-title">Continuação &mdash; ${escapeHtml(continuationDay.dayOfWeekName || '')}, ${continuationDay.dayFormatted}${batchPart}</span>
        <span class="week-headline-meta">Detalhamento dos profissionais escalados</span>
      </div>
    `

    const allItems: Array<{ type: 'shift' | 'off' | 'vacation'; data: any }> = []
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
          <div class="legend-item"><span class="legend-chip legend-chip-day">D</span><span>Dia (07:00&ndash;19:00)</span></div>
          <div class="legend-item"><span class="legend-chip legend-chip-night">N</span><span>Noite (19:00&ndash;07:00)</span></div>
          <div class="legend-item"><span class="legend-chip legend-chip-off">FDS</span><span>Folga de Fim de Semana</span></div>
        </div>
      </main>
    `
  } else if (options.overflowDays && options.overflowDays.length > 0) {
    pageBadge = `<span class="header-badge badge-continuation">Continuação</span>`
    const cardsHtml = options.overflowDays
      .map((d) => {
        const items: Array<{ type: 'shift' | 'off' | 'vacation'; data: any }> = []
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
    mainContentHtml = `
      <main class="calendar-wrapper">
        <table class="calendar-table">
          <tbody>${options.weeksHtml || ''}</tbody>
        </table>
      </main>
    `
  }

  const headerHtml = logoOnLeft
    ? `
      <header class="header">
        <div class="header-brand">
          <div class="header-logo-left">
            <img src="${logoBase64}" alt="Logo Institucional BPSCS" />
          </div>
          <div class="header-info">
            <div class="header-org">Beneficência Portuguesa de São Caetano do Sul</div>
            <div class="header-title-row">
              <h1 class="header-title">${escapeHtml(title)}</h1>
              ${pageBadge}
            </div>
            <div class="header-subtitle">${subtitle}</div>
          </div>
        </div>
      </header>
    `
    : `
      <header class="header">
        <div class="header-info">
          <div class="header-org">Beneficência Portuguesa de São Caetano do Sul</div>
          <div class="header-title-row">
            <h1 class="header-title">${escapeHtml(title)}</h1>
            ${pageBadge}
          </div>
          <div class="header-subtitle">${subtitle}</div>
        </div>
        <div class="header-logo">
          <img src="${logoBase64}" alt="Logo Institucional BPSCS" />
        </div>
      </header>
    `

  return `
    <div class="page-container" id="calendar-pdf-page-${pageNumber}">
      ${headerHtml}

      ${headlineBarHtml}

      ${mainContentHtml}

      <footer class="footer">
        <div class="footer-left">
          <span class="footer-org">Beneficência Portuguesa de São Caetano do Sul</span>
          <span class="footer-divider">&bull;</span>
          <span>Gerado em: ${escapeHtml(generatedAt)}</span>
          <span class="footer-divider">&bull;</span>
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
  logoOnLeft?: boolean
  generatedAt: string
  weekDayHeaders: string[]
  pages: CalendarPageData[]
}): string {
  const {
    title,
    subtitle,
    logoBase64,
    logoOnLeft = false,
    generatedAt,
    weekDayHeaders,
    pages,
  } = options
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
        logoOnLeft,
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
        <span class="footer-org">Beneficência Portuguesa de São Caetano do Sul</span>
        <span class="footer-divider">&bull;</span>
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
