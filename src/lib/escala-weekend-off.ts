/**
 * Utilitário compartilhado para cálculo e identificação de Folgas por Ciclo:
 * 1. Folga de Fim de Semana (1 data por colaborador: Sábado OU Domingo na paridade trabalhada).
 * 2. Folga Adicional de Dia de Semana (1 data por colaborador: Seg-Sex na paridade trabalhada, ou substituída por timeoff fulfilled).
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
  [key: string]: any
}

export type WeekendOffOverridesMap = Record<string, StaffWeekendOffOverrides>

export interface WeekendOffContract {
  id?: string
  staff_profile?: string
  user?: string
  work_hours?: number
  rest_hours?: number
  shift_type?: string
  shift_parity?: 'even' | 'odd' | string
  cycle_start_date?: string
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

export interface TimeoffRequestItem {
  id?: string
  staff_profile?: string
  user?: string
  date: string
  end_date?: string
  status: 'pending' | 'fulfilled' | 'rejected' | string
  [key: string]: any
}

export interface CycleTimeoffAssignmentResult {
  weekend_off_assignments: Record<string, string[]> // staffId -> [dateStr] (exatamente 1 data no fim de semana)
  additional_off_assignments: Record<string, string[]> // staffId -> [dateStr] (1 data dia de semana)
  approved_timeoffs_applied: Record<string, string[]> // staffId -> [dateStr...]
  timeoff_parity_conflicts: Array<{
    staffId: string
    staffName: string
    date: string
    message: string
  }>
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

// Retorna true se a data é fim de semana (sábado ou domingo)
export function isWeekendDay(dateStr: string): boolean {
  const dow = dayOfWeekDateOnly(dateStr)
  return dow === 6 || dow === 0
}

// Retorna true se a data é dia de semana (segunda a sexta)
export function isWeekdayDate(dateStr: string): boolean {
  const dow = dayOfWeekDateOnly(dateStr)
  return dow >= 1 && dow <= 5
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
 * Formato suportado:
 * - `{ weekend_off_assignments: { staffId: [dateStr] } }` (1 data no sábado ou domingo)
 * - Compatibilidade retroativa com arrays de strings `[sat, sun]`.
 * Valida que as datas pertencem a sábado (6) ou domingo (0).
 */
export function buildWeekendOffMap(
  validationSummary: any,
  vacationsByStaff?: Record<
    string,
    {
      vacation_enabled?: boolean | null
      vacation_start?: string | null
      vacation_end?: string | null
    }
  >,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  const persistedAssignments = validationSummary?.weekend_off_assignments
  if (!persistedAssignments) return map

  const isStaffOnVacationOnDate = (staffId: string, d: string): boolean => {
    if (!vacationsByStaff) return false
    const vac = vacationsByStaff[staffId]
    if (!vac || vac.vacation_enabled !== true) return false
    const start = (vac.vacation_start || '').split(' ')[0].split('T')[0]
    const end = (vac.vacation_end || '').split(' ')[0].split('T')[0]
    if (!start || !end || start > end) return false
    return d >= start && d <= end
  }

  if (Array.isArray(persistedAssignments)) {
    persistedAssignments.forEach((item: any) => {
      const staffId = item?.staff_profile || item?.user_id || item?.user
      const sat = item?.saturday || item?.sat
      const sun = item?.sunday || item?.sun
      const singleDate = item?.date || item?.weekend_off
      if (staffId) {
        let set = map.get(staffId)
        if (!set) {
          set = new Set<string>()
          map.set(staffId, set)
        }
        if (singleDate && isWeekendDay(singleDate)) {
          if (!isStaffOnVacationOnDate(staffId, singleDate)) {
            set.add(singleDate)
          }
        } else if (sat && sun && assertWeekendPair(sat, sun)) {
          if (!isStaffOnVacationOnDate(staffId, sat)) set.add(sat)
          if (!isStaffOnVacationOnDate(staffId, sun)) set.add(sun)
        }
      }
    })
  } else if (typeof persistedAssignments === 'object') {
    Object.entries(persistedAssignments).forEach(([staffId, dates]) => {
      if (Array.isArray(dates)) {
        const validDates: string[] = []
        dates.forEach((d) => {
          if (typeof d === 'string' && isWeekendDay(d)) {
            if (!isStaffOnVacationOnDate(staffId, d)) {
              validDates.push(d)
            }
          }
        })
        if (validDates.length > 0) {
          map.set(staffId, new Set(validDates))
        }
      } else if (typeof dates === 'string' && isWeekendDay(dates)) {
        if (!isStaffOnVacationOnDate(staffId, dates)) {
          map.set(staffId, new Set([dates]))
        }
      }
    })
  }

  return map
}

/**
 * Constrói o Map<staffId, Set<dateStr>> para folgas adicionais de dia de semana (segunda a sexta).
 */
export function buildWeekdayOffMap(validationSummary: any): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  const persistedAdditional = validationSummary?.additional_off_assignments
  if (!persistedAdditional || typeof persistedAdditional !== 'object') return map

  Object.entries(persistedAdditional).forEach(([staffId, dates]) => {
    if (Array.isArray(dates)) {
      const validDates = dates.filter((d) => typeof d === 'string' && isWeekdayDate(d))
      if (validDates.length > 0) {
        map.set(staffId, new Set(validDates))
      }
    } else if (typeof dates === 'string' && isWeekdayDate(dates)) {
      map.set(staffId, new Set([dates]))
    }
  })

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
  vacation,
}: {
  staffId: string
  sourceDate: string
  targetDate: string
  cycleStart: string
  cycleEnd: string
  currentAssignments?: string[]
  vacation?: {
    vacation_enabled?: boolean | null
    vacation_start?: string | null
    vacation_end?: string | null
  }
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

  // Validação: destino não pode estar dentro do período de férias
  if (vacation && vacation.vacation_enabled === true) {
    const vStart = (vacation.vacation_start || '').split(' ')[0].split('T')[0]
    const vEnd = (vacation.vacation_end || '').split(' ')[0].split('T')[0]
    if (vStart && vEnd && vStart <= vEnd && normTgt >= vStart && normTgt <= vEnd) {
      return {
        valid: false,
        error: `A data de destino (${normTgt}) coincide com o período de férias do colaborador. Dias de férias não podem receber folga de fim de semana.`,
      }
    }
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
 * preservando exatamente 1 data ou atualizando a lista.
 */
export function moveWeekendOffAssignment(
  currentAssignments: string[],
  sourceDate: string,
  targetDate: string,
): string[] {
  const normSrc = (sourceDate || '').split(' ')[0].split('T')[0]
  const normTgt = (targetDate || '').split(' ')[0].split('T')[0]

  const remaining = currentAssignments.filter(
    (d) => (d || '').split(' ')[0].split('T')[0] !== normSrc,
  )

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
 * usando âncora determinística por ID de colaborador e paridade.
 * - odd (dias ímpares): posições 1, 3, 5... (offset 0)
 * - even (dias pares): posições 2, 4, 6... (offset 1)
 */
export function computeNaturalPatternByStaff(
  staffId: string,
  allStaffIds: string[],
  cStart: string,
  cEnd: string,
  wHours: number = 12,
  rHours: number = 36,
  options?: {
    shift_parity?: 'even' | 'odd' | string
    cycle_start_date?: string
  },
): Record<string, boolean> {
  const normStart = cStart.split(' ')[0].split('T')[0]
  const normEnd = cEnd.split(' ')[0].split('T')[0]
  const is12x36 = wHours === 12 && rHours >= 36
  const stepDays = Math.max(2, Math.round((wHours + rHours) / 24))

  let offset = 0
  const parity = options?.shift_parity
  const anchorDate = options?.cycle_start_date
    ? options.cycle_start_date.split(' ')[0].split('T')[0]
    : ''

  if (is12x36) {
    if (parity === 'even') {
      offset = 1
    } else if (parity === 'odd') {
      offset = 0
    } else if (anchorDate && anchorDate >= normStart && anchorDate <= normEnd) {
      const diffAnchor = Math.round(
        (new Date(anchorDate + 'T00:00:00Z').getTime() -
          new Date(normStart + 'T00:00:00Z').getTime()) /
          86400000,
      )
      offset = ((diffAnchor % stepDays) + stepDays) % stepDays
    } else {
      const sortedIds = allStaffIds.slice().sort()
      const pos = sortedIds.indexOf(staffId)
      const stableIdx = pos !== -1 ? pos : 0
      offset = stableIdx % stepDays
    }
  }

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

/**
 * Função centralizada para cálculo de folgas do ciclo:
 * 1. Folga de fim de semana (exatamente 1 data: sábado ou domingo na paridade trabalhada).
 * 2. Folga adicional de dia de semana (segunda a sexta na paridade trabalhada, ou substituída por solicitação fulfilled).
 */
export function calculateCycleOffDaysForStaff({
  staffId,
  staffName,
  allStaffIds,
  cycleStart,
  cycleEnd,
  profile,
  timeoffRequests = [],
  staffIndex = 0,
}: {
  staffId: string
  staffName: string
  allStaffIds: string[]
  cycleStart: string
  cycleEnd: string
  profile?: {
    shift_parity?: string
    cycle_start_date?: string
    work_hours?: number
    rest_hours?: number
    vacation_enabled?: boolean | null
    vacation_start?: string | null
    vacation_end?: string | null
  }
  timeoffRequests?: TimeoffRequestItem[]
  staffIndex?: number
}): {
  weekendOffDate: string | null
  additionalOffDate: string | null
  approvedTimeoffDates: string[]
  timeoffConflicts: Array<{ staffId: string; staffName: string; date: string; message: string }>
} {
  const normStart = cycleStart.split(' ')[0].split('T')[0]
  const normEnd = cycleEnd.split(' ')[0].split('T')[0]
  const wH = profile?.work_hours || 12
  const rH = profile?.rest_hours || 36

  const naturalDays = computeNaturalPatternByStaff(
    staffId,
    allStaffIds,
    normStart,
    normEnd,
    wH,
    rH,
    profile,
  )

  // Verificação de férias ativas com limites inclusivos
  const vacEnabled = profile?.vacation_enabled === true
  const vacStart = (profile?.vacation_start || '').split(' ')[0].split('T')[0]
  const vacEnd = (profile?.vacation_end || '').split(' ')[0].split('T')[0]
  const hasVacation = Boolean(vacEnabled && vacStart && vacEnd && vacStart <= vacEnd)
  const isDateInVacation = (d: string): boolean => {
    if (!hasVacation) return false
    return d >= vacStart && d <= vacEnd
  }

  // 1. Candidatos de fim de semana: dias de sábado ou domingo em que o colaborador trabalharia pela paridade
  // E FORA de qualquer período de férias ativo (com limites inclusivos).
  const weekendWorkedCandidates: string[] = []
  // 2. Candidatos de dia de semana: dias de segunda a sexta em que o colaborador trabalharia pela paridade
  const weekdayWorkedCandidates: string[] = []

  let cur = normStart
  while (cur <= normEnd) {
    if (naturalDays[cur]) {
      const dow = dayOfWeekDateOnly(cur)
      if (dow === 6 || dow === 0) {
        if (!isDateInVacation(cur)) {
          weekendWorkedCandidates.push(cur)
        }
      } else if (dow >= 1 && dow <= 5) {
        weekdayWorkedCandidates.push(cur)
      }
    }
    cur = addDaysDateOnly(cur, 1)
  }

  // Escolha determinística de fim de semana (round-robin estável entre os elegíveis fora das férias)
  // Se não existir nenhum sábado/domingo elegível fora das férias no ciclo:
  // NÃO cria folga de fim de semana (retorna null) e NUNCA converte para dia útil.
  let weekendOffDate: string | null = null
  if (weekendWorkedCandidates.length > 0) {
    const idx = staffIndex % weekendWorkedCandidates.length
    weekendOffDate = weekendWorkedCandidates[idx]
  }

  // 3. Processar solicitações de timeoff (apenas status fulfilled e dentro do ciclo)
  const approvedWeekdayWorked: string[] = []
  const timeoffConflicts: Array<{
    staffId: string
    staffName: string
    date: string
    message: string
  }> = []

  const staffTimeoffs = timeoffRequests.filter((t) => {
    const tStaff = t.staff_profile || t.user
    return tStaff === staffId
  })

  staffTimeoffs.forEach((t) => {
    if (t.status === 'fulfilled') {
      const tStart = (t.date || '').split(' ')[0].split('T')[0]
      const tEnd = (t.end_date || t.date || '').split(' ')[0].split('T')[0]
      let d = tStart
      while (d <= tEnd) {
        if (d >= normStart && d <= normEnd) {
          if (isWeekdayDate(d)) {
            if (naturalDays[d]) {
              if (!approvedWeekdayWorked.includes(d)) {
                approvedWeekdayWorked.push(d)
              }
            } else {
              // Folga aprovada em dia de paridade oposta (já estaria de folga)
              timeoffConflicts.push({
                staffId,
                staffName,
                date: d,
                message: `Solicitação aprovada em dia em que ${staffName} já estaria de folga pela paridade (${d}). Nenhuma folga adicional indevida gerada.`,
              })
            }
          }
        }
        d = addDaysDateOnly(d, 1)
      }
    }
  })

  // Escolha de dia de semana:
  // Se houver solicitação aprovada válida (em dia trabalhado), consome a folga adicional automática.
  // Se não houver, escolhe deterministicamente 1 dia entre segunda e sexta na paridade trabalhada.
  let additionalOffDate: string | null = null

  if (approvedWeekdayWorked.length > 0) {
    // Aprovadas substituem a folga automática. Não gera folga automática extra.
    additionalOffDate = approvedWeekdayWorked[0]
  } else if (weekdayWorkedCandidates.length > 0) {
    // Escolha determinística estável
    // Semente: (staffIndex * 3 + 1) % len para espalhar uniformemente
    const idx = (staffIndex * 3 + 1) % weekdayWorkedCandidates.length
    additionalOffDate = weekdayWorkedCandidates[idx]
  }

  return {
    weekendOffDate,
    additionalOffDate,
    approvedTimeoffDates: approvedWeekdayWorked,
    timeoffConflicts,
  }
}
