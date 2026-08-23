/**
 * Utilitário compartilhado para cálculo e identificação de Fim de Semana de Folga por Ciclo (WEEKEND_OFF).
 *
 * Reproduz exatamente a mesma regra e algoritmo dos hooks de backend
 * (commit_schedule.js, generate_shifts.js, generate_shifts_draft.js).
 */

export interface WeekendOffShift {
  staff_profile?: string
  user_id?: string
  user?: string
  start_time?: string
  date?: string
  [key: string]: any
}

export interface WeekendOffContract {
  id?: string
  staff_profile?: string
  user?: string
  work_hours?: number
  rest_hours?: number
  shift_type?: string
  expand?: {
    shift_type?: {
      work_hours?: number
      rest_hours?: number
      [key: string]: any
    }
    [key: string]: any
  }
  [key: string]: any
}

/**
 * Helpers date-only puros que NUNCA sofrem com timezone local.
 */
export function parseDateOnly(s: string): { y: number; m: number; d: number } {
  const clean = (s || '').split('T')[0].split(' ')[0]
  const parts = clean.split('-')
  return { y: +parts[0], m: +parts[1], d: +parts[2] }
}

export function formatDateOnly(y: number, m: number, d: number): string {
  const utc = new Date(Date.UTC(y, m - 1, d))
  const fY = utc.getUTCFullYear()
  const fM = utc.getUTCMonth() + 1
  const fD = utc.getUTCDate()
  return `${fY}-${String(fM).padStart(2, '0')}-${String(fD).padStart(2, '0')}`
}

// Adiciona n dias à data YYYY-MM-DD (aritmética de strings, nunca Date local)
export function addDaysDateOnly(dateStr: string, days: number): string {
  const { y, m, d } = parseDateOnly(dateStr)
  const utc = new Date(Date.UTC(y, m - 1, d + days))
  return formatDateOnly(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate())
}

// Dia da semana 0=domingo, 1=segunda, ..., 6=sábado usando Date.UTC (estável)
export function dayOfWeekDateOnly(dateStr: string): number {
  const { y, m, d } = parseDateOnly(dateStr)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/**
 * Formata um objeto Date do JS local diretamente para YYYY-MM-DD
 * usando métodos locais (getFullYear, getMonth, getDate) sem qualquer conversão de timezone ou UTC shift.
 */
export const formatLocalDateKey = (d: Date): string => {
  if (d instanceof Date && !isNaN(d.getTime())) {
    return formatLocalDateKeySafe(d)
  }
  return ''
}

/**
 * Formata componentes UTC de um objeto Date para YYYY-MM-DD.
 */
export const formatLocalDateKeyUTC = (d: Date): string => {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Extrai ano/mês/dia do objeto Date exatamente como ele foi construído,
 * sem qualquer conversão incorreta de timezone.
 * Se o Date foi construído como `new Date(2026, 9, 4)` (local) ou `new Date("2026-10-04")` (UTC midnight),
 * retorna "2026-10-04".
 */
export function formatLocalDateKeySafe(d: Date): string {
  if (!(d instanceof Date) || isNaN(d.getTime())) return ''

  const utcHours = d.getUTCHours()
  const utcMinutes = d.getUTCMinutes()
  const utcSeconds = d.getUTCSeconds()
  const utcMillis = d.getUTCMilliseconds()

  const localHours = d.getHours()
  const localMinutes = d.getMinutes()
  const localSeconds = d.getSeconds()
  const localMillis = d.getMilliseconds()

  if (
    utcHours === 0 &&
    utcMinutes === 0 &&
    utcSeconds === 0 &&
    utcMillis === 0 &&
    (localHours !== 0 || localMinutes !== 0)
  ) {
    return formatLocalDateKeyUTC(d)
  }

  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Retorna true se saturday é sábado (weekday=6), sunday é saturday+1 e domingo (weekday=0)
export function assertWeekendPair(saturday: string, sunday: string): boolean {
  if (!saturday || !sunday) return false
  if (dayOfWeekDateOnly(saturday) !== 6) return false
  if (dayOfWeekDateOnly(sunday) !== 0) return false
  if (addDaysDateOnly(saturday, 1) !== sunday) return false
  return true
}

// Retorna todos os sábados dentro de [rangeStart, rangeEnd]
export function getSaturdaysInRange(rangeStart: string, rangeEnd: string): string[] {
  const result: string[] = []
  const rStart = rangeStart.split(' ')[0].split('T')[0]
  const rEnd = rangeEnd.split(' ')[0].split('T')[0]
  if (!rStart || !rEnd || rStart > rEnd) return result
  let d = rStart
  while (d <= rEnd) {
    if (dayOfWeekDateOnly(d) === 6) result.push(d)
    d = addDaysDateOnly(d, 1)
  }
  return result
}

/**
 * Retorna todos os pares [{ sat, sun }] completos dentro de [cycleStart, cycleEnd]
 * onde o sábado está no ciclo e o domingo consecutivo também está no ciclo.
 */
export function getCycleWeekendCandidates(
  cycleStart: string,
  cycleEnd: string,
): Array<{ sat: string; sun: string }> {
  const result: Array<{ sat: string; sun: string }> = []
  const cStart = (cycleStart || '').split(' ')[0].split('T')[0]
  const cEnd = (cycleEnd || '').split(' ')[0].split('T')[0]
  if (!cStart || !cEnd || cStart > cEnd) return result

  let dCur = cStart
  while (dCur <= cEnd) {
    if (dayOfWeekDateOnly(dCur) === 6) {
      const satStr = dCur
      const sunStr = addDaysDateOnly(dCur, 1)
      if (sunStr <= cEnd && assertWeekendPair(satStr, sunStr)) {
        result.push({ sat: satStr, sun: sunStr })
      }
    }
    dCur = addDaysDateOnly(dCur, 1)
  }
  return result
}

/**
 * Constrói o Map<staffId, Set<dateStr>> a partir da estrutura validation_summary
 * Formato suportado: `{ staffId: [sat, sun] }` ou array legado de objetos.
 * Valida estritamente cada par com assertWeekendPair.
 */
export function buildWeekendOffMap(validationSummary: any): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  const persistedAssignments = validationSummary?.weekend_off_assignments
  if (!persistedAssignments) return map

  if (Array.isArray(persistedAssignments)) {
    persistedAssignments.forEach((item: any) => {
      const staffId = item?.staff_profile || item?.user_id || item?.user
      const sat = item?.saturday || item?.sat
      const sun = item?.sunday || item?.sun
      if (staffId && sat && sun && assertWeekendPair(sat, sun)) {
        let set = map.get(staffId)
        if (!set) {
          set = new Set<string>()
          map.set(staffId, set)
        }
        set.add(sat)
        set.add(sun)
      }
    })
  } else if (typeof persistedAssignments === 'object') {
    Object.entries(persistedAssignments).forEach(([staffId, dates]) => {
      if (Array.isArray(dates) && dates.length >= 2) {
        const validDates: string[] = []
        for (let i = 0; i < dates.length; i += 2) {
          const sat = dates[i]
          const sun = dates[i + 1]
          if (sat && sun && assertWeekendPair(sat, sun)) {
            validDates.push(sat, sun)
          }
        }
        if (validDates.length > 0) {
          map.set(staffId, new Set(validDates))
        }
      }
    })
  }

  return map
}

/**
 * Computa o padrão natural de plantões para colaboradores 12x36
 * usando âncora determinística por ID de colaborador.
 */
export function computeNaturalPatternByStaff(
  staffId: string,
  allStaffIds: string[],
  cStart: string,
  cEnd: string,
  wHours: number = 12,
  rHours: number = 36,
): Record<string, boolean> {
  const normStart = cStart.split(' ')[0].split('T')[0]
  const normEnd = cEnd.split(' ')[0].split('T')[0]
  const is12x36 = wHours === 12 && rHours >= 36
  const stepDays = Math.max(2, Math.round((wHours + rHours) / 24))
  const sortedIds = allStaffIds.slice().sort()
  const pos = sortedIds.indexOf(staffId)
  const stableIdx = pos !== -1 ? pos : 0
  const offset = is12x36 ? stableIdx % stepDays : 0

  const natDays: Record<string, boolean> = {}
  let cur = addDaysDateOnly(normStart, offset)
  while (cur <= normEnd) {
    natDays[cur] = true
    cur = addDaysDateOnly(cur, stepDays)
  }
  return natDays
}

export function computeNaturalPattern(
  userShiftsList: string[],
  cStart: string,
  cEnd: string,
  wHours: number,
  rHours: number,
): Record<string, boolean> {
  const normStart = cStart.split(' ')[0].split('T')[0]
  const normEnd = cEnd.split(' ')[0].split('T')[0]
  const sDays = Math.max(2, Math.round((wHours + rHours) / 24))
  const natDays: Record<string, boolean> = {}
  if (!userShiftsList || userShiftsList.length === 0 || !normStart || !normEnd) return natDays

  const sorted = userShiftsList.slice().sort()
  const firstDate = sorted[0]
  if (!firstDate) return natDays

  let cur = firstDate
  while (cur <= normEnd) {
    natDays[cur] = true
    cur = addDaysDateOnly(cur, sDays)
  }

  cur = addDaysDateOnly(firstDate, -sDays)
  while (cur >= normStart) {
    natDays[cur] = true
    cur = addDaysDateOnly(cur, -sDays)
  }

  return natDays
}
