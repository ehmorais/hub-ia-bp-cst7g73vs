import { isNightShift } from '@/components/escala/ShiftCalendarGrid'
import { isVacationDateInclusive } from '@/lib/escala-vacation'
import { formatCorenLabel, formatShiftCalendarSecondLine } from '@/lib/escala-calendar-formatter'

export type PeriodLetter = 'D' | 'N'

export type CalendarDayItemType =
  | 'shift_day' // a) escalados no plantão diurno (D)
  | 'off_day' // b) plantão diurno (D) de FOLGA naquele dia
  | 'vacation_day' // c) plantão diurno (D) de FÉRIAS naquele dia
  | 'shift_night' // d) escalados no plantão noturno (N)
  | 'off_night' // e) plantão noturno (N) de FOLGA
  | 'vacation_night' // f) plantão noturno (N) de FÉRIAS

export interface ClassifiedCalendarItem {
  id: string
  itemType: CalendarDayItemType
  groupOrder: 1 | 2 | 3 | 4 | 5 | 6 // a=1, b=2, c=3, d=4, e=5, f=6
  periodLetter: PeriodLetter
  staffId: string
  name: string
  professionalId?: string | null
  corenText: string
  secondLineText: string
  // Dados de plantão (se escalado)
  shift?: any
  timeRange?: string
  isShiftOnVacation?: boolean
  vacationPeriodText?: string
  // Dados de ausente (se folga ou férias)
  absenceType?: 'FOLGA' | 'FÉRIAS'
}

/**
 * Determina o plantão-base (D ou N) a partir do contrato e shift_type:
 * Noturno se:
 *  - start_time >= 18h ou cruza meia-noite (end_time < start_time)
 *  - OU nome/código contém: NOT, NOITE, NIGHT, 12X36N, SDN
 * Diurno se:
 *  - start_time 06–17h sem cruzar meia-noite
 *  - OU nome/código contém: DIU, DIA, DAY, MANHA, TARDE, 12X36D
 * Fallback seguro = D.
 */
export function resolveContractPeriodLetter(contract?: any): PeriodLetter {
  if (!contract) return 'D'

  const shiftType =
    contract.expand?.shift_type || contract.shift_type_expand || contract.shift_type_detail
  const rawStartTime = (shiftType?.start_time || contract.start_time || '').trim()
  const rawEndTime = (shiftType?.end_time || contract.end_time || '').trim()
  const nameOrCode = [
    shiftType?.name,
    shiftType?.code,
    contract.name,
    contract.shift_type_name,
    contract.shift_type_code,
  ]
    .filter(Boolean)
    .join(' ')
    .toUpperCase()

  // 1. Checa padrões explícitos nos nomes/códigos
  const isNightByName =
    /\b(NOT|NOITE|NIGHT|12X36N|SDN)\b/i.test(nameOrCode) ||
    nameOrCode.includes('12X36N') ||
    nameOrCode.includes('SDN') ||
    nameOrCode.includes('NOITE') ||
    nameOrCode.includes('NOTURNO') ||
    nameOrCode.includes('NIGHT')

  if (isNightByName) return 'N'

  const isDayByName =
    /\b(DIU|DIA|DAY|MANHA|MANHÃ|TARDE|12X36D)\b/i.test(nameOrCode) ||
    nameOrCode.includes('12X36D') ||
    nameOrCode.includes('DIURNO') ||
    nameOrCode.includes('MANHA') ||
    nameOrCode.includes('MANHÃ') ||
    nameOrCode.includes('TARDE')

  if (isDayByName) return 'D'

  // 2. Se houver horários, checa start_time e end_time
  if (rawStartTime) {
    const startHour = parseInt(rawStartTime.split(':')[0] || '0', 10)
    const crossesMidnight = !!rawEndTime && rawEndTime < rawStartTime
    if (startHour >= 18 || crossesMidnight) {
      return 'N'
    }
    if (startHour >= 6 && startHour <= 17 && !crossesMidnight) {
      return 'D'
    }
  }

  // 3. Fallback seguro = D
  return 'D'
}

/**
 * Determina o período D ou N de um colaborador:
 * Procura primeiro nos contratos vigentes pelo staff_profile ou user.
 * Se não achar ou fallback, retorna D.
 */
export function getBasePeriodLetterForStaff(staffId: string, contracts: any[] = []): PeriodLetter {
  const contract = contracts.find((c) => (c.staff_profile || c.user) === staffId)
  return resolveContractPeriodLetter(contract)
}

export interface BuildDayClassifiedItemsParams {
  dateKey: string // YYYY-MM-DD
  dayOfWeek: number // 0=Dom..6=Sáb
  dayShifts: any[] // Plantões já filtrados para a data e selectedStaffId
  contracts: any[]
  staffProfiles: any[]
  sectorStaffProfiles: Array<{ id: string; name: string; professional_id?: string | null }>
  weekendOffMap?: Map<string, Set<string>>
  selectedStaffId?: string
}

/**
 * Constrói a lista ordenada de colaboradores do dia em 6 grupos na sequência estrita:
 *  a) escalados no plantão diurno (D)   - groupOrder: 1
 *  b) plantão diurno (D) de FOLGA       - groupOrder: 2
 *  c) plantão diurno (D) de FÉRIAS      - groupOrder: 3
 *  d) escalados no plantão noturno (N)  - groupOrder: 4
 *  e) plantão noturno (N) de FOLGA      - groupOrder: 5
 *  f) plantão noturno (N) de FÉRIAS     - groupOrder: 6
 *
 * Cada grupo é ordenado em ordem alfabética pelo nome (localeCompare('pt-BR', { sensitivity: 'base' })).
 *
 * Precedência de classificação:
 * (1) Escalado no dia -> só grupo escalado (a ou d), nunca ausente;
 * (2) Férias ativas (vacation_enabled e start<=dateKey<=end) vence folga -> grupo de FÉRIAS (c ou f);
 * (3) Senão folga via weekendOffMap -> grupo de FOLGA (b ou e).
 * Sem duplicatas.
 */
export function buildClassifiedDayItems(
  params: BuildDayClassifiedItemsParams,
): ClassifiedCalendarItem[] {
  const {
    dateKey,
    dayOfWeek,
    dayShifts,
    contracts,
    staffProfiles,
    sectorStaffProfiles,
    weekendOffMap = new Map(),
    selectedStaffId,
  } = params

  const isWeekendDay = dayOfWeek === 6 || dayOfWeek === 0

  // 1. Processar ESCALADOS no dia
  const workedStaffIds = new Set<string>()
  const groupA: ClassifiedCalendarItem[] = [] // escalados D
  const groupD: ClassifiedCalendarItem[] = [] // escalados N

  dayShifts.forEach((s) => {
    const profileId = s.staff_profile || s.user_id || s.user
    if (!profileId) return
    workedStaffIds.add(profileId)

    const contract = contracts.find((item) => (item.staff_profile || item.user) === profileId)
    const shiftType = contract?.expand?.shift_type
    const matchedProfile = staffProfiles.find((sp) => sp.id === profileId)
    const name =
      s.expand?.staff_profile?.name ||
      s.expand?.user?.name ||
      matchedProfile?.name ||
      s.name ||
      'Sem nome'

    const professionalId =
      s.expand?.staff_profile?.professional_id ??
      matchedProfile?.professional_id ??
      s.professional_id ??
      null

    const startTime = (String(s.start_time || '').split(/[ T]/)[1] || '').substring(0, 5)
    const endTime = (String(s.end_time || '').split(/[ T]/)[1] || '').substring(0, 5)

    const isNight = isNightShift(shiftType?.start_time, shiftType?.end_time, startTime, endTime)
    const periodLetter: PeriodLetter = isNight ? 'N' : 'D'
    const corenText = formatCorenLabel(professionalId)
    const secondLineText = formatShiftCalendarSecondLine(periodLetter, professionalId)
    const isShiftOnVacation = isVacationDateInclusive(matchedProfile, dateKey)
    const vacationPeriodText =
      matchedProfile?.vacation_start && matchedProfile?.vacation_end ? `Férias` : undefined
    const timeRange = startTime && endTime ? `${startTime}–${endTime}` : undefined

    const item: ClassifiedCalendarItem = {
      id: s.id,
      itemType: periodLetter === 'D' ? 'shift_day' : 'shift_night',
      groupOrder: periodLetter === 'D' ? 1 : 4,
      periodLetter,
      staffId: profileId,
      name,
      professionalId,
      corenText,
      secondLineText,
      shift: s,
      timeRange,
      isShiftOnVacation,
      vacationPeriodText,
    }

    if (periodLetter === 'D') {
      groupA.push(item)
    } else {
      groupD.push(item)
    }
  })

  // 2. Processar AUSENTES (Férias e Folga)
  // Precedência:
  // (1) Se já trabalhou no dia, NUNCA ausente (já está em workedStaffIds);
  // (2) Férias ativas (vacation_enabled === true e vacation_start <= dateKey <= vacation_end inclusivo) vence folga -> classifique só como FÉRIAS;
  // (3) Senão folga via weekendOffMap.
  const groupB: ClassifiedCalendarItem[] = [] // D FOLGA
  const groupC: ClassifiedCalendarItem[] = [] // D FÉRIAS
  const groupE: ClassifiedCalendarItem[] = [] // N FOLGA
  const groupF: ClassifiedCalendarItem[] = [] // N FÉRIAS

  sectorStaffProfiles.forEach((staff) => {
    if (selectedStaffId && staff.id !== selectedStaffId) return
    // (1) se escalado no dia, nunca ausente
    if (workedStaffIds.has(staff.id)) return

    const fullProfile = staffProfiles.find((sp) => sp.id === staff.id)
    const basePeriod = getBasePeriodLetterForStaff(staff.id, contracts)
    const professionalId = fullProfile?.professional_id ?? staff.professional_id ?? null
    const corenText = formatCorenLabel(professionalId)
    const secondLineText = formatShiftCalendarSecondLine(basePeriod, professionalId)

    // (2) Férias ativas vencem folga
    const hasActiveVacation = isVacationDateInclusive(fullProfile, dateKey)
    if (hasActiveVacation) {
      const vacItem: ClassifiedCalendarItem = {
        id: `vacation-${staff.id}-${dateKey}`,
        itemType: basePeriod === 'D' ? 'vacation_day' : 'vacation_night',
        groupOrder: basePeriod === 'D' ? 3 : 6,
        periodLetter: basePeriod,
        staffId: staff.id,
        name: staff.name,
        professionalId,
        corenText,
        secondLineText,
        absenceType: 'FÉRIAS',
      }
      if (basePeriod === 'D') {
        groupC.push(vacItem)
      } else {
        groupF.push(vacItem)
      }
      return // vence folga, não duplica
    }

    // (3) Folga via weekendOffMap
    // Nota: weekendOffMap mapeia folgas de fim de semana para datas de sábado ou domingo
    const offDates = weekendOffMap.get(staff.id)
    const hasOff = Boolean(offDates && offDates.has(dateKey))
    // A folga também pode ser restrita a isWeekendDay se aplicável pela regra de folga FDS
    if (hasOff && isWeekendDay) {
      const offItem: ClassifiedCalendarItem = {
        id: `off-${staff.id}-${dateKey}`,
        itemType: basePeriod === 'D' ? 'off_day' : 'off_night',
        groupOrder: basePeriod === 'D' ? 2 : 5,
        periodLetter: basePeriod,
        staffId: staff.id,
        name: staff.name,
        professionalId,
        corenText,
        secondLineText,
        absenceType: 'FOLGA',
      }
      if (basePeriod === 'D') {
        groupB.push(offItem)
      } else {
        groupE.push(offItem)
      }
    }
  })

  // 3. Ordenação alfabética em cada grupo pelo nome (localeCompare pt-BR, sensitivity base)
  const sortByName = (a: ClassifiedCalendarItem, b: ClassifiedCalendarItem) =>
    a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })

  groupA.sort(sortByName)
  groupB.sort(sortByName)
  groupC.sort(sortByName)
  groupD.sort(sortByName)
  groupE.sort(sortByName)
  groupF.sort(sortByName)

  // 4. Retorna a sequência exata a, b, c, d, e, f
  return [...groupA, ...groupB, ...groupC, ...groupD, ...groupE, ...groupF]
}
