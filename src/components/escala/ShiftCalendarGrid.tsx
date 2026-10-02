import React from 'react'
import { format, isSameDay, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Palmtree } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCorenLabel, formatShiftCalendarSecondLine } from '@/lib/escala-calendar-formatter'
import { isVacationDateInclusive } from '@/lib/escala-vacation'

export interface CalendarDayItem {
  date: Date
  key: string // "YYYY-MM-DD"
  dayOfWeek: number // 0=Dom, 6=Sáb
}

export interface ShiftCalendarGridProps {
  days: CalendarDayItem[]
  shifts: any[]
  contracts: any[]
  staffProfiles?: Array<{
    id: string
    name: string
    professional_id?: string | null
    default_sector?: string
    vacation_enabled?: boolean | null
    vacation_start?: string | null
    vacation_end?: string | null
    [key: string]: any
  }>
  weekendOffMap?: Map<string, Set<string>>
  selectedSectorId?: string
  sectorMinStaffing?: number
  selectedStaffId?: string
  dayFilter?: 'all' | 'even' | 'odd'
  view?: 'cycle' | 'month' | 'week' | 'day'
  inCycleCheck?: (day: Date) => boolean
  movedShiftIds?: Set<string>
  onShiftDragStart?: (e: React.DragEvent, shift: any) => void
  onCellDrop?: (e: React.DragEvent, day: Date) => void
  onCellDragOver?: (e: React.DragEvent) => void
  isInteractive?: boolean
}

/**
 * Classifica um plantão como diurno (D) ou noturno (N).
 */
export function isNightShift(
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

/**
 * Legenda padrão compartilhada entre tela e documento exportado
 */
export function CalendarGridLegend() {
  return (
    <div className="border-t bg-slate-50/70 px-4 py-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
      <span className="font-semibold text-slate-700 select-none">Legenda:</span>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-white border border-slate-300 font-bold text-[9px] text-emerald-700 inline-flex items-center justify-center">
          D
        </span>
        <span>Plantão D</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-white border border-slate-300 font-bold text-[9px] text-indigo-700 inline-flex items-center justify-center">
          N
        </span>
        <span>Plantão N</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-orange-100 border border-orange-300 inline-block" />
        <span>Folga Fim de Semana</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-300 inline-flex items-center justify-center text-emerald-700">
          <Palmtree className="h-2.5 w-2.5" />
        </span>
        <span className="font-medium text-emerald-900">Férias</span>
      </div>
    </div>
  )
}

/**
 * Componente React compartilhado da grade de calendário.
 * Usado fielmente tanto na tela (ShiftCalendar) quanto no contêiner offscreen de renderização PDF.
 * Mantém 100% das mesmas classes Tailwind, hierarquia e formatações visuais.
 */
export function ShiftCalendarGrid({
  days,
  shifts,
  contracts,
  staffProfiles = [],
  weekendOffMap = new Map(),
  selectedSectorId,
  sectorMinStaffing = 0,
  selectedStaffId = '',
  dayFilter = 'all',
  view = 'cycle',
  inCycleCheck,
  movedShiftIds = new Set(),
  onShiftDragStart,
  onCellDrop,
  onCellDragOver,
  isInteractive = true,
}: ShiftCalendarGridProps) {
  // Setor staff profiles para exibição de folgas e férias
  const sectorStaffProfiles = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()

    staffProfiles.forEach((sp) => {
      if (!selectedSectorId || sp.default_sector === selectedSectorId) {
        map.set(sp.id, { id: sp.id, name: sp.name || 'Sem nome' })
      }
    })

    shifts.forEach((s) => {
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
  }, [staffProfiles, selectedSectorId, shifts])

  const getShiftsForDay = (dayKey: string) => {
    return shifts
      .filter((s) => {
        const sDateStr = s.start_time ? s.start_time.split(' ')[0].split('T')[0] : ''
        if (sDateStr !== dayKey) return false
        if (selectedStaffId) {
          const pid = s.staff_profile || s.user_id || s.user
          if (pid !== selectedStaffId) return false
        }
        return true
      })
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
  }

  const baseWeekLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const firstDayDow = days.length > 0 ? days[0].dayOfWeek : 0
  const rotatedLabels = [
    ...baseWeekLabels.slice(firstDayDow),
    ...baseWeekLabels.slice(0, firstDayDow),
  ]

  return (
    <div className="w-full flex flex-col bg-white">
      {/* Cabeçalho dias da semana */}
      {(view === 'month' || view === 'cycle') && (
        <div
          className={cn(
            'border-b sticky top-0 bg-slate-100 z-10',
            dayFilter === 'all'
              ? 'grid grid-cols-7'
              : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7',
          )}
        >
          {dayFilter === 'all'
            ? rotatedLabels.map((d, idx) => (
                <div
                  key={`${d}-${idx}`}
                  className="p-2 text-center text-xs font-semibold text-slate-500 border-r last:border-r-0"
                >
                  {d}
                </div>
              ))
            : null}
        </div>
      )}

      {/* Grade de Células */}
      <div
        className={cn(
          'grid bg-slate-200 gap-px',
          dayFilter === 'all'
            ? [
                view === 'month' && 'grid-cols-7 auto-rows-[240px]',
                view === 'cycle' && 'grid-cols-7 auto-rows-[minmax(240px,auto)]',
                view === 'week' && 'grid-cols-7 min-h-full',
                view === 'day' && 'grid-cols-1 min-h-full',
              ]
            : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 auto-rows-[minmax(240px,auto)]',
        )}
      >
        {days.map((dayItem, i) => {
          const day = dayItem.date
          const dateKey = dayItem.key
          const dayShifts = getShiftsForDay(dateKey)
          const inCycle = inCycleCheck ? inCycleCheck(day) : true
          const isWeekendDay = dayItem.dayOfWeek === 6 || dayItem.dayOfWeek === 0
          const secMinStaff = sectorMinStaffing || 0
          const isCoverageBelowMin = inCycle && secMinStaff > 0 && dayShifts.length < secMinStaff

          return (
            <div
              key={i}
              onDrop={isInteractive && onCellDrop ? (e) => onCellDrop(e, day) : undefined}
              onDragOver={isInteractive && onCellDragOver ? onCellDragOver : undefined}
              className={cn(
                'p-2 flex flex-col gap-1 transition-colors relative bg-white',
                view === 'cycle' ? 'overflow-visible' : 'overflow-hidden',
                isCoverageBelowMin && inCycle
                  ? 'bg-rose-50/50 ring-1 ring-rose-400 ring-inset'
                  : !inCycle
                    ? 'bg-slate-100/50 opacity-50'
                    : isInteractive
                      ? 'hover:bg-slate-50/80'
                      : '',
              )}
            >
              <div
                className={cn(
                  'text-sm font-medium mb-1 flex flex-col gap-1',
                  isSameDay(day, new Date()) ? 'text-primary font-bold' : 'text-slate-700',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn(isCoverageBelowMin && 'text-rose-700 font-bold')}>
                    {format(
                      day,
                      (view === 'month' || view === 'cycle') && dayFilter === 'all'
                        ? 'dd/MM'
                        : 'dd/MM (EEEE)',
                      { locale: ptBR },
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    {isCoverageBelowMin && (
                      <Badge
                        variant="destructive"
                        className="text-[10px] h-4 px-1 py-0 bg-rose-600 text-white font-semibold"
                        title={`Efetivo abaixo do mínimo: ${dayShifts.length}/${secMinStaff}`}
                      >
                        {dayShifts.length}/{secMinStaff}
                      </Badge>
                    )}
                    {dayShifts.length > 0 &&
                      !isCoverageBelowMin &&
                      (view === 'month' || view === 'cycle') && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">
                          {dayShifts.length}
                        </Badge>
                      )}
                  </div>
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
                  const startTime = (String(s.start_time || '').split(/[ T]/)[1] || '').substring(
                    0,
                    5,
                  )
                  const endTime = (String(s.end_time || '').split(/[ T]/)[1] || '').substring(0, 5)
                  const isNight = isNightShift(
                    shiftType?.start_time,
                    shiftType?.end_time,
                    startTime,
                    endTime,
                  )
                  const periodLetter: 'D' | 'N' = isNight ? 'N' : 'D'
                  const corenText = formatCorenLabel(professionalId)
                  const secondLineText = formatShiftCalendarSecondLine(periodLetter, professionalId)
                  const isShiftOnVacation = isVacationDateInclusive(matchedProfile, dateKey)
                  const vacationPeriodText =
                    matchedProfile?.vacation_start && matchedProfile?.vacation_end
                      ? `Férias de ${format(parseISO(matchedProfile.vacation_start.split(' ')[0]), 'dd/MM')} a ${format(parseISO(matchedProfile.vacation_end.split(' ')[0]), 'dd/MM')}`
                      : 'Férias'

                  return (
                    <div
                      key={s.id}
                      draggable={isInteractive}
                      onDragStart={
                        isInteractive && onShiftDragStart
                          ? (e) => onShiftDragStart(e, s)
                          : undefined
                      }
                      className={cn(
                        'text-xs p-2 rounded bg-white border shadow-sm flex flex-col gap-1 transition-colors min-h-max',
                        isInteractive && 'cursor-move active:cursor-grabbing',
                        movedShiftIds.has(s.id)
                          ? 'border-orange-500 hover:border-orange-600'
                          : isInteractive
                            ? 'border-slate-200 hover:border-primary/50'
                            : 'border-slate-200',
                      )}
                    >
                      {/* Primeira linha: nome completo */}
                      <div className="flex items-start justify-between gap-1">
                        <div
                          className="font-semibold text-slate-800 break-words whitespace-normal leading-snug flex-1"
                          title={name}
                        >
                          {name}
                        </div>
                        {isShiftOnVacation && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 border border-emerald-300 text-emerald-800 shrink-0"
                            title={vacationPeriodText}
                            aria-label={vacationPeriodText}
                          >
                            <Palmtree className="h-3 w-3 shrink-0" />
                            <span>FÉRIAS</span>
                          </span>
                        )}
                      </div>
                      {/* Segunda linha: D/N + • + COREN */}
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
                        <span
                          data-testid={`shift-coren-${s.id}`}
                          className={cn(
                            'break-words',
                            !professionalId ? 'text-slate-400 italic' : 'text-slate-700',
                          )}
                        >
                          {corenText}
                        </span>
                      </div>
                    </div>
                  )
                })}

                {/* Placeholders de Férias */}
                {(() => {
                  const allVisibleDayShifts = shifts.filter((s) => {
                    const sDateStr = s.start_time ? s.start_time.split(' ')[0].split('T')[0] : ''
                    return sDateStr === dateKey
                  })
                  const workedStaffIds = new Set(
                    allVisibleDayShifts.map((s) => s.staff_profile || s.user_id || s.user),
                  )

                  const vacationPlaceholders = sectorStaffProfiles.filter((staff) => {
                    if (selectedStaffId && staff.id !== selectedStaffId) return false
                    if (workedStaffIds.has(staff.id)) return false
                    const fullProfile = staffProfiles.find((sp) => sp.id === staff.id)
                    return isVacationDateInclusive(fullProfile, dateKey)
                  })

                  return vacationPlaceholders.map((staff) => {
                    const fullProfile = staffProfiles.find((sp) => sp.id === staff.id)
                    const vacationPeriodText =
                      fullProfile?.vacation_start && fullProfile?.vacation_end
                        ? `Férias de ${format(parseISO(fullProfile.vacation_start.split(' ')[0]), 'dd/MM')} a ${format(parseISO(fullProfile.vacation_end.split(' ')[0]), 'dd/MM')}`
                        : 'Férias'
                    return (
                      <div
                        key={`vacation-${staff.id}-${dateKey}`}
                        data-testid={`vacation-${staff.id}-${dateKey}`}
                        title={vacationPeriodText}
                        aria-label={vacationPeriodText}
                        className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded px-2 py-1.5 text-xs shadow-sm flex flex-col gap-1 transition-colors select-none min-h-max"
                      >
                        <div
                          className="font-semibold text-emerald-950 break-words whitespace-normal leading-snug"
                          title={staff.name}
                        >
                          {staff.name}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 tracking-wide uppercase">
                          <Palmtree className="h-3 w-3 shrink-0" />
                          <span>FÉRIAS</span>
                        </div>
                      </div>
                    )
                  })
                })()}

                {/* Placeholders de Folga Fim de Semana */}
                {(() => {
                  if (!isWeekendDay) return null
                  const allVisibleDayShifts = shifts.filter((s) => {
                    const sDateStr = s.start_time ? s.start_time.split(' ')[0].split('T')[0] : ''
                    return sDateStr === dateKey
                  })
                  const workedStaffIds = new Set(
                    allVisibleDayShifts.map((s) => s.staff_profile || s.user_id || s.user),
                  )

                  const weekendOffPlaceholders = sectorStaffProfiles.filter((staff) => {
                    if (selectedStaffId && staff.id !== selectedStaffId) return false
                    if (workedStaffIds.has(staff.id)) return false
                    const fullProfile = staffProfiles.find((sp) => sp.id === staff.id)
                    if (isVacationDateInclusive(fullProfile, dateKey)) return false
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
                      <div
                        className="font-semibold text-slate-900 break-words whitespace-normal leading-snug"
                        title={staff.name}
                      >
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
                    const fullProfile = staffProfiles.find((sp) => sp.id === staff.id)
                    if (isVacationDateInclusive(fullProfile, dateKey)) return true
                    if (!isWeekendDay) return false
                    const offDates = weekendOffMap.get(staff.id)
                    return Boolean(offDates && offDates.has(dateKey))
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
    </div>
  )
}
