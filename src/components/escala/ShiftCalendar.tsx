import { useState, useMemo, useEffect } from 'react'
import {
  format,
  addDays,
  addWeeks,
  addMonths,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  startOfMonth,
  endOfMonth,
  parseISO,
  isWithinInterval,
  differenceInCalendarDays,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/components/ui/use-toast'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import {
  assertWeekendPair,
  formatLocalDateKeySafe,
  parseDateOnly,
  addDaysDateOnly,
  dayOfWeekDateOnly,
  buildWeekendOffMap,
} from '@/lib/escala-weekend-off'
import { StaffFilter } from './StaffFilter'
import { formatCorenLabel, formatShiftCalendarSecondLine } from '@/lib/escala-calendar-formatter'

type ViewMode = 'cycle' | 'month' | 'week' | 'day'

/**
 * Classifica um plantão como diurno (D) ou noturno (N).
 *
 * Prefere os horários estruturados do tipo de turno
 * (shift_type.start_time / end_time) quando disponíveis, caindo para os
 * horários reais do plantão apenas quando o tipo não os definir. Um plantão
 * é noturno se iniciar às 18:00 ou depois, ou se cruzar a meia-noite
 * (horário de fim anterior ao de início).
 */
function isNightShift(
  typeStart?: string,
  typeEnd?: string,
  actualStart = '',
  actualEnd = '',
): boolean {
  const start = (typeStart || actualStart || '').trim()
  const end = (typeEnd || actualEnd || '').trim()
  if (!start && !end) return false
  const startHour = parseInt(start.split(':')[0] || '0', 10)
  const crossesMidnight = !!start && !!end && end < start
  return startHour >= 18 || crossesMidnight
}

export function ShiftCalendar({
  shifts,
  validationShifts,
  cycle,
  contracts,
  staffProfiles = [],
  draft,
  onShiftUpdate,
}: {
  shifts: any[]
  validationShifts?: any[]
  cycle: any
  contracts: any[]
  staffProfiles?: Array<{ id: string; name: string; default_sector?: string; [key: string]: any }>
  draft?: any
  onShiftUpdate?: (updatedShift: any) => void
}) {
  const [view, setView] = useState<ViewMode>('cycle')
  const [movedShiftIds, setMovedShiftIds] = useState<Set<string>>(() => new Set())
  // Parse ciclo em data local segura (ano, mês, dia) sem offset UTC
  const cycleStartDateStr = cycle ? (cycle.start_date || '').split(' ')[0].split('T')[0] : ''
  const cycleEndDateStr = cycle ? (cycle.end_date || '').split(' ')[0].split('T')[0] : ''

  const cycleStart = useMemo(() => {
    if (!cycleStartDateStr) return new Date()
    const { y, m, d } = parseDateOnly(cycleStartDateStr)
    return new Date(y, m - 1, d)
  }, [cycleStartDateStr])

  const cycleEnd = useMemo(() => {
    if (!cycleEndDateStr) return new Date()
    const { y, m, d } = parseDateOnly(cycleEndDateStr)
    return new Date(y, m - 1, d)
  }, [cycleEndDateStr])

  const cycleInterval = useMemo(
    () => ({ start: cycleStart, end: cycleEnd }),
    [cycleStart, cycleEnd],
  )

  const [currentDate, setCurrentDate] = useState(cycleStart)
  const [sectors, setSectors] = useState<any[]>([])
  const [selectedSectorId, setSelectedSectorId] = useState<string>('')
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const { toast } = useToast()
  const [shiftRules, setShiftRules] = useState<any[]>([])

  const loadRules = () => {
    pb.collection('shift_rules').getFullList().then(setShiftRules).catch(console.error)
  }

  useEffect(() => {
    loadRules()
  }, [])

  useRealtime('shift_rules', loadRules)

  useEffect(() => {
    if (sectors.length === 0) return
    // A newly generated draft may belong to a different sector than the
    // previous one. Always follow the sector present in the current records.
    const shiftSector = shifts[0]?.sector || shifts[0]?.expand?.sector?.id || ''
    const match = shiftSector ? sectors.find((s) => s.id === shiftSector) : null
    const nextSectorId = match ? match.id : selectedSectorId || sectors[0].id
    if (nextSectorId !== selectedSectorId) setSelectedSectorId(nextSectorId)
  }, [sectors, selectedSectorId, shifts])

  const visibleShifts = useMemo(() => {
    if (!selectedSectorId) return []
    return shifts.filter(
      (s) => s.sector === selectedSectorId || s.expand?.sector?.id === selectedSectorId,
    )
  }, [shifts, selectedSectorId])

  // Identifica os colaboradores elegíveis para o setor selecionado (seja por default_sector ou que aparecem nos shifts)
  const sectorStaffProfiles = useMemo(() => {
    if (!selectedSectorId) return []
    const map = new Map<string, { id: string; name: string }>()

    // 1. Staff profiles cadastrados com default_sector igual ao selecionado
    staffProfiles.forEach((sp) => {
      if (sp.default_sector === selectedSectorId || !selectedSectorId) {
        map.set(sp.id, { id: sp.id, name: sp.name || 'Sem nome' })
      }
    })

    // 2. Staff profiles que aparecem nos shifts visíveis do setor
    visibleShifts.forEach((s) => {
      const pid = s.staff_profile || s.user_id || s.user
      if (pid && !map.has(pid)) {
        const name =
          s.expand?.staff_profile?.name ||
          s.expand?.user?.name ||
          s.name ||
          staffProfiles.find((sp) => sp.id === pid)?.name ||
          'Sem nome'
        map.set(pid, { id: pid, name })
      }
    })

    return Array.from(map.values())
  }, [staffProfiles, selectedSectorId, visibleShifts])

  // Computa o mapa de fins de semana de folga (staffId -> Set<dateStr>) exclusivamente de draft.validation_summary.weekend_off_assignments
  const weekendOffMap = useMemo(() => {
    return buildWeekendOffMap(draft?.validation_summary)
  }, [draft])

  const hasWeekendOffMetadata = useMemo(() => {
    return weekendOffMap.size > 0
  }, [weekendOffMap])

  // A shift-type selection filters only what is rendered. Staffing, rest and
  // hour validations must continue to consider the complete schedule.
  const validationVisibleShifts = useMemo(() => {
    if (!selectedSectorId) return []
    return (validationShifts || shifts).filter(
      (s) => s.sector === selectedSectorId || s.expand?.sector?.id === selectedSectorId,
    )
  }, [selectedSectorId, shifts, validationShifts])

  // Estrutura robusta para os dias da grade com date, key (YYYY-MM-DD) e dayOfWeek (0=Dom, 6=Sáb)
  interface CalendarDayItem {
    date: Date
    key: string
    dayOfWeek: number
  }

  const days = useMemo<CalendarDayItem[]>(() => {
    let rawDates: Date[] = []
    if (view === 'cycle') {
      if (cycleStartDateStr && cycleEndDateStr && cycleStartDateStr <= cycleEndDateStr) {
        let curStr = cycleStartDateStr
        const items: CalendarDayItem[] = []
        while (curStr <= cycleEndDateStr) {
          const { y, m, d } = parseDateOnly(curStr)
          const localDate = new Date(y, m - 1, d)
          items.push({
            date: localDate,
            key: curStr,
            dayOfWeek: dayOfWeekDateOnly(curStr),
          })
          curStr = addDaysDateOnly(curStr, 1)
        }
        return items
      }
      rawDates = eachDayOfInterval(cycleInterval)
    } else if (view === 'day') {
      rawDates = [currentDate]
    } else if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 }) // Sunday
      const end = endOfWeek(currentDate, { weekStartsOn: 0 })
      rawDates = eachDayOfInterval({ start, end })
    } else {
      const start = startOfMonth(currentDate)
      const end = endOfMonth(currentDate)
      rawDates = eachDayOfInterval({ start, end })
    }

    return rawDates.map((d) => {
      const key = formatLocalDateKeySafe(d)
      return {
        date: d,
        key,
        dayOfWeek: dayOfWeekDateOnly(key),
      }
    })
  }, [currentDate, view, cycleStartDateStr, cycleEndDateStr, cycleInterval])

  const alerts = useMemo(() => {
    const newAlerts: { type: 'error' | 'warning' | 'info'; message: string; date?: Date }[] = []

    if (!selectedSectorId) return newAlerts
    const sector = sectors.find((s) => s.id === selectedSectorId)
    if (!sector) return newAlerts

    const sectorRules = shiftRules.filter((r) => r.department === sector.department)

    // --- Coverage validation guards ---
    // Only validate days INSIDE the current cycle. Days outside the cycle have
    // nothing to validate (no draft/published schedule covers them).
    if (cycle) {
      days.forEach((dayItem) => {
        const day = dayItem.date
        if (!isWithinInterval(day, cycleInterval)) return // outside the cycle

        const dayShifts = validationVisibleShifts.filter((s) => {
          const sDateStr = s.start_time ? s.start_time.split(' ')[0].split('T')[0] : ''
          return sDateStr === dayItem.key
        })
        const count = dayShifts.length

        // The cycle has an active draft or published schedule (there are
        // visible shifts somewhere in this sector). When the cycle has NO
        // content at all, we never raise a coverage alert — there is nothing
        // to validate. We detect "no content" by checking the full shifts list
        // (the calendar can be rendered with an empty draft).
        if (validationVisibleShifts.length === 0) {
          // No shifts for this sector in the selected cycle: nothing to
          // validate. Surface an informational note instead of a hard
          // "below minimum" violation.
          if (count === 0) {
            newAlerts.push({
              type: 'info',
              message: `Dia ${format(day, 'dd/MM')}: Sem plantonistas (sem rascunho ativo para este ciclo/setor).`,
              date: day,
            })
          }
          return
        }

        // Below the hard minimum (hospital_sectors.min_staffing). This is the
        // single source of truth for the minimum — shift_rules.min_staff is no
        // longer mixed in here, so UTI ADULTO reports 0/4, not 0/5.
        if (sector.min_staffing > 0 && count < sector.min_staffing) {
          newAlerts.push({
            type: 'error',
            message: `Dia ${format(day, 'dd/MM')}: Efetivo abaixo do mínimo (${count}/${sector.min_staffing})`,
            date: day,
          })
        } else if (sector.ideal_staffing > 0 && count < sector.ideal_staffing) {
          newAlerts.push({
            type: 'warning',
            message: `Dia ${format(day, 'dd/MM')}: Efetivo abaixo do ideal (${count}/${sector.ideal_staffing})`,
            date: day,
          })
        }
      })
    }

    // Compute user specific alerts (rest hours, overlaps) for users in this sector
    const usersInSector = Array.from(
      new Set(validationVisibleShifts.map((shift) => shift.staff_profile || shift.user)),
    ).filter(Boolean)

    usersInSector.forEach((profileId) => {
      const userShifts = (validationShifts || shifts)
        .filter((shift) => (shift.staff_profile || shift.user) === profileId)
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
      const contract = contracts.find((item) => (item.staff_profile || item.user) === profileId)
      const baseRestHours = contract?.expand?.shift_type?.rest_hours || 11
      const minRestRule = sectorRules.find((r) => r.rule_type === 'min_rest_hours')
      const restHours = minRestRule ? minRestRule.value : baseRestHours

      // The cycle spans roughly one month, so the authoritative hours cap is
      // the collaborator's contract. A department rule such as 44h/week must
      // never be compared with the full-cycle total.
      const contractHoursLimit = Number(contract?.monthly_hour_limit || 0)
      const maxConsecutiveRule = sectorRules.find((r) => r.rule_type === 'max_consecutive')

      const userName =
        userShifts[0]?.expand?.staff_profile?.name ||
        userShifts[0]?.expand?.user?.name ||
        'Colaborador'

      let consecutiveDays = 0
      let previousShiftDate: Date | null = null
      let totalHoursInPeriod = 0

      for (let i = 0; i < userShifts.length; i++) {
        const currentShift = userShifts[i]
        const currentStart = new Date(currentShift.start_time)
        const currentEnd = new Date(currentShift.end_time)
        const shiftDuration = (currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60)

        totalHoursInPeriod += shiftDuration

        if (previousShiftDate && isSameDay(currentStart, addDays(previousShiftDate, 1))) {
          consecutiveDays++
        } else if (previousShiftDate && !isSameDay(currentStart, previousShiftDate)) {
          consecutiveDays = 1
        } else if (!previousShiftDate) {
          consecutiveDays = 1
        }
        previousShiftDate = currentStart

        if (maxConsecutiveRule && consecutiveDays > maxConsecutiveRule.value) {
          const involvesSelectedSector = currentShift.sector === selectedSectorId
          if (
            involvesSelectedSector &&
            !newAlerts.some((a) => a.message.includes(`${userName}: Excedeu dias consecutivos`))
          ) {
            newAlerts.push({
              type: 'error',
              message: `${userName}: Excedeu dias consecutivos (${consecutiveDays} > ${maxConsecutiveRule.value})`,
            })
          }
        }

        if (i < userShifts.length - 1) {
          const nextShift = userShifts[i + 1]
          const involvesSelectedSector =
            currentShift.sector === selectedSectorId || nextShift.sector === selectedSectorId
          if (!involvesSelectedSector) continue

          const nextStart = new Date(nextShift.start_time)

          if (nextStart < currentEnd) {
            newAlerts.push({
              type: 'error',
              message: `${userName}: Conflito de horários no dia ${format(currentEnd, 'dd/MM')}`,
            })
          } else {
            const gap = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60 * 60)
            if (gap < restHours) {
              newAlerts.push({
                type: 'warning',
                message: `${userName}: Descanso de ${Math.floor(gap)}h (mínimo ${restHours}h) entre ${format(currentEnd, 'dd/MM')} e ${format(nextStart, 'dd/MM')}`,
              })
            }
          }
        }
      }

      if (contractHoursLimit > 0 && totalHoursInPeriod > contractHoursLimit) {
        newAlerts.push({
          type: 'warning',
          message: `${userName}: Total de horas excede o limite contratual mensal (${Math.floor(totalHoursInPeriod)}h > ${contractHoursLimit}h)`,
        })
      }
    })

    return newAlerts
  }, [
    validationVisibleShifts,
    visibleShifts,
    validationShifts,
    shifts,
    days,
    sectors,
    selectedSectorId,
    contracts,
    shiftRules,
    cycle,
    cycleInterval,
  ])

  useEffect(() => {
    pb.collection('hospital_sectors').getFullList().then(setSectors).catch(console.error)
  }, [])

  const next = () => {
    if (view === 'day') setCurrentDate(addDays(currentDate, 1))
    if (view === 'week') setCurrentDate(addWeeks(currentDate, 1))
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1))
  }

  const prev = () => {
    if (view === 'day') setCurrentDate(addDays(currentDate, -1))
    if (view === 'week') setCurrentDate(addWeeks(currentDate, -1))
    if (view === 'month') setCurrentDate(addMonths(currentDate, -1))
  }

  const getShiftsForDay = (dayKey: string) => {
    return visibleShifts
      .filter((s) => {
        const sDateStr = s.start_time ? s.start_time.split(' ')[0].split('T')[0] : ''
        if (sDateStr !== dayKey) return false
        if (selectedStaffId) {
          const pid = s.staff_profile || s.user_id || s.user
          if (pid !== selectedStaffId) return false
        }
        return true
      })
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }

  const handleDragStart = (e: React.DragEvent, shift: any) => {
    e.dataTransfer.setData('application/json', JSON.stringify(shift))
  }

  const handleDrop = async (e: React.DragEvent, targetDay: Date) => {
    e.preventDefault()
    const shiftData = e.dataTransfer.getData('application/json')
    if (!shiftData) return
    const shift = JSON.parse(shiftData)

    const newStart = new Date(shift.start_time)
    const newEnd = new Date(shift.end_time)

    // adjust dates to targetDay
    // Compare calendar dates in the same local-date domain. Parsing the
    // original YYYY-MM-DD with Date() treated it as UTC and made backward
    // moves resolve to zero/incorrect offsets in negative time zones.
    const originalDay = parseISO(shift.start_time.split(' ')[0])
    const diffDays = differenceInCalendarDays(targetDay, originalDay)
    newStart.setDate(newStart.getDate() + diffDays)
    newEnd.setDate(newEnd.getDate() + diffDays)

    const updatedShift = {
      ...shift,
      start_time: format(newStart, "yyyy-MM-dd HH:mm:ss.SSS'Z'"),
      end_time: format(newEnd, "yyyy-MM-dd HH:mm:ss.SSS'Z'"),
    }

    // Check rest rules (Validation)
    const collaboratorId = shift.staff_profile || shift.user
    const userShifts = shifts.filter(
      (item) => (item.staff_profile || item.user) === collaboratorId && item.id !== shift.id,
    )
    let warning = ''
    const contract = contracts.find((item) => (item.staff_profile || item.user) === collaboratorId)
    const restHours = contract?.expand?.shift_type?.rest_hours || 11

    for (const us of userShifts) {
      const usEnd = new Date(us.end_time)
      const usStart = new Date(us.start_time)

      if (newStart >= usEnd) {
        const gap = (newStart.getTime() - usEnd.getTime()) / (1000 * 60 * 60)
        if (gap < restHours)
          warning = `Aviso de Regra: Descanso entre plantões menor que ${restHours}h.`
      } else if (usStart >= newEnd) {
        const gap = (usStart.getTime() - newEnd.getTime()) / (1000 * 60 * 60)
        if (gap < restHours)
          warning = `Aviso de Regra: Descanso entre plantões menor que ${restHours}h.`
      } else {
        warning = `Aviso de Regra: Conflito de horários com outro plantão existente.`
      }
    }

    if (warning) {
      toast({ title: 'Aviso de Validação', description: warning })
    }

    try {
      const savedShift = await pb.collection('shifts').update(shift.id, {
        start_time: updatedShift.start_time,
        end_time: updatedShift.end_time,
      })
      const synchronizedShift = {
        ...shift,
        ...savedShift,
        expand: shift.expand,
      }
      setMovedShiftIds((current) => {
        const next = new Set(current)
        next.add(shift.id)
        return next
      })
      onShiftUpdate?.(synchronizedShift)
      toast({ title: 'Plantão atualizado', description: 'O plantão foi movido com sucesso.' })
    } catch (err) {
      toast({ title: 'Erro', description: 'Falha ao mover o plantão', variant: 'destructive' })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col h-[700px] border rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between p-4 border-b gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold w-[220px] text-center capitalize text-slate-700">
              {view === 'cycle' &&
                `${format(cycleStart, 'dd/MM/yyyy')} a ${format(cycleEnd, 'dd/MM/yyyy')}`}
              {view === 'day' && format(currentDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
              {view === 'week' &&
                days.length > 0 &&
                `${format(days[0].date, 'dd/MM')} a ${format(days[days.length - 1].date, 'dd/MM')}`}{' '}
              {view === 'month' && format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" onClick={next}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StaffFilter
              staffList={sectorStaffProfiles}
              selectedStaffId={selectedStaffId}
              onSelectedStaffChange={setSelectedStaffId}
            />

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700 select-none">Setor</span>
              <Select value={selectedSectorId} onValueChange={setSelectedSectorId}>
                <SelectTrigger className="w-[180px] bg-white h-9">
                  <SelectValue placeholder="Selecione o Setor" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700 select-none">Visualização</span>
              <Select value={view} onValueChange={(v: ViewMode) => setView(v)}>
                <SelectTrigger className="w-[120px] bg-white h-9">
                  <CalendarIcon className="w-4 h-4 mr-2 text-slate-500" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cycle">Ciclo completo</SelectItem>
                  <SelectItem value="month">Mês</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="day">Dia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {draft && !hasWeekendOffMetadata && (
          <div className="px-4 pt-3 pb-0">
            <Alert className="border-amber-300 bg-amber-50/60 text-amber-900 py-2">
              <AlertDescription className="text-xs">
                Rascunho anterior à regra de folga de fim de semana. Gere novamente para aplicar e
                exibir o destaque.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <ScrollArea className="flex-1 bg-slate-50/30">
          {(view === 'month' || view === 'cycle') && (
            <div className="grid grid-cols-7 border-b sticky top-0 bg-slate-100 z-10">
              {(() => {
                const baseWeekLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
                const firstDayDow = days.length > 0 ? days[0].dayOfWeek : 0
                const rotatedLabels = [
                  ...baseWeekLabels.slice(firstDayDow),
                  ...baseWeekLabels.slice(0, firstDayDow),
                ]
                return rotatedLabels.map((d, idx) => (
                  <div
                    key={`${d}-${idx}`}
                    className="p-2 text-center text-xs font-semibold text-slate-500 border-r last:border-r-0"
                  >
                    {d}
                  </div>
                ))
              })()}
            </div>
          )}

          <div
            className={cn(
              'grid',
              view === 'month' && 'grid-cols-7 auto-rows-[240px]',
              view === 'cycle' && 'grid-cols-7 auto-rows-[minmax(240px,auto)]',
              view === 'week' && 'grid-cols-7 min-h-full',
              view === 'day' && 'grid-cols-1 min-h-full',
            )}
          >
            {days.map((dayItem, i) => {
              const day = dayItem.date
              const dateKey = dayItem.key
              const dayShifts = getShiftsForDay(dateKey)
              const inCycle = cycle ? isWithinInterval(day, cycleInterval) : true
              // Garante que é sábado (6) ou domingo (0)
              const isWeekendDay = dayItem.dayOfWeek === 6 || dayItem.dayOfWeek === 0

              return (
                <div
                  key={i}
                  onDrop={(e) => handleDrop(e, day)}
                  onDragOver={handleDragOver}
                  className={cn(
                    'border-r border-b p-2 flex flex-col gap-1 transition-colors',
                    view === 'cycle' ? 'overflow-visible' : 'overflow-hidden',
                    !inCycle ? 'bg-slate-100/50 opacity-50' : 'hover:bg-slate-50/80',
                  )}
                >
                  <div
                    className={cn(
                      'text-sm font-medium mb-1 flex flex-col gap-1',
                      isSameDay(day, new Date()) ? 'text-primary font-bold' : 'text-slate-700',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        {format(
                          day,
                          view === 'month' || view === 'cycle' ? 'dd/MM' : 'dd/MM (EEEE)',
                          { locale: ptBR },
                        )}
                      </span>
                      {dayShifts.length > 0 && (view === 'month' || view === 'cycle') && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">
                          {dayShifts.length}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div
                    className={cn(
                      'flex-1 space-y-1.5 pr-1',
                      view === 'cycle'
                        ? 'overflow-visible'
                        : view === 'month'
                          ? 'overflow-y-auto scrollbar-thin'
                          : 'overflow-y-auto',
                    )}
                  >
                    {dayShifts.map((s) => {
                      const contract = contracts.find(
                        (item) => (item.staff_profile || item.user) === (s.staff_profile || s.user),
                      )
                      const shiftType = contract?.expand?.shift_type
                      const profileId = s.staff_profile || s.user_id || s.user
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
                      const startTime = (
                        String(s.start_time || '').split(/[ T]/)[1] || ''
                      ).substring(0, 5)
                      const endTime = (String(s.end_time || '').split(/[ T]/)[1] || '').substring(
                        0,
                        5,
                      )
                      const isNight = isNightShift(
                        shiftType?.start_time,
                        shiftType?.end_time,
                        startTime,
                        endTime,
                      )
                      const periodLetter: 'D' | 'N' = isNight ? 'N' : 'D'
                      const corenText = formatCorenLabel(professionalId)
                      const secondLineText = formatShiftCalendarSecondLine(periodLetter, professionalId)
                      return (
                        <div
                          key={s.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, s)}
                          className={cn(
                            'text-xs p-2 rounded bg-white border shadow-sm flex flex-col gap-1 transition-colors cursor-move active:cursor-grabbing min-h-max',
                            movedShiftIds.has(s.id)
                              ? 'border-orange-500 hover:border-orange-600'
                              : 'border-slate-200 hover:border-primary/50',
                          )}
                        >
                          {/* 1. Primeira linha: nome COMPLETO do colaborador, sem ellipsis/truncamento, sem corte */}
                          <div
                            className="font-semibold text-slate-800 break-words whitespace-normal leading-snug"
                            title={name}
                          >
                            {name}
                          </div>
                          {/* 2. Segunda linha: tipo de plantão somente "D" ou "N", seguido do número do COREN no lugar do horário */}
                          <div
                            className="flex items-center gap-1.5 text-slate-600 text-[11px] min-w-0 break-words whitespace-normal leading-tight font-medium"
                            title={secondLineText}
                          >
                            <span
                              className={cn(
                                'font-bold shrink-0 text-xs',
                                isNight ? 'text-indigo-700' : 'text-emerald-700',
                              )}
                            >
                              {periodLetter}
                            </span>
                            <span className="text-slate-400 select-none">•</span>
                            <span className={cn('break-words', !professionalId ? 'text-slate-400 italic' : 'text-slate-700')}>
                              {corenText}
                            </span>
                          </div>
                        </div>
                      )
                    })}

                    {/* Placeholders de Fim de Semana de Folga Mensal (WEEKEND_OFF) */}
                    {(() => {
                      // NUNCA renderizar em dias que não sejam sábado ou domingo
                      if (!isWeekendDay) return null

                      // Se houver filtro de colaborador ativo, consideramos apenas os plantões do próprio colaborador
                      // para não ocultar a folga se outro colaborador trabalhou
                      const allVisibleDayShifts = visibleShifts.filter((s) => {
                        const sDateStr = s.start_time
                          ? s.start_time.split(' ')[0].split('T')[0]
                          : ''
                        return sDateStr === dateKey
                      })
                      const workedStaffIds = new Set(
                        allVisibleDayShifts.map((s) => s.staff_profile || s.user_id || s.user),
                      )

                      const weekendOffPlaceholders = sectorStaffProfiles.filter((staff) => {
                        if (selectedStaffId && staff.id !== selectedStaffId) return false
                        // Não renderiza se a célula tem shifts (a folga não é real ou há conflito)
                        if (workedStaffIds.has(staff.id)) return false
                        const offDates = weekendOffMap.get(staff.id)
                        return offDates && offDates.has(dateKey)
                      })

                      return weekendOffPlaceholders.map((staff) => (
                        <div
                          key={`weekend-off-${staff.id}-${dateKey}`}
                          data-testid={`weekend-off-${staff.id}-${dateKey}`}
                          title="Fim de semana de folga mensal"
                          className="bg-orange-100 border border-orange-300 rounded px-1.5 py-1 text-xs shadow-sm flex flex-col gap-0.5 transition-colors select-none min-h-max"
                        >
                          <div className="font-semibold text-slate-900 break-words whitespace-normal leading-snug" title={staff.name}>
                            {staff.name}
                          </div>
                          <div className="text-orange-800 text-[10px] leading-tight">
                            Folga Fim de Semana
                          </div>
                        </div>
                      ))
                    })()}

                    {dayShifts.length === 0 &&
                      !sectorStaffProfiles.some((staff) => {
                        if (selectedStaffId && staff.id !== selectedStaffId) return false
                        if (!isWeekendDay) return false
                        const offDates = weekendOffMap.get(staff.id)
                        return offDates && offDates.has(dateKey)
                      }) &&
                      view !== 'month' &&
                      view !== 'cycle' && (
                        <div className="text-xs text-slate-400 italic p-4 text-center mt-4 border-2 border-dashed rounded-lg border-slate-200">
                          Nenhum plantão agendado
                        </div>
                      )}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Alert Panel */}
      <div className="border rounded-lg bg-slate-50/80 p-4 shadow-sm">
        <h3 className="font-semibold mb-4 text-slate-800 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-slate-500" />
          Alertas e Validações
        </h3>

        {alerts.length === 0 ? (
          <div className="text-sm text-slate-500 italic flex items-center gap-2 p-4 bg-white rounded-md border border-dashed">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Nenhum alerta para o setor selecionado no período visível.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.map((alert, i) => (
              <Alert
                key={i}
                variant={alert.type === 'error' ? 'destructive' : 'default'}
                className={cn(
                  alert.type === 'warning' && 'border-amber-500/50 text-amber-800 bg-amber-50/50',
                  'bg-white',
                )}
              >
                {alert.type === 'error' ? (
                  <AlertCircle className="h-4 w-4" />
                ) : alert.type === 'warning' ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                ) : (
                  <Info className="h-4 w-4" />
                )}
                <AlertTitle className="text-sm font-medium">
                  {alert.type === 'error' ? 'Violação de Regra' : 'Aviso'}
                </AlertTitle>
                <AlertDescription className="text-xs mt-1">{alert.message}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
