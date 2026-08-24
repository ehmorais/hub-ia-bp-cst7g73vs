/**
 * Utilitário compartilhado para cálculo e identificação de Fim de Semana de Folga por Ciclo (WEEKEND_OFF).
 *
 * Reproduz exatamente a mesma regra e algoritmo dos hooks de backend
 * (commit_schedule.js, generate_shifts.js, generate_shifts_draft.js).
 */

export interface WeekendOffShift {
  id?: string
  staff_profile?: string
  user_id?: string
  user?: string
  start_time?: string
  end_time?: string
  date?: string
  sector?: string
  cycle?: string
  [key: string]: any
}

export interface WeekendOffOverrideDetail {
  source_date: string
  target_date: string
  weekday: number // 6 = Saturday, 0 = Sunday
  moved_at: string
  moved_by?: string
  manual_override: true
}

export interface StaffWeekendOffOverrides {
  saturday?: WeekendOffOverrideDetail
  sunday?: WeekendOffOverrideDetail
}

export type WeekendOffOverridesMap = Record<string, StaffWeekendOffOverrides>

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
 * Retorna true se ambas as datas possuem o mesmo dia da semana (date-only, estável).
 */
export function isSameWeekday(dateStrA: string, dateStrB: string): boolean {
  if (!dateStrA || !dateStrB) return false
  return dayOfWeekDateOnly(dateStrA) === dayOfWeekDateOnly(dateStrB)
}

/**
 * Valida se uma operação de override de weekend-off é teoricamente válida:
 * - mesmo colaborador
 * - origem e destino dentro do ciclo
 * - mesmo weekday (6 para sábado, 0 para domingo)
 * - origem é uma das folgas atuais do colaborador
 * - destino é diferente da origem
 */
export function validateWeekendOffOverride({
  staffId,
  sourceDate,
  targetDate,
  cycleStart,
  cycleEnd,
  currentAssignments,
}: {
  staffId: string
  sourceDate: string
  targetDate: string
  cycleStart: string
  cycleEnd: string
  currentAssignments?: string[]
}): { valid: boolean; error?: string; weekday?: number } {
  const normSrc = (sourceDate || '').split(' ')[0].split('T')[0]
  const normTgt = (targetDate || '').split(' ')[0].split('T')[0]
  const normStart = (cycleStart || '').split(' ')[0].split('T')[0]
  const normEnd = (cycleEnd || '').split(' ')[0].split('T')[0]

  if (!staffId) {
    return { valid: false, error: 'Colaborador não informado.' }
  }
  if (!normSrc || !normTgt) {
    return { valid: false, error: 'Data de origem e destino são obrigatórias.' }
  }
  if (normSrc === normTgt) {
    return { valid: false, error: 'A data de destino deve ser diferente da data de origem.' }
  }
  if (normSrc < normStart || normSrc > normEnd) {
    return { valid: false, error: `A data de origem (${normSrc}) está fora do ciclo.` }
  }
  if (normTgt < normStart || normTgt > normEnd) {
    return { valid: false, error: `A data de destino (${normTgt}) está fora do ciclo.` }
  }

  const srcDow = dayOfWeekDateOnly(normSrc)
  const tgtDow = dayOfWeekDateOnly(normTgt)

  if (srcDow !== 6 && srcDow !== 0) {
    return { valid: false, error: 'A data de origem não é um sábado nem um domingo.' }
  }
  if (srcDow !== tgtDow) {
    return {
      valid: false,
      error: `Movimento inválido: não é permitido mover de ${srcDow === 6 ? 'sábado' : 'domingo'} para ${tgtDow === 6 ? 'sábado' : tgtDow === 0 ? 'domingo' : 'dia útil'}. Sábado só pode ir para sábado, domingo só para domingo.`,
    }
  }

  if (currentAssignments && currentAssignments.length > 0) {
    const hasSource = currentAssignments.some(
      (d) => (d || '').split(' ')[0].split('T')[0] === normSrc,
    )
    if (!hasSource) {
      return {
        valid: false,
        error: `A data ${normSrc} não está marcada como folga deste colaborador.`,
      }
    }
  }

  return { valid: true, weekday: srcDow }
}

/**
 * Atualiza o array de assignments do colaborador com o novo destino,
 * preservando exatamente 1 sábado e 1 domingo.
 */
export function moveWeekendOffAssignment(
  currentAssignments: string[],
  sourceDate: string,
  targetDate: string,
): string[] {
  const normSrc = (sourceDate || '').split(' ')[0].split('T')[0]
  const normTgt = (targetDate || '').split(' ')[0].split('T')[0]
  const srcDow = dayOfWeekDateOnly(normSrc)

  const remaining = currentAssignments.filter(
    (d) => (d || '').split(' ')[0].split('T')[0] !== normSrc,
  )

  // Adiciona o novo destino e ordena: primeiro sábado (6), depois domingo (0) ou cronológico
  const updated = [...remaining, normTgt]
  return updated.sort((a, b) => {
    const dowA = dayOfWeekDateOnly(a)
    const dowB = dayOfWeekDateOnly(b)
    if (dowA === 6 && dowB === 0) return -1
    if (dowA === 0 && dowB === 6) return 1
    return a.localeCompare(b)
  })
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
