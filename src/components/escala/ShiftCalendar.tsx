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
  differenceInDays,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

type ViewMode = 'month' | 'week' | 'day'

export function ShiftCalendar({
  shifts,
  cycle,
  contracts,
  onShiftUpdate,
}: {
  shifts: any[]
  cycle: any
  contracts: any[]
  onShiftUpdate?: () => void
}) {
  const [view, setView] = useState<ViewMode>('week')
  const cycleStart = cycle ? parseISO(cycle.start_date.split(' ')[0]) : new Date()
  const cycleEnd = cycle ? parseISO(cycle.end_date.split(' ')[0]) : new Date()

  const [currentDate, setCurrentDate] = useState(cycleStart)
  const [sectors, setSectors] = useState<any[]>([])
  const { toast } = useToast()

  useEffect(() => {
    pb.collection('hospital_sectors').getFullList().then(setSectors).catch(console.error)
  }, [])

  const days = useMemo(() => {
    if (view === 'day') return [currentDate]
    if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 }) // Sunday
      const end = endOfWeek(currentDate, { weekStartsOn: 0 })
      return eachDayOfInterval({ start, end })
    }
    const start = startOfMonth(currentDate)
    const end = endOfMonth(currentDate)
    return eachDayOfInterval({ start, end })
  }, [currentDate, view])

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

  const getShiftsForDay = (day: Date) => {
    return shifts
      .filter((s) => {
        const sDate = parseISO(s.start_time.split(' ')[0])
        return isSameDay(sDate, day)
      })
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }

  const cycleInterval = { start: cycleStart, end: cycleEnd }

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
    const diffDays = differenceInDays(targetDay, new Date(shift.start_time.split(' ')[0]))
    newStart.setDate(newStart.getDate() + diffDays)
    newEnd.setDate(newEnd.getDate() + diffDays)

    const updatedShift = {
      ...shift,
      start_time: format(newStart, "yyyy-MM-dd HH:mm:ss.SSS'Z'"),
      end_time: format(newEnd, "yyyy-MM-dd HH:mm:ss.SSS'Z'"),
    }

    // Check rest rules (Validation)
    const userShifts = shifts.filter((s) => s.user === shift.user && s.id !== shift.id)
    let warning = ''
    const contract = contracts.find((c) => c.user === shift.user)
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
      await pb.collection('shifts').update(shift.id, {
        start_time: updatedShift.start_time,
        end_time: updatedShift.end_time,
      })
      toast({ title: 'Plantão atualizado', description: 'O plantão foi movido com sucesso.' })
      onShiftUpdate?.()
    } catch (err) {
      toast({ title: 'Erro', description: 'Falha ao mover o plantão', variant: 'destructive' })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  return (
    <div className="flex flex-col h-[700px] border-0 rounded-b-lg overflow-hidden bg-white">
      <div className="flex flex-wrap items-center justify-between p-4 border-b gap-4 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold w-[180px] text-center capitalize text-slate-700">
            {view === 'day' && format(currentDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
            {view === 'week' &&
              `${format(days[0], 'dd/MM')} a ${format(days[days.length - 1], 'dd/MM')}`}
            {view === 'month' && format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" onClick={next}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Select value={view} onValueChange={(v: ViewMode) => setView(v)}>
          <SelectTrigger className="w-[120px] bg-white">
            <CalendarIcon className="w-4 h-4 mr-2 text-slate-500" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mês</SelectItem>
            <SelectItem value="week">Semana</SelectItem>
            <SelectItem value="day">Dia</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1 bg-slate-50/30">
        {view === 'month' && (
          <div className="grid grid-cols-7 border-b sticky top-0 bg-slate-100 z-10">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
              <div
                key={d}
                className="p-2 text-center text-xs font-semibold text-slate-500 border-r last:border-r-0"
              >
                {d}
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            'grid',
            view === 'month' && 'grid-cols-7 auto-rows-[130px]',
            view === 'week' && 'grid-cols-7 min-h-full',
            view === 'day' && 'grid-cols-1 min-h-full',
          )}
        >
          {days.map((day, i) => {
            const dayShifts = getShiftsForDay(day)
            const inCycle = cycle ? isWithinInterval(day, cycleInterval) : true

            // Calculate sector health indicators for this day
            const sectorHealth = sectors
              .map((sec) => {
                const count = dayShifts.filter(
                  (s) => s.sector === sec.id || s.expand?.sector?.id === sec.id,
                ).length
                const ideal = sec.ideal_staffing || 0
                const min = sec.min_staffing || 0
                let color = 'bg-red-500' // Below min
                if (count >= ideal)
                  color = 'bg-green-500' // Meets or exceeds ideal
                else if (count >= min) color = 'bg-yellow-500' // Meets min, below ideal
                return { ...sec, count, color }
              })
              .filter((s) => s.count > 0 || s.min_staffing > 0)

            return (
              <div
                key={i}
                onDrop={(e) => handleDrop(e, day)}
                onDragOver={handleDragOver}
                className={cn(
                  'border-r border-b p-2 flex flex-col gap-1 overflow-hidden transition-colors',
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
                      {format(day, view === 'month' ? 'd' : 'dd/MM (EEEE)', { locale: ptBR })}
                    </span>
                    {dayShifts.length > 0 && view === 'month' && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">
                        {dayShifts.length}
                      </Badge>
                    )}
                  </div>

                  {/* Visual Staffing Health */}
                  {view !== 'month' && sectorHealth.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {sectorHealth.map((sh) => (
                        <div
                          key={sh.id}
                          className="flex items-center gap-1 text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded shadow-sm"
                          title={`${sh.name}: ${sh.count} alocados (Min: ${sh.min_staffing}, Ideal: ${sh.ideal_staffing})`}
                        >
                          <div className={cn('w-2 h-2 rounded-full', sh.color)} />
                          <span className="max-w-[70px] truncate">{sh.name}</span>
                          <span className="font-semibold">
                            {sh.count}/{sh.ideal_staffing}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div
                  className={cn(
                    'flex-1 overflow-y-auto space-y-1.5 pr-1',
                    view === 'month' ? 'scrollbar-none' : '',
                  )}
                >
                  {dayShifts.map((s) => {
                    const contract = contracts.find((c) => c.user === s.user)
                    const shiftType = contract?.expand?.shift_type?.name || 'Padrão'
                    return (
                      <div
                        key={s.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, s)}
                        className="text-xs p-2 rounded bg-white border border-slate-200 shadow-sm flex flex-col gap-1 hover:border-primary/50 transition-colors cursor-move active:cursor-grabbing"
                      >
                        <div
                          className="font-semibold text-slate-800 truncate"
                          title={s.expand?.user?.name}
                        >
                          {s.expand?.user?.name || 'Sem nome'}
                        </div>
                        <div className="flex justify-between items-center text-slate-500 text-[10px]">
                          <span className="flex items-center gap-1">
                            <ClockIcon className="w-3 h-3" />
                            {s.start_time.split(' ')[1].substring(0, 5)} -{' '}
                            {s.end_time.split(' ')[1].substring(0, 5)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 h-3 font-normal text-slate-600 bg-slate-50"
                          >
                            {s.expand?.sector?.name || 'Setor'}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[9px] px-1 h-3 font-normal',
                              s.start_time.includes('19:00:00')
                                ? 'text-indigo-100 bg-indigo-800 border-indigo-900'
                                : s.start_time.includes('13:00:00')
                                  ? 'text-orange-700 bg-orange-50 border-orange-200'
                                  : s.end_time.includes('13:00:00')
                                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                    : 'text-blue-700 bg-blue-50 border-blue-200',
                            )}
                          >
                            {shiftType}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                  {dayShifts.length === 0 && view !== 'month' && (
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
  )
}

function ClockIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
