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
 * Computa o padrão natural de plantões para colaboradores 12x36
 * a partir do primeiro plantão do colaborador no ciclo, projetando para frente e para trás.
 */
/**
 * Determina o padrão de dias naturalmente trabalhados usando âncora determinística por ID de colaborador.
 */
export function computeNaturalPatternByStaff(
  staffId: string,
  allStaffIds: string[],
  cStart: string,
  cEnd: string,
  wHours: number = 12,
  rHours: number = 36,
): Record<string, boolean> {
  const is12x36 = wHours === 12 && rHours >= 36
  const stepDays = Math.max(2, Math.round((wHours + rHours) / 24))
  const sortedIds = allStaffIds.slice().sort()
  const pos = sortedIds.indexOf(staffId)
  const stableIdx = pos !== -1 ? pos : 0
  const offset = is12x36 ? stableIdx % stepDays : 0

  const natDays: Record<string, boolean> = {}
  let cur = new Date(cStart + 'T00:00:00Z')
  cur = new Date(cur.getTime() + offset * 86400000)
  const eDate = new Date(cEnd + 'T00:00:00Z')
  while (cur <= eDate) {
    natDays[cur.toISOString().split('T')[0]] = true
    cur = new Date(cur.getTime() + stepDays * 86400000)
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
  const sDays = Math.max(2, Math.round((wHours + rHours) / 24))
  const natDays: Record<string, boolean> = {}
  if (!userShiftsList || userShiftsList.length === 0 || !cStart || !cEnd) return natDays

  const sorted = userShiftsList.slice().sort()
  const firstDate = sorted[0]
  if (!firstDate) return natDays

  let cur = new Date(firstDate + 'T00:00:00Z')
  const eDate = new Date(cEnd + 'T00:00:00Z')
  while (cur <= eDate) {
    natDays[cur.toISOString().split('T')[0]] = true
    cur = new Date(cur.getTime() + sDays * 86400000)
  }

  cur = new Date(firstDate + 'T00:00:00Z')
  cur = new Date(cur.getTime() - sDays * 86400000)
  const sDate = new Date(cStart + 'T00:00:00Z')
  while (cur >= sDate) {
    natDays[cur.toISOString().split('T')[0]] = true
    cur = new Date(cur.getTime() - sDays * 86400000)
  }

  return natDays
}

/**
 * Calcula os fins de semana de folga mensal atribuídos para cada colaborador.
 *
 * Retorna: Map<staffId, Set<dateStr>> (ou Record<string, Set<string>>)
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
  let commitMonthCursor = new Date(normalizedCycleStart + 'T00:00:00Z')
  const commitMonthEnd = new Date(normalizedCycleEnd + 'T00:00:00Z')
  while (commitMonthCursor <= commitMonthEnd) {
    const cMKey =
      commitMonthCursor.getUTCFullYear() +
      '-' +
      String(commitMonthCursor.getUTCMonth() + 1).padStart(2, '0')
    if (!commitMonths.includes(cMKey)) {
      commitMonths.push(cMKey)
    }
    commitMonthCursor = new Date(commitMonthCursor.getTime() + 86400000)
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
    const uShifts = Array.from(workedSet)

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

    let foundForAnyMonth = false
    commitMonths.forEach((monthKey) => {
      const parts = monthKey.split('-')
      const y = Number(parts[0])
      const m = Number(parts[1])
      let dCur = new Date(Date.UTC(y, m - 1, 1))
      let dLast = new Date(Date.UTC(y, m, 0))
      const cStart = new Date(normalizedCycleStart + 'T00:00:00Z')
      const cEnd = new Date(normalizedCycleEnd + 'T00:00:00Z')

      if (dCur < cStart) dCur = new Date(cStart)
      if (dLast > cEnd) dLast = new Date(cEnd)

      let foundForMonth = false
      while (dCur <= dLast) {
        if (dCur.getUTCDay() === 6) {
          // Saturday
          const satStr = dCur.toISOString().split('T')[0]
          const sunDate = new Date(dCur.getTime() + 86400000)
          const sunStr = sunDate.toISOString().split('T')[0]

          if (sunDate <= cEnd && sunDate >= cStart) {
            const satFree = !workedSet.has(satStr)
            const sunFree = !workedSet.has(sunStr)

            if (satFree && sunFree) {
              if (is12x36) {
                if (naturalDays && naturalDays[sunStr]) {
                  assignedDates.add(satStr)
                  assignedDates.add(sunStr)
                  foundForMonth = true
                  foundForAnyMonth = true
                  break // 1 fim de semana completo de folga por mês-calendário
                }
              } else {
                assignedDates.add(satStr)
                assignedDates.add(sunStr)
                foundForMonth = true
                foundForAnyMonth = true
                break // 1 fim de semana completo de folga por mês-calendário
              }
            }
          }
        }
        dCur = new Date(dCur.getTime() + 86400000)
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
 *
 * Para cada staff_id, por mês-calendário que intersecta o ciclo, encontra o primeiro sábado
 * consecutivo com domingo em que AMBOS os dias estão SEM plantão.
 * - NÃO usa naturalDays nem constraint de domingo naturalmente trabalhado
 * - NÃO depende de âncora de primeiro plantão
 * - Retorna Map<string, Set<string>> no mesmo formato
 * - Só retorna pares onde ambos os dias estão realmente livres (sem plantão no workedDaysMap)
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
  let commitMonthCursor = new Date(normalizedCycleStart + 'T00:00:00Z')
  const commitMonthEnd = new Date(normalizedCycleEnd + 'T00:00:00Z')
  while (commitMonthCursor <= commitMonthEnd) {
    const cMKey =
      commitMonthCursor.getUTCFullYear() +
      '-' +
      String(commitMonthCursor.getUTCMonth() + 1).padStart(2, '0')
    if (!commitMonths.includes(cMKey)) {
      commitMonths.push(cMKey)
    }
    commitMonthCursor = new Date(commitMonthCursor.getTime() + 86400000)
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
      const parts = monthKey.split('-')
      const y = Number(parts[0])
      const m = Number(parts[1])
      let dCur = new Date(Date.UTC(y, m - 1, 1))
      let dLast = new Date(Date.UTC(y, m, 0))
      const cStart = new Date(normalizedCycleStart + 'T00:00:00Z')
      const cEnd = new Date(normalizedCycleEnd + 'T00:00:00Z')

      if (dCur < cStart) dCur = new Date(cStart)
      if (dLast > cEnd) dLast = new Date(cEnd)

      while (dCur <= dLast) {
        if (dCur.getUTCDay() === 6) {
          // Saturday
          const satStr = dCur.toISOString().split('T')[0]
          const sunDate = new Date(dCur.getTime() + 86400000)
          const sunStr = sunDate.toISOString().split('T')[0]

          if (sunDate <= cEnd && sunDate >= cStart) {
            const satFree = !workedSet.has(satStr)
            const sunFree = !workedSet.has(sunStr)

            if (satFree && sunFree) {
              assignedDates.add(satStr)
              assignedDates.add(sunStr)
              break // 1 fim de semana completo de folga por mês-calendário
            }
          }
        }
        dCur = new Date(dCur.getTime() + 86400000)
      }
    })

    if (assignedDates.size > 0) {
      result.set(staffId, assignedDates)
    }
  })

  return result
}
