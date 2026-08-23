import { describe, it, expect } from 'vitest'
import {
  parseDateOnly,
  formatDateOnly,
  addDaysDateOnly,
  dayOfWeekDateOnly,
  assertWeekendPair,
  getSaturdaysInRange,
  isWeekendOffApplicableMonth,
} from '../src/lib/escala-weekend-off'

// Core simulation matching generate_shifts_draft.js / generate_shifts.js v0.0.251

interface StaffMember {
  id: string
  name: string
  work_hours: number
  rest_hours: number
  monthly_hour_limit: number
  requires_supervision: boolean
}

interface Shift {
  user_id: string
  date: string
}

function computeNaturalPatternByStaff(
  staffId: string,
  staffContracts: StaffMember[],
  cStart: string,
  cEnd: string,
): Record<string, boolean> {
  const contract = staffContracts.find((c) => c.id === staffId)
  const workHours = contract ? contract.work_hours : 12
  const restHours = contract ? contract.rest_hours : 36
  const is12x36 = workHours === 12 && restHours >= 36
  const stepDays = Math.max(2, Math.round((workHours + restHours) / 24))

  const sortedIds = staffContracts.map((c) => c.id).sort()
  const pos = sortedIds.indexOf(staffId)
  const stableIdx = pos !== -1 ? pos : 0

  const offset = is12x36 ? stableIdx % stepDays : 0
  const map: Record<string, boolean> = {}
  let cur = addDaysDateOnly(cStart, offset)
  while (cur <= cEnd) {
    map[cur] = true
    cur = addDaysDateOnly(cur, stepDays)
  }
  return map
}

function runCompleteAndEnforceWeekendOff(
  staffList: StaffMember[],
  cStart: string,
  cEnd: string,
  minStaff: number,
) {
  // 1. Compute completionOrder & build initial shifts using stable targetOffset
  const completionOrder = staffList.slice().sort((a, b) => {
    if (a.requires_supervision === b.requires_supervision) {
      return a.name < b.name ? -1 : 1
    }
    return a.requires_supervision ? 1 : -1
  })

  const sortedStaffIds = staffList.map((c) => c.id).sort()
  const draft: Shift[] = []
  const rebuiltDayCount: Record<string, number> = {}
  const rebuiltIndependentCount: Record<string, number> = {}

  completionOrder.forEach((u) => {
    const isRegular12x36 = u.work_hours === 12 && u.rest_hours >= 36
    if (!isRegular12x36) return

    const stableIdx = sortedStaffIds.indexOf(u.id)
    const stepDays = Math.max(2, Math.round((u.work_hours + u.rest_hours) / 24))
    const maxShifts = Math.floor((u.monthly_hour_limit || 0) / u.work_hours)
    const targetOffset = stableIdx % stepDays
    let bestDates: string[] = []
    let bestScore = Number.MAX_SAFE_INTEGER

    for (let offset = 0; offset < stepDays; offset++) {
      const dates: string[] = []
      let offsetCursor = addDaysDateOnly(cStart, offset)
      while (offsetCursor <= cEnd && dates.length < maxShifts) {
        dates.push(offsetCursor)
        offsetCursor = addDaysDateOnly(offsetCursor, stepDays)
      }

      let score = -dates.length * 1000
      if (offset === targetOffset) score -= 500
      dates.forEach((date) => {
        score += (rebuiltDayCount[date] || 0) * 10
        if (u.requires_supervision && !(rebuiltIndependentCount[date] > 0)) {
          score += 100
        }
      })
      if (score < bestScore) {
        bestScore = score
        bestDates = dates
      }
    }

    bestDates.forEach((date) => {
      draft.push({ user_id: u.id, date })
      rebuiltDayCount[date] = (rebuiltDayCount[date] || 0) + 1
      if (!u.requires_supervision) {
        rebuiltIndependentCount[date] = (rebuiltIndependentCount[date] || 0) + 1
      }
    })
  })

  // 2. enforceWeekendOff with protectedDates and single-anchor natural pattern
  const months: Record<string, boolean> = {}
  let mCur = cStart
  while (mCur <= cEnd) {
    const p = parseDateOnly(mCur)
    const mKey = p.y + '-' + String(p.m).padStart(2, '0')
    months[mKey] = true
    mCur = addDaysDateOnly(mCur, 1)
  }

  const naturalWorkedMap: Record<string, Record<string, boolean>> = {}
  staffList.forEach((u) => {
    naturalWorkedMap[u.id] = computeNaturalPatternByStaff(u.id, staffList, cStart, cEnd)
  })

  let workingShifts = draft.map((s) => ({ user_id: s.user_id, date: s.date }))
  let shiftsByStaff: Record<string, Record<string, boolean>> = {}
  staffList.forEach((u) => {
    shiftsByStaff[u.id] = {}
  })
  workingShifts.forEach((s) => {
    shiftsByStaff[s.user_id][s.date] = true
  })

  const cloneState = (
    shiftsArr: Shift[],
    staffMap: Record<string, Record<string, boolean>>,
  ) => {
    const clonedShifts = shiftsArr.map((s) => ({ user_id: s.user_id, date: s.date }))
    const clonedStaffMap: Record<string, Record<string, boolean>> = {}
    Object.keys(staffMap).forEach((k) => {
      clonedStaffMap[k] = { ...staffMap[k] }
    })
    return { shifts: clonedShifts, staffMap: clonedStaffMap }
  }

  const checkCoverageOk = (shiftsArr: Shift[]) => {
    if (!minStaff || minStaff <= 0) return true
    const dCounts: Record<string, number> = {}
    for (let si = 0; si < shiftsArr.length; si++) {
      const d = shiftsArr[si].date
      dCounts[d] = (dCounts[d] || 0) + 1
    }
    let curDate = cStart
    while (curDate <= cEnd) {
      if ((dCounts[curDate] || 0) < minStaff) {
        return false
      }
      curDate = addDaysDateOnly(curDate, 1)
    }
    return true
  }

  const assignments: Record<string, string[]> = {}
  const protectedDates: Record<string, boolean> = {}
  const issues: string[] = []

  // --- FASE 1: Planejamento (antes de qualquer swap) ---
  const plannedByStaff: Record<
    string,
    Array<{
      monthKey: string
      orderedCandidates: Array<{ sat: string; sun: string; sunIsNat: boolean }>
      currentChoice: { sat: string; sun: string; sunIsNat: boolean }
    }>
  > = {}
  staffList.forEach((u) => {
    plannedByStaff[u.id] = []
  })

  Object.keys(months).forEach((mKey) => {
    if (!isWeekendOffApplicableMonth(cStart, cEnd, mKey)) {
      return
    }

    const parts = mKey.split('-')
    const y = Number(parts[0])
    const m = Number(parts[1])
    const monthStart = formatDateOnly(y, m, 1)
    const monthEnd = formatDateOnly(y, m + 1, 0)
    let dCur = cStart > monthStart ? cStart : monthStart
    const effectiveEnd = cEnd < monthEnd ? cEnd : monthEnd

    const monthWeekends: Array<{ sat: string; sun: string }> = []
    while (dCur <= effectiveEnd) {
      if (dayOfWeekDateOnly(dCur) === 6) {
        const satStr = dCur
        const sunStr = addDaysDateOnly(dCur, 1)
        if (sunStr <= cEnd && sunStr >= cStart && assertWeekendPair(satStr, sunStr)) {
          monthWeekends.push({ sat: satStr, sun: sunStr })
        }
      }
      dCur = addDaysDateOnly(dCur, 1)
    }

    if (monthWeekends.length === 0) {
      return
    }

    staffList.forEach((u, staffIndex) => {
      const is12x36 = u.work_hours === 12 && u.rest_hours >= 36
      const uNatSet = naturalWorkedMap[u.id] || {}

      const userCandidates = monthWeekends.map((w) => ({
        sat: w.sat,
        sun: w.sun,
        sunIsNat: is12x36 ? !!uNatSet[w.sun] : true,
      }))

      let natCandidates = userCandidates.filter((w) => w.sunIsNat)
      if (natCandidates.length === 0) {
        natCandidates = userCandidates.slice()
      }

      const assignedIdx = staffIndex % natCandidates.length
      const orderedCandidates: typeof natCandidates = []
      for (let oi = 0; oi < natCandidates.length; oi++) {
        orderedCandidates.push(natCandidates[(assignedIdx + oi) % natCandidates.length])
      }

      const initialChoice = orderedCandidates[0]
      plannedByStaff[u.id].push({
        monthKey: mKey,
        orderedCandidates,
        currentChoice: initialChoice,
      })

      // Pré-preenche protectedDates imediatamente
      protectedDates[u.id + ':' + initialChoice.sat] = true
      protectedDates[u.id + ':' + initialChoice.sun] = true
    })
  })

  // --- FASE 2: Execução (swaps) ---
  staffList.forEach((u) => {
    const userPlans = plannedByStaff[u.id] || []
    const userPairs: string[] = []

    userPlans.forEach((plan) => {
      const mKey = plan.monthKey
      const orderedCandidates = plan.orderedCandidates
      let initialChoice = plan.currentChoice
      let committedWeekend: (typeof orderedCandidates)[0] | null = null

      for (let ci = 0; ci < orderedCandidates.length; ci++) {
        const candidate = orderedCandidates[ci]
        const satStr = candidate.sat
        const sunStr = candidate.sun

        if (candidate !== initialChoice) {
          delete protectedDates[u.id + ':' + initialChoice.sat]
          delete protectedDates[u.id + ':' + initialChoice.sun]
          protectedDates[u.id + ':' + satStr] = true
          protectedDates[u.id + ':' + sunStr] = true
          initialChoice = candidate
        }

        const snapshot = cloneState(workingShifts, shiftsByStaff)
        const candidateShifts = snapshot.shifts
        const candidateStaffMap = snapshot.staffMap

        const datesToFree: string[] = []
        if (candidateStaffMap[u.id][satStr]) datesToFree.push(satStr)
        if (candidateStaffMap[u.id][sunStr]) datesToFree.push(sunStr)

        let candidatePossible = true

        for (let di = 0; di < datesToFree.length; di++) {
          const dt = datesToFree[di]

          const candList = staffList.filter((cand) => {
            return (
              cand.id !== u.id &&
              !candidateStaffMap[cand.id][dt] &&
              !protectedDates[cand.id + ':' + dt]
            )
          })

          let subFound: StaffMember | null = null
          for (let sli = 0; sli < candList.length; sli++) {
            const c = candList[sli]
            const cRest = c.rest_hours || 36
            const cNeedGap = Math.max(1, Math.ceil((cRest + 0.001) / 24))
            let gapOk = true
            const cDates = Object.keys(candidateStaffMap[c.id]).filter(
              (d) => candidateStaffMap[c.id][d],
            )
            for (let cdi = 0; cdi < cDates.length; cdi++) {
              const diffDays = Math.abs(
                (new Date(dt + 'T00:00:00Z').getTime() -
                  new Date(cDates[cdi] + 'T00:00:00Z').getTime()) /
                  86400000,
              )
              if (diffDays < cNeedGap) {
                gapOk = false
                break
              }
            }
            if (gapOk) {
              subFound = c
              break
            }
          }

          if (subFound) {
            for (let si = 0; si < candidateShifts.length; si++) {
              if (candidateShifts[si].user_id === u.id && candidateShifts[si].date === dt) {
                candidateShifts[si].user_id = subFound.id
                candidateStaffMap[u.id][dt] = false
                candidateStaffMap[subFound.id][dt] = true
                break
              }
            }
          } else {
            let currentDayCount = 0
            for (let csi = 0; csi < candidateShifts.length; csi++) {
              if (candidateShifts[csi].date === dt) currentDayCount++
            }
            if (minStaff > 0 && currentDayCount - 1 < minStaff) {
              candidatePossible = false
              break
            }
            for (let si2 = 0; si2 < candidateShifts.length; si2++) {
              if (candidateShifts[si2].user_id === u.id && candidateShifts[si2].date === dt) {
                candidateShifts.splice(si2, 1)
                candidateStaffMap[u.id][dt] = false
                break
              }
            }
          }
        }

        if (
          candidatePossible &&
          !candidateStaffMap[u.id][satStr] &&
          !candidateStaffMap[u.id][sunStr] &&
          checkCoverageOk(candidateShifts)
        ) {
          workingShifts = candidateShifts
          shiftsByStaff = candidateStaffMap
          committedWeekend = candidate
          break
        }
      }

      if (committedWeekend) {
        userPairs.push(committedWeekend.sat)
        userPairs.push(committedWeekend.sun)
        protectedDates[u.id + ':' + committedWeekend.sat] = true
        protectedDates[u.id + ':' + committedWeekend.sun] = true
      } else {
        issues.push(`Fim de semana obrigatório não atendido para ${u.name} em ${mKey}`)
      }
    })

    if (userPairs.length > 0) {
      assignments[u.id] = userPairs
    }
  })

  return {
    shifts: workingShifts,
    assignments,
    issues,
    protectedDates,
    naturalWorkedMap,
  }
}

describe('Weekend Off Regression & Consistency Test (v0.0.251)', () => {
  const staffFixture: StaffMember[] = [
    { id: 'staff_1', name: 'Ana Silva', work_hours: 12, rest_hours: 36, monthly_hour_limit: 180, requires_supervision: false },
    { id: 'staff_2', name: 'Bruno Santos', work_hours: 12, rest_hours: 36, monthly_hour_limit: 180, requires_supervision: false },
    { id: 'staff_3', name: 'Carlos Lima', work_hours: 12, rest_hours: 36, monthly_hour_limit: 180, requires_supervision: true },
    { id: 'staff_4', name: 'Daniela Oliveira', work_hours: 12, rest_hours: 36, monthly_hour_limit: 180, requires_supervision: false },
    { id: 'staff_5', name: 'Eduardo Pereira', work_hours: 12, rest_hours: 36, monthly_hour_limit: 180, requires_supervision: true },
    { id: 'staff_6', name: 'Fernanda Costa', work_hours: 12, rest_hours: 36, monthly_hour_limit: 180, requires_supervision: false },
  ]

  const cycleStart = '2026-10-01'
  const cycleEnd = '2026-11-30'
  const minStaffing = 2

  it('computes stable and identical natural pattern regardless of staff member order', () => {
    const natural1 = computeNaturalPatternByStaff('staff_1', staffFixture, cycleStart, cycleEnd)
    const reversed = staffFixture.slice().reverse()
    const natural1Reversed = computeNaturalPatternByStaff('staff_1', reversed, cycleStart, cycleEnd)

    expect(natural1).toEqual(natural1Reversed)
  })

  it('assigns exactly one full weekend off per month for all staff members across a 2-month cycle', () => {
    const result = runCompleteAndEnforceWeekendOff(staffFixture, cycleStart, cycleEnd, minStaffing)

    expect(result.issues).toEqual([])

    staffFixture.forEach((staff) => {
      const userAssigned = result.assignments[staff.id] || []
      // 2 months => 2 pairs (4 dates total: 2 sats + 2 suns)
      expect(userAssigned.length).toBe(4)

      const octSat = userAssigned[0]
      const octSun = userAssigned[1]
      const novSat = userAssigned[2]
      const novSun = userAssigned[3]

      expect(octSat.startsWith('2026-10-')).toBe(true)
      expect(octSun.startsWith('2026-10-')).toBe(true)
      expect(novSat.startsWith('2026-11-')).toBe(true)
      expect(novSun.startsWith('2026-11-')).toBe(true)
    })
  })

  it('guarantees no staff has a shift on their reserved weekend off dates', () => {
    const result = runCompleteAndEnforceWeekendOff(staffFixture, cycleStart, cycleEnd, minStaffing)

    staffFixture.forEach((staff) => {
      const userAssigned = result.assignments[staff.id] || []
      const userShifts = result.shifts.filter((s) => s.user_id === staff.id).map((s) => s.date)

      userAssigned.forEach((assignedDate) => {
        expect(userShifts.includes(assignedDate)).toBe(false)
      })
    })
  })

  it('guarantees natural_sunday_worked = true for every 12x36 weekend off assignment', () => {
    const result = runCompleteAndEnforceWeekendOff(staffFixture, cycleStart, cycleEnd, minStaffing)

    staffFixture.forEach((staff) => {
      const userAssigned = result.assignments[staff.id] || []
      const naturalDays = result.naturalWorkedMap[staff.id]

      for (let i = 0; i < userAssigned.length; i += 2) {
        const sun = userAssigned[i + 1]
        expect(naturalDays[sun]).toBe(true)
      }
    })
  })

  it('guarantees protected dates are never picked for subsequent substitute candidates', () => {
    const result = runCompleteAndEnforceWeekendOff(staffFixture, cycleStart, cycleEnd, minStaffing)

    // Verify for all protected dates that no shift exists for that user on that date
    Object.keys(result.protectedDates).forEach((key) => {
      const [userId, dateStr] = key.split(':')
      const hasShift = result.shifts.some((s) => s.user_id === userId && s.date === dateStr)
      expect(hasShift).toBe(false)
    })
  })

  it('meets min_staffing coverage on every single day of the 2-month cycle', () => {
    const result = runCompleteAndEnforceWeekendOff(staffFixture, cycleStart, cycleEnd, minStaffing)

    const dayCounts: Record<string, number> = {}
    result.shifts.forEach((s) => {
      dayCounts[s.date] = (dayCounts[s.date] || 0) + 1
    })

    let cur = new Date(cycleStart + 'T00:00:00Z')
    const end = new Date(cycleEnd + 'T00:00:00Z')
    while (cur <= end) {
      const dStr = cur.toISOString().split('T')[0]
      expect(dayCounts[dStr] || 0).toBeGreaterThanOrEqual(minStaffing)
      cur = new Date(cur.getTime() + 86400000)
    }
  })

  it('Teste A — Setembro parcial não exige weekend-off (ciclo 26/09/2026-25/10/2026)', () => {
    const rStart = '2026-09-26'
    const rEnd = '2026-10-25'

    // Assert helper
    expect(isWeekendOffApplicableMonth(rStart, rEnd, '2026-09')).toBe(false)
    expect(isWeekendOffApplicableMonth(rStart, rEnd, '2026-10')).toBe(true)

    const result = runCompleteAndEnforceWeekendOff(staffFixture, rStart, rEnd, 2)

    // Assert: nenhuma issue WEEKEND_OFF para Setembro
    expect(result.issues).toEqual([])

    // Assert: 6 assignments válidos para Outubro (cada colaboradora tem 1 par de folga apenas em Outubro)
    staffFixture.forEach((staff) => {
      const userAssigned = result.assignments[staff.id] || []
      // Apenas outubro tem fim de semana de folga obrigatório (2 datas: 1 sábado + 1 domingo de outubro)
      expect(userAssigned.length).toBe(2)
      const sat = userAssigned[0]
      const sun = userAssigned[1]
      expect(sat.startsWith('2026-10-')).toBe(true)
      expect(sun.startsWith('2026-10-')).toBe(true)
    })
  })

  it('Teste B — protectedDates pré-preenchido impede roubo de fim de semana', () => {
    // 4 colaboradoras 12x36 em um ciclo com 2 fins de semana (ex: 2026-10-01 a 2026-10-15)
    // Fins de semana: 03-04/10 e 10-11/10
    const fourStaff: StaffMember[] = [
      { id: 'staff_A', name: 'Colaboradora A', work_hours: 12, rest_hours: 36, monthly_hour_limit: 180, requires_supervision: false },
      { id: 'staff_B', name: 'Colaboradora B', work_hours: 12, rest_hours: 36, monthly_hour_limit: 180, requires_supervision: false },
      { id: 'staff_C', name: 'Colaboradora C', work_hours: 12, rest_hours: 36, monthly_hour_limit: 180, requires_supervision: false },
      { id: 'staff_D', name: 'Colaboradora D', work_hours: 12, rest_hours: 36, monthly_hour_limit: 180, requires_supervision: false },
    ]

    const shortCycleStart = '2026-10-01'
    const shortCycleEnd = '2026-10-15'

    const result = runCompleteAndEnforceWeekendOff(fourStaff, shortCycleStart, shortCycleEnd, 1)

    expect(result.issues).toEqual([])

    const assignA = result.assignments['staff_A'] || []
    const assignB = result.assignments['staff_B'] || []

    expect(assignA.length).toBe(2)
    expect(assignB.length).toBe(2)

    // Colaboradora A e B não têm shifts em seus próprios fins de semana reservados
    const shiftsA = result.shifts.filter((s) => s.user_id === 'staff_A').map((s) => s.date)
    const shiftsB = result.shifts.filter((s) => s.user_id === 'staff_B').map((s) => s.date)

    assignA.forEach((d) => {
      expect(shiftsA.includes(d)).toBe(false)
    })

    assignB.forEach((d) => {
      expect(shiftsB.includes(d)).toBe(false)
    })

    // Colaboradora B não roubou o fim de semana da colaboradora A (A não tem plantão nos seus dias protegidos)
    expect(result.protectedDates['staff_A:' + assignA[0]]).toBe(true)
    expect(result.protectedDates['staff_A:' + assignA[1]]).toBe(true)
    expect(result.protectedDates['staff_B:' + assignB[0]]).toBe(true)
    expect(result.protectedDates['staff_B:' + assignB[1]]).toBe(true)
  })

  describe('Pure Date-Only Timezone Immobility Tests', () => {
    it('1. Teste TZ UTC: assertWeekendPair("2026-10-03", "2026-10-04") deve retornar true (sábado+domingo)', () => {
      expect(assertWeekendPair('2026-10-03', '2026-10-04')).toBe(true)
    })

    it('2. Teste TZ UTC: assertWeekendPair("2026-10-04", "2026-10-05") deve retornar false (domingo+segunda)', () => {
      expect(assertWeekendPair('2026-10-04', '2026-10-05')).toBe(false)
    })

    it('3. Para TODOS os sábados de Outubro/2026 (03, 10, 17, 24, 31), assertWeekendPair(sat, addDaysDateOnly(sat,1)) deve retornar true', () => {
      const saturdaysOct2026 = ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31']
      const detectedSats = getSaturdaysInRange('2026-10-01', '2026-10-31')
      expect(detectedSats).toEqual(saturdaysOct2026)

      saturdaysOct2026.forEach((sat) => {
        const sun = addDaysDateOnly(sat, 1)
        expect(assertWeekendPair(sat, sun)).toBe(true)
      })
    })

    it('4. dayOfWeekDateOnly("2026-10-03") === 6 (Sábado)', () => {
      expect(dayOfWeekDateOnly('2026-10-03')).toBe(6)
    })

    it('5. dayOfWeekDateOnly("2026-10-04") === 0 (Domingo)', () => {
      expect(dayOfWeekDateOnly('2026-10-04')).toBe(0)
    })

    it('6. addDaysDateOnly("2026-10-03", 1) === "2026-10-04"', () => {
      expect(addDaysDateOnly('2026-10-03', 1)).toBe('2026-10-04')
    })

    it('7. addDaysDateOnly("2026-12-31", 1) === "2027-01-01"', () => {
      expect(addDaysDateOnly('2026-12-31', 1)).toBe('2027-01-01')
    })

    it('parseDateOnly and formatDateOnly works across leap years and month ends', () => {
      expect(parseDateOnly('2024-02-28')).toEqual({ y: 2024, m: 2, d: 28 })
      expect(addDaysDateOnly('2024-02-28', 1)).toBe('2024-02-29')
      expect(addDaysDateOnly('2024-02-29', 1)).toBe('2024-03-01')
      expect(formatDateOnly(2026, 10, 3)).toBe('2026-10-03')
      expect(formatDateOnly(2026, 11, 0)).toBe('2026-10-31')
    })
  })
})
