/**
 * Utilitário compartilhado para cálculo e identificação de Fim de Semana de Folga Mensal (WEEKEND_OFF).
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
 * Retorna true apenas quando o mês especificado contém pelo menos 2 pares sábado+domingo completos
 * (ambos os dias dentro de [rangeStart, rangeEnd]).
 *
 * @param rangeStart - Data inicial do ciclo ("YYYY-MM-DD")
 * @param rangeEnd - Data final do ciclo ("YYYY-MM-DD")
 * @param yearMonth - Mês a avaliar ("YYYY-MM")
 */
export function isWeekendOffApplicableMonth(
  rangeStart: string,
  rangeEnd: string,
  yearMonth: string,
): boolean {
  if (!rangeStart || !rangeEnd || !yearMonth) return false
  const rStart = rangeStart.split(' ')[0].split('T')[0]
  const rEnd = rangeEnd.split(' ')[0].split('T')[0]
  if (!rStart || !rEnd || rStart > rEnd) return false
  const parts = yearMonth.split('-')
  const y = +parts[0],
    m = +parts[1]
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return false

  // Primeiro e último dia do mês
  const monthStart = formatDateOnly(y, m, 1)
  const monthEnd = formatDateOnly(y, m + 1, 0) // day 0 do mês seguinte = último dia

  let dCur = rStart > monthStart ? rStart : monthStart
  const effectiveEnd = rEnd < monthEnd ? rEnd : monthEnd

  let completePairs = 0
  while (dCur <= effectiveEnd) {
    if (dayOfWeekDateOnly(dCur) === 6) {
      const sunStr = addDaysDateOnly(dCur, 1)
      if (sunStr >= rStart && sunStr <= rEnd && sunStr <= effectiveEnd) {
        completePairs++
      }
    }
    dCur = addDaysDateOnly(dCur, 1)
  }
  return completePairs >= 2
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

/**
 * Calcula os fins de semana de folga mensal atribuídos para cada colaborador.
 *
 * Retorna: Map<staffId, Set<dateStr>>
 * contendo as datas (sábado e domingo em formato 'YYYY-MM-DD') do fim de semana de folga.
 */
export function computeWeekendOffAssignments(
  staffIds: string[],
  shifts: WeekendOffShift[] | Record<string, string[]>,
  contracts: WeekendOffContract[],
  cycleStart: string,
  cycleEnd: string,
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()
  if (!cycleStart || !cycleEnd || !staffIds || staffIds.length === 0) {
    return result
  }

  const normalizedCycleStart = cycleStart.split(' ')[0].split('T')[0]
  const normalizedCycleEnd = cycleEnd.split(' ')[0].split('T')[0]

  if (!normalizedCycleStart || !normalizedCycleEnd || normalizedCycleStart > normalizedCycleEnd) {
    return result
  }

  // Lista de meses que intersectam o ciclo
  const commitMonths: string[] = []
  let commitMonthCursor = normalizedCycleStart
  while (commitMonthCursor <= normalizedCycleEnd) {
    const { y, m } = parseDateOnly(commitMonthCursor)
    const cMKey = `${y}-${String(m).padStart(2, '0')}`
    if (!commitMonths.includes(cMKey)) {
      commitMonths.push(cMKey)
    }
    commitMonthCursor = addDaysDateOnly(commitMonthCursor, 1)
  }

  // Mapa de contratos por staffId
  const contractMap = new Map<string, WeekendOffContract>()
  contracts.forEach((c) => {
    const pid = c.staff_profile || c.user
    if (pid && !contractMap.has(pid)) {
      contractMap.set(pid, c)
    }
  })

  // Mapa de shifts / workedDays por staffId
  const workedDaysMap = new Map<string, Set<string>>()
  staffIds.forEach((id) => workedDaysMap.set(id, new Set<string>()))

  if (Array.isArray(shifts)) {
    shifts.forEach((s) => {
      const pid = s.staff_profile || s.user_id || s.user
      if (!pid) return
      let dateStr = ''
      if (s.date) {
        dateStr = s.date.split(' ')[0].split('T')[0]
      } else if (s.start_time) {
        dateStr = s.start_time.split(' ')[0].split('T')[0]
      }
      if (dateStr) {
        let set = workedDaysMap.get(pid)
        if (!set) {
          set = new Set<string>()
          workedDaysMap.set(pid, set)
        }
        set.add(dateStr)
      }
    })
  } else if (shifts && typeof shifts === 'object') {
    Object.entries(shifts).forEach(([pid, days]) => {
      let set = workedDaysMap.get(pid)
      if (!set) {
        set = new Set<string>()
        workedDaysMap.set(pid, set)
      }
      if (Array.isArray(days)) {
        days.forEach((d) => set.add(d))
      }
    })
  }

  staffIds.forEach((staffId) => {
    const assignedDates = new Set<string>()
    const contract = contractMap.get(staffId)

    const workHours = contract?.work_hours || contract?.expand?.shift_type?.work_hours || 12
    const restHours = contract?.rest_hours || contract?.expand?.shift_type?.rest_hours || 36
    const is12x36 = workHours === 12 && restHours >= 36

    const workedSet = workedDaysMap.get(staffId) || new Set<string>()

    const naturalDays = is12x36
      ? computeNaturalPatternByStaff(
          staffId,
          staffIds,
          normalizedCycleStart,
          normalizedCycleEnd,
          workHours,
          restHours,
        )
      : null

    commitMonths.forEach((monthKey) => {
      if (!isWeekendOffApplicableMonth(normalizedCycleStart, normalizedCycleEnd, monthKey)) {
        return
      }

      const parts = monthKey.split('-')
      const y = +parts[0],
        m = +parts[1]
      const monthStart = formatDateOnly(y, m, 1)
      const monthEnd = formatDateOnly(y, m + 1, 0)

      let dCur = normalizedCycleStart > monthStart ? normalizedCycleStart : monthStart
      const effectiveEnd = normalizedCycleEnd < monthEnd ? normalizedCycleEnd : monthEnd

      while (dCur <= effectiveEnd) {
        if (dayOfWeekDateOnly(dCur) === 6) {
          // Saturday
          const satStr = dCur
          const sunStr = addDaysDateOnly(dCur, 1)

          if (
            sunStr <= normalizedCycleEnd &&
            sunStr >= normalizedCycleStart &&
            assertWeekendPair(satStr, sunStr)
          ) {
            const satFree = !workedSet.has(satStr)
            const sunFree = !workedSet.has(sunStr)

            if (satFree && sunFree) {
              if (is12x36) {
                if (naturalDays && naturalDays[sunStr]) {
                  assignedDates.add(satStr)
                  assignedDates.add(sunStr)
                  break // 1 fim de semana completo de folga por mês-calendário
                }
              } else {
                assignedDates.add(satStr)
                assignedDates.add(sunStr)
                break // 1 fim de semana completo de folga por mês-calendário
              }
            }
          }
        }
        dCur = addDaysDateOnly(dCur, 1)
      }
    })

    if (assignedDates.size > 0) {
      result.set(staffId, assignedDates)
    }
  })

  return result
}

/**
 * Versão simplificada para cálculo de Fim de Semana de Folga Mensal (WEEKEND_OFF).
 */
export function computeWeekendOffAssignmentsSimple(
  staffIds: string[],
  shifts: WeekendOffShift[] | Record<string, string[]>,
  contracts: WeekendOffContract[],
  cycleStart: string,
  cycleEnd: string,
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()
  if (!cycleStart || !cycleEnd || !staffIds || staffIds.length === 0) {
    return result
  }

  const normalizedCycleStart = cycleStart.split(' ')[0].split('T')[0]
  const normalizedCycleEnd = cycleEnd.split(' ')[0].split('T')[0]

  if (!normalizedCycleStart || !normalizedCycleEnd || normalizedCycleStart > normalizedCycleEnd) {
    return result
  }

  // Lista de meses que intersectam o ciclo
  const commitMonths: string[] = []
  let commitMonthCursor = normalizedCycleStart
  while (commitMonthCursor <= normalizedCycleEnd) {
    const { y, m } = parseDateOnly(commitMonthCursor)
    const cMKey = `${y}-${String(m).padStart(2, '0')}`
    if (!commitMonths.includes(cMKey)) {
      commitMonths.push(cMKey)
    }
    commitMonthCursor = addDaysDateOnly(commitMonthCursor, 1)
  }

  // Mapa de shifts / workedDays por staffId
  const workedDaysMap = new Map<string, Set<string>>()
  staffIds.forEach((id) => workedDaysMap.set(id, new Set<string>()))

  if (Array.isArray(shifts)) {
    shifts.forEach((s) => {
      const pid = s.staff_profile || s.user_id || s.user
      if (!pid) return
      let dateStr = ''
      if (s.date) {
        dateStr = s.date.split(' ')[0].split('T')[0]
      } else if (s.start_time) {
        dateStr = s.start_time.split(' ')[0].split('T')[0]
      }
      if (dateStr) {
        let set = workedDaysMap.get(pid)
        if (!set) {
          set = new Set<string>()
          workedDaysMap.set(pid, set)
        }
        set.add(dateStr)
      }
    })
  } else if (shifts && typeof shifts === 'object') {
    Object.entries(shifts).forEach(([pid, days]) => {
      let set = workedDaysMap.get(pid)
      if (!set) {
        set = new Set<string>()
        workedDaysMap.set(pid, set)
      }
      if (Array.isArray(days)) {
        days.forEach((d) => set.add(d))
      }
    })
  }

  staffIds.forEach((staffId) => {
    const assignedDates = new Set<string>()
    const workedSet = workedDaysMap.get(staffId) || new Set<string>()

    commitMonths.forEach((monthKey) => {
      if (!isWeekendOffApplicableMonth(normalizedCycleStart, normalizedCycleEnd, monthKey)) {
        return
      }

      const parts = monthKey.split('-')
      const y = +parts[0],
        m = +parts[1]
      const monthStart = formatDateOnly(y, m, 1)
      const monthEnd = formatDateOnly(y, m + 1, 0)

      let dCur = normalizedCycleStart > monthStart ? normalizedCycleStart : monthStart
      const effectiveEnd = normalizedCycleEnd < monthEnd ? normalizedCycleEnd : monthEnd

      while (dCur <= effectiveEnd) {
        if (dayOfWeekDateOnly(dCur) === 6) {
          // Saturday
          const satStr = dCur
          const sunStr = addDaysDateOnly(dCur, 1)

          if (
            sunStr <= normalizedCycleEnd &&
            sunStr >= normalizedCycleStart &&
            assertWeekendPair(satStr, sunStr)
          ) {
            const satFree = !workedSet.has(satStr)
            const sunFree = !workedSet.has(sunStr)

            if (satFree && sunFree) {
              assignedDates.add(satStr)
              assignedDates.add(sunStr)
              break // 1 fim de semana completo de folga por mês-calendário
            }
          }
        }
        dCur = addDaysDateOnly(dCur, 1)
      }
    })

    if (assignedDates.size > 0) {
      result.set(staffId, assignedDates)
    }
  })

  return result
}
