import { describe, it, expect } from 'vitest'

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
  let cur = new Date(cStart + 'T00:00:00Z')
  cur = new Date(cur.getTime() + offset * 86400000)
  const end = new Date(cEnd + 'T00:00:00Z')
  while (cur <= end) {
    map[cur.toISOString().split('T')[0]] = true
    cur = new Date(cur.getTime() + stepDays * 86400000)
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
      let offsetCursor = new Date(cStart + 'T00:00:00Z')
      offsetCursor = new Date(offsetCursor.getTime() + offset * 86400000)
      while (offsetCursor <= new Date(cEnd + 'T00:00:00Z') && dates.length < maxShifts) {
        const offsetDate = offsetCursor.toISOString().split('T')[0]
        dates.push(offsetDate)
        offsetCursor = new Date(offsetCursor.getTime() + stepDays * 86400000)
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
  let mCur = new Date(cStart + 'T00:00:00Z')
  const mEnd = new Date(cEnd + 'T00:00:00Z')
  while (mCur <= mEnd) {
    const mKey = mCur.getUTCFullYear() + '-' + String(mCur.getUTCMonth() + 1).padStart(2, '0')
    months[mKey] = true
    mCur = new Date(mCur.getTime() + 86400000)
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
    let curDate = new Date(cStart + 'T00:00:00Z')
    const endDate = new Date(cEnd + 'T00:00:00Z')
    while (curDate <= endDate) {
      const dayStr = curDate.toISOString().split('T')[0]
      if ((dCounts[dayStr] || 0) < minStaff) {
        return false
      }
      curDate = new Date(curDate.getTime() + 86400000)
    }
    return true
  }

  const assignments: Record<string, string[]> = {}
  const protectedDates: Record<string, boolean> = {}
  const protectedWeekends: Record<string, Record<string, boolean>> = {}
  const issues: string[] = []

  staffList.forEach((u, staffIndex) => {
    const is12x36 = u.work_hours === 12 && u.rest_hours >= 36
    const uNatSet = naturalWorkedMap[u.id] || {}
    const userPairs: string[] = []

    Object.keys(months).forEach((mKey) => {
      const parts = mKey.split('-')
      const y = Number(parts[0])
      const m = Number(parts[1])
      let dCur = new Date(Date.UTC(y, m - 1, 1))
      let dLast = new Date(Date.UTC(y, m, 0))
      const cStartDate = new Date(cStart + 'T00:00:00Z')
      const cEndDate = new Date(cEnd + 'T00:00:00Z')
      if (dCur < cStartDate) dCur = new Date(cStartDate)
      if (dLast > cEndDate) dLast = new Date(cEndDate)

      const allMonthWeekends: Array<{
        sat: string
        sun: string
        satWorked: boolean
        sunWorked: boolean
        sunIsNat: boolean
      }> = []

      while (dCur <= dLast) {
        if (dCur.getUTCDay() === 6) {
          const satStr = dCur.toISOString().split('T')[0]
          const sunDate = new Date(dCur.getTime() + 86400000)
          const sunStr = sunDate.toISOString().split('T')[0]
          if (sunDate <= cEndDate && sunDate >= cStartDate) {
            const satWorked = !!shiftsByStaff[u.id][satStr]
            const sunWorked = !!shiftsByStaff[u.id][sunStr]
            const sunIsNat = is12x36 ? !!uNatSet[sunStr] : true
            allMonthWeekends.push({
              sat: satStr,
              sun: sunStr,
              satWorked,
              sunWorked,
              sunIsNat,
            })
          }
        }
        dCur = new Date(dCur.getTime() + 86400000)
      }

      if (allMonthWeekends.length === 0) {
        issues.push(`Sem fim de semana para ${u.name} em ${mKey}`)
        return
      }

      let natCandidates = allMonthWeekends.filter((w) => w.sunIsNat)
      if (natCandidates.length === 0) {
        natCandidates = allMonthWeekends.slice()
      }

      const revCandidates = natCandidates.slice().reverse()
      const offset = staffIndex % revCandidates.length
      const orderedCandidates: typeof natCandidates = []
      for (let oi = 0; oi < revCandidates.length; oi++) {
        orderedCandidates.push(revCandidates[(offset + oi) % revCandidates.length])
      }

      let committedWeekend: (typeof natCandidates)[0] | null = null

      for (let ci = 0; ci < orderedCandidates.length; ci++) {
        const candidate = orderedCandidates[ci]
        const satStr = candidate.sat
        const sunStr = candidate.sun

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
              !protectedDates[cand.id + ':' + dt] &&
              !(protectedWeekends[cand.id] && protectedWeekends[cand.id][dt])
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
        if (!protectedWeekends[u.id]) protectedWeekends[u.id] = {}
        protectedWeekends[u.id][committedWeekend.sat] = true
        protectedWeekends[u.id][committedWeekend.sun] = true
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
})
