import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import {
  getShiftCycles,
  getHospitalSectors,
  getStaffProfiles,
  getStaffContracts,
  getTimeoffRequests,
  generateShifts,
  commitShiftSchedule,
} from '@/services/escala'
import {
  AlertCircle,
  CheckCircle2,
  UserPlus,
  Save,
  Send,
  Trash2,
  CalendarOff,
  Info,
  Download,
  FileDown,
  AlertTriangle,
  Loader2,
  Move,
  Wand2,
} from 'lucide-react'
import { exportScalePdf, type ShiftSlot } from '@/utils/scalePdfExport'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useRealtime } from '@/hooks/use-realtime'
import { format, eachDayOfInterval, addDays, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import pb from '@/lib/pocketbase/client'
import {
  assertWeekendPair,
  formatLocalDateKeySafe,
  parseDateOnly,
  addDaysDateOnly,
  dayOfWeekDateOnly,
  buildWeekendOffMap,
  validateWeekendOffOverride,
  moveWeekendOffAssignment,
} from '@/lib/escala-weekend-off'
import { moveWeekendOff } from '@/services/escala'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { StaffFilter } from './StaffFilter'
import { formatCorenLabel, formatShiftCalendarSecondLine } from '@/lib/escala-calendar-formatter'
import { isVacationDateInclusive } from '@/lib/escala-vacation'
import { Palmtree } from 'lucide-react'

type DraftCell = 'D' | 'N' | 'M' | 'T' | 'F' | ''

export function ScalePlanner(_props: { departmentId?: string; projectId?: string }) {
  const [cycles, setCycles] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [timeoffs, setTimeoffs] = useState<any[]>([])
  const [allShifts, setAllShifts] = useState<any[]>([])

  const [selectedCycleId, setSelectedCycleId] = useState<string>('')
  const [selectedSectorId, setSelectedSectorId] = useState<string>('')
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [draftUsers, setDraftUsers] = useState<any[]>([])
  const [draft, setDraft] = useState<Record<string, Record<string, DraftCell>>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [searchUser, setSearchUser] = useState('')
  const [generatingUserId, setGeneratingUserId] = useState<string | null>(null)

  const [isEditMode, setIsEditMode] = useState(false)
  const [isLoadingShifts, setIsLoadingShifts] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [dragOverCell, setDragOverCell] = useState<{ userId: string; dateStr: string } | null>(null)
  const [draggedWeekendOff, setDraggedWeekendOff] = useState<{
    userId: string
    dateStr: string
    weekday: number
    userName: string
  } | null>(null)
  const [keyboardMoveModal, setKeyboardMoveModal] = useState<{
    isOpen: boolean
    userId: string
    userName: string
    sourceDate: string
    weekday: number
    targetDate: string
  }>({
    isOpen: false,
    userId: '',
    userName: '',
    sourceDate: '',
    weekday: 6,
    targetDate: '',
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [activeDraftRecord, setActiveDraftRecord] = useState<any>(null)

  const { toast } = useToast()
  const isCollectionPast = new Date().getDate() > 10

  const handleGenerateAI = async () => {
    if (!selectedCycleId || !selectedSectorId) return
    setIsGenerating(true)
    setGenerationError(null)
    try {
      const res = await generateShifts(
        selectedCycleId,
        [selectedSectorId],
        '',
        localStorage.getItem('escala_ai_priority') || 'staffing',
        parseInt(localStorage.getItem('escala_ai_strictness') || '50', 10),
      )

      if (res && res.error) {
        setGenerationError(res.error)
        toast({
          title: 'Geração Falhou',
          description: 'A IA encontrou conflitos. Veja os detalhes abaixo.',
          variant: 'destructive',
        })
        if (res.suggestion) {
          toast({ title: 'Sugestão da IA', description: res.suggestion })
        }
      } else {
        toast({
          title: 'Sucesso',
          description: `${res.count} plantões gerados com IA.`,
        })
        const newShifts = await pb.collection('shifts').getFullList({
          filter: `cycle="${selectedCycleId}"`,
          expand: 'staff_profile,staff_profile.staff_role,user,sector',
        })
        setAllShifts(newShifts)
      }
    } catch (err: any) {
      const errorData = err?.response
      const errorMsg = errorData?.error || err.message || 'Falha na geração de escala.'
      setGenerationError(errorMsg)
      toast({
        title: 'Erro na Geração',
        description: errorMsg,
        variant: 'destructive',
      })
      if (errorData?.suggestion) {
        toast({ title: 'Sugestão', description: errorData.suggestion })
      }
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    Promise.all([
      getShiftCycles(),
      pb.collection('hospital_sectors').getFullList({ expand: 'department', sort: 'name' }),
      getStaffProfiles(),
      getStaffContracts(),
      getTimeoffRequests(),
    ]).then(([c, sRaw, u, cont, to]) => {
      setCycles(c)

      // O planejamento é uma operação central da Gestão de Escalas e deve
      // permitir selecionar qualquer setor cadastrado, independentemente do
      // departamento principal ou dos departamentos associados ao projeto.
      const s = sRaw
      setSectors(s)

      setUsers(u.filter((profile: any) => profile.active !== false))
      setContracts(cont)
      setTimeoffs(to)
      if (c.length > 0)
        setSelectedCycleId(
          c.find((x: any) => x.status === 'draft' || x.status === 'active')?.id || c[0].id,
        )
      setSelectedSectorId((current) =>
        current && s.some((sector: any) => sector.id === current) ? current : s[0]?.id || '',
      )
    })
  }, [])

  useEffect(() => {
    if (selectedCycleId) {
      setIsLoadingShifts(true)
      pb.collection('shifts')
        .getFullList({
          filter: `cycle="${selectedCycleId}"`,
          expand: 'staff_profile,staff_profile.staff_role,user,sector',
        })
        .then(setAllShifts)
        .finally(() => setIsLoadingShifts(false))
    }
  }, [selectedCycleId])

  useEffect(() => {
    if (selectedCycleId && selectedSectorId) {
      pb.collection('schedule_drafts')
        .getFullList({
          filter: `cycle="${selectedCycleId}" && sector="${selectedSectorId}"`,
          sort: '-created',
        })
        .then((records) => {
          setActiveDraftRecord(records[0] || null)
        })
        .catch(() => setActiveDraftRecord(null))
    } else {
      setActiveDraftRecord(null)
    }
  }, [selectedCycleId, selectedSectorId, allShifts])

  const reloadShiftsAndProfiles = () => {
    if (selectedCycleId) {
      setIsSyncing(true)
      Promise.all([
        pb.collection('shifts').getFullList({
          filter: `cycle="${selectedCycleId}"`,
          expand: 'staff_profile,staff_profile.staff_role,user,sector',
        }),
        getStaffProfiles(),
      ])
        .then(([shiftsData, profilesData]) => {
          setAllShifts(shiftsData)
          setUsers(profilesData.filter((profile: any) => profile.active !== false))
        })
        .finally(() => setTimeout(() => setIsSyncing(false), 1000))
    }
  }

  useRealtime('shifts', reloadShiftsAndProfiles, !!selectedCycleId)
  useRealtime('staff_roles', reloadShiftsAndProfiles, !!selectedCycleId)
  useRealtime('staff_profiles', reloadShiftsAndProfiles, !!selectedCycleId)

  useEffect(() => {
    if (!selectedCycleId || !selectedSectorId) return
    const sectorShifts = allShifts.filter((s) => s.sector === selectedSectorId)
    const newDraft: Record<string, Record<string, DraftCell>> = {}
    const newUsers = new Map<string, any>()

    // The planner must start from the active collaborators linked to the selected
    // sector. A new sector may not have shifts yet, so deriving this grid only
    // from existing shifts would leave it empty and could retain another sector's
    // collaborators after changing the selection.
    users
      .filter((user) => user.active !== false && user.default_sector === selectedSectorId)
      .forEach((user) => {
        newUsers.set(user.id, user)
        newDraft[user.id] = {}
      })

    sectorShifts.forEach((s) => {
      const collaboratorId = s.staff_profile || s.user
      const u = users.find((x) => x.id === collaboratorId) ||
        s.expand?.staff_profile ||
        s.expand?.user || {
          id: collaboratorId,
          name: `Colaborador ${collaboratorId.substring(0, 6)}`,
          expand: {},
        }
      newUsers.set(u.id, u)
      if (!newDraft[collaboratorId]) newDraft[collaboratorId] = {}

      const dateStr = s.start_time.split(' ')[0]
      const sh = s.start_time.split(' ')[1]?.substring(0, 8)
      const eh = s.end_time.split(' ')[1]?.substring(0, 8)

      let val: DraftCell = ''
      if (sh === '07:00:00' && eh === '19:00:00') val = 'D'
      else if (sh === '19:00:00' && eh === '07:00:00') val = 'N'
      else if (sh === '07:00:00' && eh === '13:00:00') val = 'M'
      else if (sh === '13:00:00' && eh === '19:00:00') val = 'T'

      if (val) newDraft[collaboratorId][dateStr] = val
    })

    setDraftUsers(Array.from(newUsers.values()))
    setDraft(newDraft)
  }, [allShifts, selectedSectorId, selectedCycleId, users])

  const selectedCycle = useMemo(
    () => cycles.find((c) => c.id === selectedCycleId),
    [cycles, selectedCycleId],
  )
  const selectedSector = useMemo(
    () => sectors.find((s) => s.id === selectedSectorId),
    [sectors, selectedSectorId],
  )

  const visibleDraftUsers = useMemo(() => {
    if (!selectedStaffId) return draftUsers
    return draftUsers.filter((u) => u.id === selectedStaffId)
  }, [draftUsers, selectedStaffId])
  interface PlannerDayItem {
    date: Date
    key: string
    dayOfWeek: number
  }

  const days = useMemo<PlannerDayItem[]>(() => {
    try {
      if (!selectedCycle) return []
      const startStr = (selectedCycle.start_date || '').split(' ')[0].split('T')[0]
      const endStr = (selectedCycle.end_date || '').split(' ')[0].split('T')[0]
      if (!startStr || !endStr || startStr > endStr) return []

      const items: PlannerDayItem[] = []
      let cur = startStr
      while (cur <= endStr) {
        const { y, m, d } = parseDateOnly(cur)
        items.push({
          date: new Date(y, m - 1, d),
          key: cur,
          dayOfWeek: dayOfWeekDateOnly(cur),
        })
        cur = addDaysDateOnly(cur, 1)
      }
      return items
    } catch {
      return []
    }
  }, [selectedCycle])

  const dailyCounts = useMemo(() => {
    if (!selectedSector || days.length === 0) return {}
    const counts: Record<
      string,
      { count: number; status: 'understaffed' | 'suboptimal' | 'optimal' }
    > = {}

    days.forEach((dayItem) => {
      const ds = dayItem.key
      let count = 0
      draftUsers.forEach((u) => {
        const val = draft[u.id]?.[ds]
        if (val && val !== 'F') count++
      })

      let status: 'optimal' | 'suboptimal' | 'understaffed' = 'optimal'
      if (count < (selectedSector.min_staffing || 0)) status = 'understaffed'
      else if (count < (selectedSector.ideal_staffing || 0)) status = 'suboptimal'

      counts[ds] = { count, status }
    })
    return counts
  }, [days, draft, draftUsers, selectedSector])

  const timeoffsForCycle = useMemo(
    () =>
      timeoffs.filter(
        (t) => t.cycle === selectedCycleId && (t.status === 'fulfilled' || t.status === 'pending'),
      ),
    [timeoffs, selectedCycleId],
  )

  // Mapa de fins de semana de folga para destaque visual na grade exclusivamente de activeDraftRecord
  // Sanitiza contra férias ativas para prioridade absoluta de férias
  const weekendOffMap = useMemo(() => {
    const vacationsByStaff: Record<
      string,
      {
        vacation_enabled?: boolean | null
        vacation_start?: string | null
        vacation_end?: string | null
      }
    > = {}
    draftUsers.forEach((sp) => {
      vacationsByStaff[sp.id] = {
        vacation_enabled: sp.vacation_enabled,
        vacation_start: sp.vacation_start,
        vacation_end: sp.vacation_end,
      }
    })
    return buildWeekendOffMap(activeDraftRecord?.validation_summary, vacationsByStaff)
  }, [activeDraftRecord, draftUsers])

  const hasWeekendOffMetadata = useMemo(() => {
    return weekendOffMap.size > 0
  }, [weekendOffMap])

  const validations = useMemo(() => {
    if (!selectedSector || days.length === 0) return []
    const alerts: string[] = []
    const isEm = selectedSector.is_critical || selectedSector.name.toLowerCase().includes('ps')
    const fReq = selectedSector.bed_capacity
      ? Math.ceil(selectedSector.bed_capacity / (selectedSector.staffing_ratio || 10))
      : 0

    days.forEach((dayItem) => {
      const dateStr = dayItem.key
      let count = 0,
        supCount = 0,
        reqSupCount = 0

      draftUsers.forEach((user) => {
        const cell = draft[user.id]?.[dateStr]
        if (cell && cell !== 'F') {
          count++
          if (user.expand?.staff_role?.requires_supervision === false) supCount++
          else reqSupCount++
        }
      })

      if (reqSupCount > 0 && supCount === 0)
        alerts.push(`Dia ${format(dayItem.date, 'dd/MM')}: Falta Enfermeiro p/ supervisão`)
      if (isEm) {
        if (count < 2) alerts.push(`Dia ${format(dayItem.date, 'dd/MM')}: Emergência < mínimo (2)`)
        else if (count < 3)
          alerts.push(`Dia ${format(dayItem.date, 'dd/MM')}: Emergência < ideal (3)`)
      } else if (fReq > 0) {
        if (count < fReq)
          alerts.push(`Dia ${format(dayItem.date, 'dd/MM')}: Andar < efetivo (${count}/${fReq})`)
      } else if (count > 0 && count < (selectedSector.min_staffing || 0)) {
        alerts.push(`Dia ${format(dayItem.date, 'dd/MM')}: Abaixo do efetivo mínimo`)
      }
    })

    draftUsers.forEach((user) => {
      const contract = contracts.find((c) => (c.staff_profile || c.user) === user.id)
      const maxH = contract?.monthly_hour_limit || 180
      const wh = contract?.expand?.shift_type?.work_hours || 12
      const restH = contract?.expand?.shift_type?.rest_hours || 36
      let uh = 0,
        lastEnd: Date | null = null

      days.forEach((dayItem) => {
        const dateStr = dayItem.key
        const cell = draft[user.id]?.[dateStr]
        const matchingTimeoff = timeoffsForCycle.find((t) => {
          if ((t.staff_profile || t.user) !== user.id) return false
          const start = t.date.substring(0, 10)
          const end = (t.end_date || t.date).substring(0, 10)
          return dateStr >= start && dateStr <= end
        })
        const isTO = !!matchingTimeoff
        const isVacation = isVacationDateInclusive(user, dateStr)

        if (cell && cell !== 'F') {
          if (isTO) {
            const reqStatus = matchingTimeoff?.status
            alerts.push(
              `${user.name} alocado em dia de folga ${reqStatus === 'pending' ? '(pendente)' : ''} (${format(dayItem.date, 'dd/MM')})`,
            )
          }

          if (isVacation) {
            alerts.push(
              `Colaborador está de férias no período: ${user.name} em ${format(dayItem.date, 'dd/MM')}.`,
            )
          }

          let duration = wh
          let stHour = 7
          if (cell === 'D') {
            duration = wh
            stHour = 7
          } else if (cell === 'N') {
            duration = wh
            stHour = 19
          } else if (cell === 'M') {
            duration = wh || 6
            stHour = 7
          } else if (cell === 'T') {
            duration = wh || 6
            stHour = 13
          }

          uh += duration

          const cs = new Date(dayItem.date)
          cs.setHours(stHour, 0, 0, 0)

          if (lastEnd && (cs.getTime() - lastEnd.getTime()) / 3600000 < restH) {
            alerts.push(`${user.name} sem descanso de ${restH}h (${format(dayItem.date, 'dd/MM')})`)
          }

          lastEnd = new Date(cs.getTime() + duration * 3600000)
        }
      })
      if (uh > maxH) alerts.push(`${user.name} excede o limite mensal (Total: ${uh}h / ${maxH}h)`)

      // Weekend-off validation: no modelo per-cycle, cada colaborador elegível tem 1 par no ciclo
      if (weekendOffMap.size > 0) {
        const userWeekendOffDates = weekendOffMap.get(user.id) || new Set<string>()
        if (userWeekendOffDates.size < 2) {
          alerts.push(`${user.name} sem fim de semana completo de folga no ciclo.`)
        }
      }
    })
    return Array.from(new Set(alerts))
  }, [days, draft, draftUsers, selectedSector, contracts, timeoffsForCycle, weekendOffMap])

  const handleDragStart = (
    e: React.DragEvent,
    userId: string,
    dateStr: string,
    shiftVal: string,
  ) => {
    e.dataTransfer.setData(
      'text/plain',
      JSON.stringify({ type: 'shift', userId, dateStr, shiftVal }),
    )
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleWeekendOffDragStart = (
    e: React.DragEvent,
    userId: string,
    dateStr: string,
    userName: string,
  ) => {
    const dow = dayOfWeekDateOnly(dateStr)
    const payload = {
      type: 'weekend_off',
      userId,
      dateStr,
      weekday: dow,
      userName,
    }
    setDraggedWeekendOff({ userId, dateStr, weekday: dow, userName })
    e.dataTransfer.setData('text/plain', JSON.stringify(payload))
    e.dataTransfer.setData('application/json', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDraggedWeekendOff(null)
    setDragOverCell(null)
  }

  const handleDragOver = (e: React.DragEvent, userId: string, dateStr: string) => {
    e.preventDefault()
    if (draggedWeekendOff) {
      const tgtDow = dayOfWeekDateOnly(dateStr)
      const isValidTarget =
        draggedWeekendOff.userId === userId &&
        draggedWeekendOff.weekday === tgtDow &&
        draggedWeekendOff.dateStr !== dateStr
      if (isValidTarget) {
        e.dataTransfer.dropEffect = 'move'
      } else {
        e.dataTransfer.dropEffect = 'none'
      }
    } else {
      e.dataTransfer.dropEffect = 'move'
    }

    if (dragOverCell?.userId !== userId || dragOverCell?.dateStr !== dateStr) {
      setDragOverCell({ userId, dateStr })
    }
  }

  const handleDragLeave = () => {
    setDragOverCell(null)
  }

  const executeMoveWeekendOff = async (
    userId: string,
    sourceDateStr: string,
    targetDateStr: string,
    userName: string,
  ) => {
    if (!selectedCycle) {
      toast({
        title: 'Erro',
        description: 'Ciclo não selecionado.',
        variant: 'destructive',
      })
      return
    }

    const cycleStartStr = (selectedCycle.start_date || '').split(' ')[0].split('T')[0]
    const cycleEndStr = (selectedCycle.end_date || '').split(' ')[0].split('T')[0]
    const currentAssignments =
      activeDraftRecord?.validation_summary?.weekend_off_assignments?.[userId] || []

    const preValidation = validateWeekendOffOverride({
      staffId: userId,
      sourceDate: sourceDateStr,
      targetDate: targetDateStr,
      cycleStart: cycleStartStr,
      cycleEnd: cycleEndStr,
      currentAssignments,
    })

    if (!preValidation.valid) {
      toast({
        title: 'Movimento Inválido',
        description: preValidation.error || 'Não é permitido mover para esta data.',
        variant: 'destructive',
      })
      return
    }

    // Se temos activeDraftRecord persistido, chama endpoint dedicado no backend
    if (activeDraftRecord && activeDraftRecord.id) {
      try {
        const res: any = await moveWeekendOff(
          activeDraftRecord.id,
          userId,
          sourceDateStr,
          targetDateStr,
        )

        toast({
          title: 'Folga Remanejada',
          description: `Folga de ${userName} movida com sucesso de ${format(new Date(sourceDateStr + 'T12:00:00Z'), 'dd/MM')} para ${format(new Date(targetDateStr + 'T12:00:00Z'), 'dd/MM')}.`,
        })

        // Atualiza rascunho ativo localmente com os novos assignments e overrides retornados
        setActiveDraftRecord((prev: any) => ({
          ...prev,
          validation_summary: {
            ...(prev?.validation_summary || {}),
            weekend_off_assignments: res.weekend_off_assignments,
            weekend_off_overrides: res.weekend_off_overrides,
          },
        }))

        // Recarrega shifts para refletir a troca
        const reloaded = await pb.collection('shifts').getFullList({
          filter: `cycle="${selectedCycleId}"`,
          expand: 'staff_profile,staff_profile.staff_role,user,sector',
        })
        setAllShifts(reloaded)
      } catch (err: any) {
        const errorData = err?.response
        const errorMsg =
          errorData?.message ||
          errorData?.error ||
          err.message ||
          'Falha ao remanejar folga de fim de semana.'
        toast({
          title: 'Movimento Rejeitado',
          description: errorMsg,
          variant: 'destructive',
        })
      }
    } else {
      // Atualização local do rascunho antes da persistência
      setActiveDraftRecord((prev: any) => {
        const currentSummary = prev?.validation_summary || {}
        const currentAss = currentSummary.weekend_off_assignments || {}
        const staffAss = currentAss[userId] || [sourceDateStr]
        const updatedAss = moveWeekendOffAssignment(staffAss, sourceDateStr, targetDateStr)
        const dow = dayOfWeekDateOnly(sourceDateStr)
        const overrideKey = dow === 6 ? 'saturday' : 'sunday'

        const currentOverrides = currentSummary.weekend_off_overrides || {}
        const staffOverrides = currentOverrides[userId] || {}
        staffOverrides[overrideKey] = {
          source_date: sourceDateStr,
          target_date: targetDateStr,
          weekday: dow,
          moved_at: new Date().toISOString(),
          manual_override: true,
        }

        return {
          ...prev,
          validation_summary: {
            ...currentSummary,
            weekend_off_assignments: {
              ...currentAss,
              [userId]: updatedAss,
            },
            weekend_off_overrides: {
              ...currentOverrides,
              [userId]: staffOverrides,
            },
          },
        }
      })

      // Troca plantão no draft local se houver
      setDraft((prev) => {
        const next = { ...prev }
        if (!next[userId]) next[userId] = {}
        const targetVal = next[userId][targetDateStr]
        next[userId][sourceDateStr] = targetVal || ''
        next[userId][targetDateStr] = ''
        return next
      })

      toast({
        title: 'Folga Remanejada',
        description: `Folga de ${userName} movida para ${format(new Date(targetDateStr + 'T12:00:00Z'), 'dd/MM')}. Salve o rascunho para persistir.`,
      })
    }
  }

  const handleDrop = async (e: React.DragEvent, targetUserId: string, targetDateStr: string) => {
    e.preventDefault()
    setDragOverCell(null)
    setDraggedWeekendOff(null)

    try {
      const dataStr = e.dataTransfer.getData('text/plain')
      if (!dataStr) return

      const data = JSON.parse(dataStr)

      // 1. Drop de Weekend-Off
      if (data.type === 'weekend_off') {
        const { userId, dateStr: sourceDateStr, userName } = data
        if (userId !== targetUserId) {
          toast({
            title: 'Destino Inválido',
            description: 'Não é permitido mover a folga de fim de semana para outro colaborador.',
            variant: 'destructive',
          })
          return
        }
        if (sourceDateStr === targetDateStr) return

        await executeMoveWeekendOff(userId, sourceDateStr, targetDateStr, userName)
        return
      }

      // 2. Drop de Turno Normal (Plantão)
      if (!isEditMode) return

      const sourceUserId = data.userId
      const sourceDateStr = data.dateStr
      const shiftVal = data.shiftVal as DraftCell

      if (sourceUserId === targetUserId && sourceDateStr === targetDateStr) return

      // Bloqueio de férias para o colaborador de destino
      const targetUser = draftUsers.find((u) => u.id === targetUserId)
      if (shiftVal && shiftVal !== 'F' && isVacationDateInclusive(targetUser, targetDateStr)) {
        toast({
          title: 'Bloqueio de Férias',
          description: `Colaborador está de férias no período (${targetUser?.name || 'Colaborador'}).`,
          variant: 'destructive',
        })
        return
      }

      // Optimistic local update
      setDraft((prev) => {
        const next = { ...prev }
        if (!next[sourceUserId]) next[sourceUserId] = {}
        if (!next[targetUserId]) next[targetUserId] = {}

        next[targetUserId] = { ...next[targetUserId], [targetDateStr]: shiftVal }
        next[sourceUserId] = { ...next[sourceUserId], [sourceDateStr]: '' }
        return next
      })

      toast({
        title: 'Alteração no rascunho',
        description: 'O turno foi movido localmente. Use Salvar para validar e gravar a escala.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Falha ao mover elemento',
        variant: 'destructive',
      })
      const reloaded = await pb.collection('shifts').getFullList({
        filter: `cycle="${selectedCycleId}"`,
        expand: 'staff_profile,staff_profile.staff_role,user,sector',
      })
      setAllShifts(reloaded)
    }
  }

  const exportToCSV = () => {
    if (!selectedCycleId || !selectedSectorId) return
    const sectorName = selectedSector?.name || 'Setor'
    const cycleName = selectedCycle?.name || 'Ciclo'

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
    csvContent += `Escala: ${sectorName} - ${cycleName}\n\n`

    const headers = ['Colaborador', 'Cargo', ...days.map((d) => format(d.date, 'dd/MM/yyyy'))]
    csvContent += headers.join(',') + '\n'

    draftUsers.forEach((user) => {
      const row = [user.name, user.expand?.staff_role?.name || '']
      days.forEach((dayItem) => {
        const ds = dayItem.key
        const cell = draft[user.id]?.[ds] || ''
        let displayCell = cell
        if (cell === 'D') displayCell = '07:00 - 19:00'
        if (cell === 'N') displayCell = '19:00 - 07:00'
        if (cell === 'M') displayCell = '07:00 - 13:00'
        if (cell === 'T') displayCell = '13:00 - 19:00'
        if (cell === 'F') displayCell = 'Folga'
        row.push(displayCell)
      })
      csvContent += row.join(',') + '\n'
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `escala_${sectorName.replace(/\s+/g, '_').toLowerCase()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDoubleClickStaff = async (userId: string) => {
    if (!selectedCycleId || !selectedSectorId) return
    setGeneratingUserId(userId)
    try {
      await pb.send('/backend/v1/generate-staff-schedule', {
        method: 'POST',
        body: JSON.stringify({
          staff_profile_id: userId,
          cycle_id: selectedCycleId,
          sector_id: selectedSectorId,
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      toast({ title: 'Sucesso', description: 'Escala individual gerada com sucesso.' })

      setDraft((prev) => ({ ...prev, [userId]: {} }))
      const newShifts = await pb.collection('shifts').getFullList({
        filter: `cycle="${selectedCycleId}"`,
        expand: 'staff_profile,staff_profile.staff_role,user,sector',
      })
      setAllShifts(newShifts)
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Falha ao gerar escala',
        variant: 'destructive',
      })
    } finally {
      setGeneratingUserId(null)
    }
  }

  const handleSave = async (publish: boolean) => {
    if (!selectedCycleId || !selectedSectorId) return
    setIsSaving(true)
    try {
      const toCreate: any[] = []
      draftUsers.forEach((u) =>
        days.forEach((d) => {
          const dateStr = d.key
          const cell = draft[u.id]?.[dateStr]
          if (cell && cell !== 'F') {
            let st = '07:00:00'
            let duration = 12

            const contract = contracts.find((c) => (c.staff_profile || c.user) === u.id)
            const wh = contract?.expand?.shift_type?.work_hours

            if (cell === 'D') {
              st = '07:00:00'
              duration = wh || 12
            } else if (cell === 'N') {
              st = '19:00:00'
              duration = wh || 12
            } else if (cell === 'M') {
              st = '07:00:00'
              duration = wh || 6
            } else if (cell === 'T') {
              st = '13:00:00'
              duration = wh || 6
            }

            const startDate = new Date(`${dateStr}T${st}.000Z`)
            const endDate = new Date(startDate.getTime() + duration * 3600000)

            const formattedEnd = endDate.toISOString().replace('T', ' ').substring(0, 23) + 'Z'

            toCreate.push({
              staff_profile: u.id,
              sector: selectedSectorId,
              cycle: selectedCycleId,
              start_time: `${dateStr} ${st}.000Z`,
              end_time: formattedEnd,
            })
          }
        }),
      )
      const result = await commitShiftSchedule(
        selectedCycleId,
        selectedSectorId,
        toCreate,
        publish,
        activeDraftRecord?.id,
      )

      if (publish && selectedCycle?.status === 'draft') {
        setCycles((c) => c.map((x) => (x.id === selectedCycleId ? { ...x, status: 'active' } : x)))
        toast({ title: 'Sucesso', description: 'Escala publicada e ativa!' })
      } else {
        toast({
          title: 'Sucesso',
          description:
            result?.warnings?.length > 0
              ? `Escala validada e salva com ${result.warnings.length} aviso(s) de efetivo ideal.`
              : 'Escala validada e salva com segurança.',
        })
      }
      setAllShifts(
        await pb.collection('shifts').getFullList({
          filter: `cycle="${selectedCycleId}"`,
          expand: 'staff_profile,staff_profile.staff_role,user,sector',
        }),
      )
    } catch (err: any) {
      const response = err?.response
      const details = response?.violations
      toast({
        title: 'Escala não salva',
        description:
          Array.isArray(details) && details.length
            ? details.slice(0, 4).join(' • ')
            : response?.error || err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10">
      {isCollectionPast && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
          <Info className="h-4 w-4" /> Coleta de folgas para este ciclo já encerrada.
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleGenerateAI}
            disabled={
              isGenerating ||
              !selectedCycleId ||
              !selectedSectorId ||
              selectedCycle?.status !== 'draft'
            }
            className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm h-9"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Gerar com IA
          </Button>
          <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
            <SelectTrigger className="w-[200px] h-9 bg-white">
              <SelectValue placeholder="Selecione o Ciclo" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} {c.status === 'draft' && '(Rascunho)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedSectorId} onValueChange={setSelectedSectorId}>
            <SelectTrigger className="w-[200px] h-9 bg-white">
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

          <StaffFilter
            staffList={draftUsers}
            selectedStaffId={selectedStaffId}
            onSelectedStaffChange={setSelectedStaffId}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 bg-white flex-1 whitespace-nowrap">
                <UserPlus className="h-4 w-4" /> Add Colaborador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar à Escala (Cobertura intersetorial permitida)</DialogTitle>
              </DialogHeader>
              <Input
                placeholder="Buscar por nome..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
              />
              <ScrollArea className="h-[300px] mt-2 rounded-md border p-2">
                <div className="space-y-2">
                  {users
                    .filter((u) => u.name.toLowerCase().includes(searchUser.toLowerCase()))
                    .map((u) => (
                      <div
                        key={u.id}
                        className="flex justify-between items-center p-2 hover:bg-slate-50 border rounded"
                      >
                        <div>
                          <p className="font-medium text-sm text-slate-800">{u.name}</p>
                          <p className="text-[11px] text-slate-500 uppercase">
                            {u.expand?.staff_role?.name}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={draftUsers.some((d) => d.id === u.id) ? 'secondary' : 'default'}
                          onClick={() => {
                            if (!draftUsers.find((d) => d.id === u.id))
                              setDraftUsers((p) => [...p, u])
                          }}
                          disabled={draftUsers.some((d) => d.id === u.id)}
                        >
                          {draftUsers.some((d) => d.id === u.id) ? 'Adicionado' : 'Adicionar'}
                        </Button>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          <Button
            variant={isEditMode ? 'default' : 'outline'}
            onClick={() => setIsEditMode(!isEditMode)}
            className={cn('gap-2 flex-1 whitespace-nowrap', !isEditMode && 'bg-white')}
          >
            <Move className="h-4 w-4" /> {isEditMode ? 'Concluir Edição' : 'Habilitar Edição'}
          </Button>

          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={isSaving || selectedCycle?.status !== 'draft'}
            className="gap-2 flex-1 bg-white"
          >
            <Save className="h-4 w-4" /> Salvar Rascunho
          </Button>

          <Button
            onClick={() => handleSave(true)}
            disabled={isSaving || selectedCycle?.status !== 'draft'}
            className="gap-2 flex-1 whitespace-nowrap"
          >
            <Send className="h-4 w-4" /> Publicar Escala
          </Button>

          <Button
            variant="outline"
            onClick={exportToCSV}
            className="gap-2 bg-white flex-1 xl:flex-none border-emerald-200 hover:bg-emerald-50 text-emerald-800"
          >
            <Download className="h-4 w-4" /> Exportar
          </Button>

          {(() => {
            const hasScaleData =
              draftUsers.length > 0 &&
              days.length > 0 &&
              Object.keys(draft).some((uid) => Object.keys(draft[uid] || {}).length > 0)

            const handleExportToPdf = () => {
              const allStaffSorted = [...draftUsers].sort((a, b) =>
                (a.name || '').localeCompare(b.name || '', 'pt-BR'),
              )
              const staffNames: Record<string, string> = {}
              const staffRows: string[] = []
              allStaffSorted.forEach((u) => {
                staffNames[u.id] = u.name || `Colaborador ${u.id}`
                staffRows.push(u.id)
              })

              const dateHeaders = days.map((d) => d.key)

              const cellMap: Record<string, Record<string, ShiftSlot>> = {}
              allStaffSorted.forEach((u) => {
                cellMap[u.id] = {}
                dateHeaders.forEach((ds) => {
                  const val = draft[u.id]?.[ds]
                  if (val && val !== 'F') {
                    if (val === 'D') {
                      cellMap[u.id][ds] = { type: 'day', start: '07:00', end: '19:00' }
                    } else if (val === 'N') {
                      cellMap[u.id][ds] = { type: 'night', start: '19:00', end: '07:00' }
                    } else if (val === 'M') {
                      cellMap[u.id][ds] = { type: 'day', start: '07:00', end: '13:00' }
                    } else if (val === 'T') {
                      cellMap[u.id][ds] = { type: 'day', start: '13:00', end: '19:00' }
                    } else {
                      cellMap[u.id][ds] = { type: String(val) }
                    }
                  }
                })
              })

              const cycleStart = (selectedCycle?.start_date || '').split(' ')[0].split('T')[0]
              const cycleEnd = (selectedCycle?.end_date || '').split(' ')[0].split('T')[0]

              exportScalePdf({
                title: 'Escala de Plantões',
                sectorName: selectedSector?.name,
                cycleStart: cycleStart || undefined,
                cycleEnd: cycleEnd || undefined,
                staffNames,
                staffRows,
                dateHeaders,
                cellMap,
                weekendOffMap,
              })

              toast({
                title: 'PDF Gerado',
                description: 'O arquivo PDF da escala foi exportado com sucesso.',
              })
            }

            const exportPdfButton = (
              <Button
                variant="outline"
                disabled={!hasScaleData}
                onClick={handleExportToPdf}
                className="gap-2 bg-white flex-1 xl:flex-none border-blue-200 hover:bg-blue-50 text-blue-800 disabled:opacity-50"
              >
                <FileDown className="h-4 w-4" /> Exportar para PDF
              </Button>
            )

            if (!hasScaleData) {
              return (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="inline-block flex-1 xl:flex-none">
                        {exportPdfButton}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Gere uma escala primeiro</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            }

            return exportPdfButton
          })()}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {generationError && (
          <Alert variant="destructive" className="animate-fade-in">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Falha na Geração de Escala</AlertTitle>
            <AlertDescription className="whitespace-pre-line text-xs">
              {generationError}
            </AlertDescription>
          </Alert>
        )}

        {activeDraftRecord && !hasWeekendOffMetadata && (
          <Alert className="border-amber-300 bg-amber-50/60 text-amber-900 py-2">
            <AlertDescription className="text-xs">
              Rascunho anterior à regra de folga de fim de semana. Gere novamente para aplicar e
              exibir o destaque.
            </AlertDescription>
          </Alert>
        )}

        <div className="relative border rounded-xl bg-white shadow-sm overflow-hidden flex flex-col">
          {isSyncing && (
            <div className="absolute top-2 right-2 z-40 flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full shadow-sm animate-fade-in">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
              <span className="text-xs font-medium text-blue-700">Sincronizando...</span>
            </div>
          )}
          {isLoadingShifts && !isGenerating && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-30 flex items-center justify-center rounded-xl">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                <span className="text-sm text-slate-500">Carregando plantões...</span>
              </div>
            </div>
          )}
          {isGenerating && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-30 flex items-center justify-center rounded-xl">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
                  <Wand2 className="h-5 w-5 text-emerald-600 absolute inset-0 m-auto" />
                </div>
                <p className="text-sm font-medium text-slate-700">Gerando escala com IA...</p>
                <p className="text-xs text-slate-500">
                  Analisando contratos, regras e folgas. Isso pode levar alguns segundos.
                </p>
              </div>
            </div>
          )}
          <ScrollArea className="w-full max-w-[calc(100vw-2rem)]">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-slate-100 border-b border-r p-2 text-left min-w-[150px]">
                    Colaborador
                  </th>
                  {days.map((dayItem) => {
                    const ds = dayItem.key
                    const dc = dailyCounts[ds]
                    return (
                      <th
                        key={ds}
                        className="border-b border-r p-1.5 min-w-[95px] bg-slate-50 text-center relative"
                      >
                        <div className="text-[10px] uppercase text-slate-500">
                          {format(dayItem.date, 'eee', { locale: ptBR })}
                        </div>
                        <div className="text-xs">{format(dayItem.date, 'dd')}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleDraftUsers.map((user) => {
                  const isCov =
                    !allShifts.some(
                      (s) =>
                        (s.staff_profile || s.user) === user.id && s.sector === selectedSectorId,
                    ) && allShifts.some((s) => (s.staff_profile || s.user) === user.id)
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 group">
                      <td
                        className="sticky left-0 z-20 bg-white border-b border-r p-2 shadow-[1px_0_0_0_#e2e8f0] cursor-pointer"
                        onDoubleClick={() => handleDoubleClickStaff(user.id)}
                        title="Duplo clique para preencher a escala automaticamente"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col min-w-0 flex-1">
                            <span
                              className="font-semibold text-slate-800 text-xs break-words whitespace-normal leading-snug flex items-center gap-2"
                              title={user.name}
                            >
                              <span className="break-words whitespace-normal">{user.name}</span>
                              {generatingUserId === user.id && (
                                <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                              )}
                            </span>
                            <span className="text-[9px] text-slate-400 break-words whitespace-normal leading-tight">
                              {user.expand?.staff_role?.name || 'Sem cargo'}{' '}
                              {isCov && (
                                <Badge
                                  variant="secondary"
                                  className="text-[8px] h-3 px-1 ml-1 inline-flex"
                                >
                                  Cobertura
                                </Badge>
                              )}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDraftUsers((p) => p.filter((u) => u.id !== user.id))
                            }}
                            className="text-slate-300 hover:text-red-500 shrink-0 self-start mt-0.5"
                            title="Remover colaborador da escala"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      {days.map((dayItem) => {
                        const ds = dayItem.key
                        const val = draft[user.id]?.[ds] || ''
                        const toReq = timeoffsForCycle.find(
                          (t) =>
                            (t.staff_profile || t.user) === user.id &&
                            t.date.substring(0, 10) === ds,
                        )
                        const isTO = !!toReq
                        const isPendingTO = toReq?.status === 'pending'
                        const isVacation = isVacationDateInclusive(user, ds)
                        const isWeekendDay = dayItem.dayOfWeek === 6 || dayItem.dayOfWeek === 0
                        const isWeekendOff =
                          isWeekendDay &&
                          !isVacation &&
                          (!val || val === 'F') &&
                          (weekendOffMap.get(user.id)?.has(ds) ?? false)

                        const isDraggingCurrentWeekendOff =
                          draggedWeekendOff?.userId === user.id && draggedWeekendOff?.dateStr === ds

                        const isValidWeekendOffDropTarget =
                          draggedWeekendOff &&
                          draggedWeekendOff.userId === user.id &&
                          draggedWeekendOff.weekday === dayItem.dayOfWeek &&
                          draggedWeekendOff.dateStr !== ds

                        const isInvalidWeekendOffDropTarget =
                          draggedWeekendOff &&
                          (draggedWeekendOff.userId !== user.id ||
                            draggedWeekendOff.weekday !== dayItem.dayOfWeek) &&
                          !isWeekendOff

                        return (
                          <td
                            key={ds}
                            data-testid={
                              isWeekendOff && !isTO ? `weekend-off-${user.id}-${ds}` : undefined
                            }
                            className={cn('p-0 border-b border-r relative transition-colors', {
                              'bg-emerald-100 border-2 border-dashed border-emerald-500':
                                dragOverCell?.userId === user.id &&
                                dragOverCell?.dateStr === ds &&
                                (isValidWeekendOffDropTarget || (!draggedWeekendOff && isEditMode)),
                              'bg-emerald-50/70 border-emerald-300':
                                isValidWeekendOffDropTarget &&
                                (dragOverCell?.userId !== user.id || dragOverCell?.dateStr !== ds),
                              'opacity-40 cursor-not-allowed bg-slate-100/60':
                                isInvalidWeekendOffDropTarget,
                              'bg-orange-100':
                                isWeekendOff && !isTO && !isDraggingCurrentWeekendOff,
                              'opacity-50 ring-2 ring-orange-400': isDraggingCurrentWeekendOff,
                              'bg-emerald-50/90': isVacation,
                            })}
                            onDragOver={(e) =>
                              (isEditMode || !!draggedWeekendOff) && !isTO && !isVacation
                                ? handleDragOver(e, user.id, ds)
                                : undefined
                            }
                            onDragLeave={
                              (isEditMode || !!draggedWeekendOff) && !isTO && !isVacation
                                ? handleDragLeave
                                : undefined
                            }
                            onDrop={(e) =>
                              (isEditMode || !!draggedWeekendOff) && !isTO && !isVacation
                                ? handleDrop(e, user.id, ds)
                                : undefined
                            }
                            title={
                              isVacation
                                ? user.vacation_start && user.vacation_end
                                  ? `Férias de ${format(parseISO(user.vacation_start.split(' ')[0]), 'dd/MM')} a ${format(parseISO(user.vacation_end.split(' ')[0]), 'dd/MM')}`
                                  : `Colaborador de férias (${format(new Date(ds + 'T12:00:00Z'), 'dd/MM')})`
                                : isWeekendOff
                                  ? `Fim de semana de folga: ${user.name} em ${ds}`
                                  : undefined
                            }
                            aria-label={
                              isVacation
                                ? user.vacation_start && user.vacation_end
                                  ? `Férias de ${format(parseISO(user.vacation_start.split(' ')[0]), 'dd/MM')} a ${format(parseISO(user.vacation_end.split(' ')[0]), 'dd/MM')}`
                                  : `Colaborador de férias (${format(new Date(ds + 'T12:00:00Z'), 'dd/MM')})`
                                : undefined
                            }
                          >
                            {' '}
                            {/* Box de Folga de Fim de Semana Arrastável (mesmo sem modo edição geral de plantão) */}
                            {isWeekendOff && !isTO && (!val || val === 'F') ? (
                              <div
                                draggable
                                onDragStart={(e) =>
                                  handleWeekendOffDragStart(e, user.id, ds, user.name)
                                }
                                onDragEnd={handleDragEnd}
                                onClick={() => {
                                  // Alternativa acessível: abre modal para mover por teclado/seleção
                                  const dow = dayOfWeekDateOnly(ds)
                                  const validCandidates = days
                                    .filter((d) => d.dayOfWeek === dow && d.key !== ds)
                                    .map((d) => d.key)
                                  setKeyboardMoveModal({
                                    isOpen: true,
                                    userId: user.id,
                                    userName: user.name,
                                    sourceDate: ds,
                                    weekday: dow,
                                    targetDate: validCandidates[0] || '',
                                  })
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    const dow = dayOfWeekDateOnly(ds)
                                    const validCandidates = days
                                      .filter((d) => d.dayOfWeek === dow && d.key !== ds)
                                      .map((d) => d.key)
                                    setKeyboardMoveModal({
                                      isOpen: true,
                                      userId: user.id,
                                      userName: user.name,
                                      sourceDate: ds,
                                      weekday: dow,
                                      targetDate: validCandidates[0] || '',
                                    })
                                  }
                                }}
                                tabIndex={0}
                                role="button"
                                aria-label={`Folga de Fim de Semana de ${user.name} no dia ${ds}. Pressione Enter para mover.`}
                                className={cn(
                                  'w-full h-11 bg-orange-100 border border-orange-300 rounded px-1 py-0.5 text-xs flex flex-col items-center justify-center cursor-grab active:cursor-grabbing hover:bg-orange-200/90 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 select-none group/box',
                                  isDraggingCurrentWeekendOff && 'opacity-30 scale-95',
                                )}
                              >
                                <div className="flex items-center gap-1 max-w-full">
                                  <Move className="h-2.5 w-2.5 text-orange-700 opacity-60 group-hover/box:opacity-100 shrink-0" />
                                  <span
                                    className="font-semibold text-slate-900 text-[11px] break-words whitespace-normal leading-snug text-center"
                                    title={user.name}
                                  >
                                    {user.name}
                                  </span>
                                </div>
                                <span className="text-[10px] text-orange-800 leading-tight text-center">
                                  Folga Fim de Semana
                                </span>
                              </div>
                            ) : isEditMode ? (
                              <div
                                draggable={!!val && val !== 'F'}
                                onDragStart={(e) => {
                                  if (val && val !== 'F') {
                                    handleDragStart(e, user.id, ds, val)
                                  } else {
                                    e.preventDefault()
                                  }
                                }}
                                className={cn(
                                  'w-full min-h-[44px] p-1.5 flex flex-col items-center justify-center text-center text-[11px] md:text-xs transition-colors',
                                  {
                                    'font-bold text-black bg-white':
                                      val === 'D' || val === 'M' || val === 'T',
                                    'font-bold text-black bg-slate-200 hover:bg-slate-300':
                                      val === 'N',
                                    'text-red-400 font-bold bg-red-50/80 hover:bg-red-100':
                                      isTO && !isPendingTO,
                                    'text-amber-500 font-bold bg-amber-50/80 hover:bg-amber-100':
                                      isPendingTO,
                                    'text-emerald-700 font-semibold bg-emerald-50': isVacation,
                                    'cursor-move hover:opacity-80 border-2 border-dashed border-transparent hover:border-slate-400':
                                      !!val && val !== 'F' && !isVacation,
                                    'bg-transparent': (!val || val === 'F') && !isVacation,
                                  },
                                )}
                              >
                                {isVacation && (
                                  <div
                                    className="flex flex-col items-center justify-center text-emerald-700"
                                    title={
                                      user.vacation_start && user.vacation_end
                                        ? `Férias de ${format(parseISO(user.vacation_start.split(' ')[0]), 'dd/MM')} a ${format(parseISO(user.vacation_end.split(' ')[0]), 'dd/MM')}`
                                        : 'Férias'
                                    }
                                    aria-label={
                                      user.vacation_start && user.vacation_end
                                        ? `Férias de ${format(parseISO(user.vacation_start.split(' ')[0]), 'dd/MM')} a ${format(parseISO(user.vacation_end.split(' ')[0]), 'dd/MM')}`
                                        : 'Férias'
                                    }
                                  >
                                    <Palmtree className="h-3 w-3" />
                                    <span className="text-[10px] font-bold">FÉRIAS</span>
                                  </div>
                                )}
                                {val && val !== 'F'
                                  ? (() => {
                                      const periodLetter: 'D' | 'N' = val === 'N' ? 'N' : 'D'
                                      const professionalId = user.professional_id || null
                                      const corenText = formatCorenLabel(professionalId)
                                      const secondLineText = formatShiftCalendarSecondLine(
                                        periodLetter,
                                        professionalId,
                                      )
                                      return (
                                        <div
                                          className="flex items-center justify-center gap-1.5 text-slate-600 text-[11px] min-w-0 break-words whitespace-normal leading-tight font-medium"
                                          title={secondLineText}
                                        >
                                          <span
                                            className={cn(
                                              'font-bold shrink-0 text-xs',
                                              periodLetter === 'N'
                                                ? 'text-indigo-700'
                                                : 'text-emerald-700',
                                            )}
                                          >
                                            {periodLetter}
                                          </span>
                                          <span className="text-slate-400 select-none">•</span>
                                          <span
                                            data-testid={`shift-coren-${user.id}-${ds}`}
                                            className={cn(
                                              'break-words',
                                              !professionalId
                                                ? 'text-slate-400 italic'
                                                : 'text-slate-700',
                                            )}
                                          >
                                            {corenText}
                                          </span>
                                        </div>
                                      )
                                    })()
                                  : val === 'F'
                                    ? 'Folga'
                                    : null}
                              </div>
                            ) : (
                              <div className="relative w-full min-h-[44px] flex flex-col items-center justify-center p-1">
                                {isVacation && (!val || val === 'F') && (
                                  <div
                                    className="pointer-events-none flex flex-col items-center justify-center text-emerald-700 z-10"
                                    title={
                                      user.vacation_start && user.vacation_end
                                        ? `Férias de ${format(parseISO(user.vacation_start.split(' ')[0]), 'dd/MM')} a ${format(parseISO(user.vacation_end.split(' ')[0]), 'dd/MM')}`
                                        : 'Férias'
                                    }
                                    aria-label={
                                      user.vacation_start && user.vacation_end
                                        ? `Férias de ${format(parseISO(user.vacation_start.split(' ')[0]), 'dd/MM')} a ${format(parseISO(user.vacation_end.split(' ')[0]), 'dd/MM')}`
                                        : 'Férias'
                                    }
                                  >
                                    <Palmtree className="h-3 w-3" />
                                    <span className="text-[10px] font-bold">FÉRIAS</span>
                                  </div>
                                )}
                                {val && val !== 'F' ? (
                                  (() => {
                                    const periodLetter: 'D' | 'N' = val === 'N' ? 'N' : 'D'
                                    const professionalId = user.professional_id || null
                                    const corenText = formatCorenLabel(professionalId)
                                    const secondLineText = formatShiftCalendarSecondLine(
                                      periodLetter,
                                      professionalId,
                                    )
                                    return (
                                      <div
                                        className="pointer-events-none flex items-center justify-center gap-1.5 text-slate-600 text-[11px] min-w-0 break-words whitespace-normal leading-tight font-medium z-10"
                                        title={secondLineText}
                                      >
                                        <span
                                          className={cn(
                                            'font-bold shrink-0 text-xs',
                                            periodLetter === 'N'
                                              ? 'text-indigo-700'
                                              : 'text-emerald-700',
                                          )}
                                        >
                                          {periodLetter}
                                        </span>
                                        <span className="text-slate-400 select-none">•</span>
                                        <span
                                          data-testid={`shift-coren-${user.id}-${ds}`}
                                          className={cn(
                                            'break-words',
                                            !professionalId
                                              ? 'text-slate-400 italic'
                                              : 'text-slate-700',
                                          )}
                                        >
                                          {corenText}
                                        </span>
                                      </div>
                                    )
                                  })()
                                ) : val === 'F' ? (
                                  <span className="pointer-events-none text-xs text-slate-700 z-10">
                                    Folga
                                  </span>
                                ) : null}
                                <select
                                  value={val}
                                  onChange={(e) => {
                                    const nextVal = e.target.value as DraftCell
                                    if (nextVal && nextVal !== 'F' && isVacation) {
                                      toast({
                                        title: 'Bloqueio de Férias',
                                        description: `Colaborador está de férias no período (${user.name}).`,
                                        variant: 'destructive',
                                      })
                                      return
                                    }
                                    setDraft((p) => ({
                                      ...p,
                                      [user.id]: {
                                        ...p[user.id],
                                        [ds]: nextVal,
                                      },
                                    }))
                                  }}
                                  disabled={isTO || isVacation || selectedCycle?.status !== 'draft'}
                                  aria-label={`Plantão de ${user.name} em ${ds}`}
                                  className={cn(
                                    'absolute inset-0 w-full h-full appearance-none bg-transparent text-center text-transparent outline-none cursor-pointer hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
                                    {
                                      'bg-white':
                                        (val === 'D' || val === 'M' || val === 'T') && !isVacation,
                                      'bg-slate-200 hover:bg-slate-300': val === 'N' && !isVacation,
                                      'text-red-400 font-bold bg-red-50/80 hover:bg-red-100':
                                        isTO && !isPendingTO,
                                      'text-amber-500 font-bold bg-amber-50/80 hover:bg-amber-100':
                                        isPendingTO,
                                      'bg-emerald-50/60 cursor-not-allowed': isVacation,
                                    },
                                  )}
                                >
                                  <option value="" className="text-slate-900">
                                    {'(Vazio)'}
                                  </option>
                                  <option value="D" className="text-slate-900">
                                    {formatShiftCalendarSecondLine('D', user.professional_id)}
                                  </option>
                                  <option value="N" className="text-slate-900">
                                    {formatShiftCalendarSecondLine('N', user.professional_id)}
                                  </option>
                                  <option value="M" className="text-slate-900">
                                    {formatShiftCalendarSecondLine('D', user.professional_id)}{' '}
                                    (Manhã)
                                  </option>
                                  <option value="T" className="text-slate-900">
                                    {formatShiftCalendarSecondLine('D', user.professional_id)}{' '}
                                    (Tarde)
                                  </option>
                                  <option value="F" className="text-slate-900">
                                    Folga
                                  </option>
                                </select>
                              </div>
                            )}
                            {isTO && (
                              <div
                                className={cn(
                                  'absolute top-0 right-0 p-0.5 opacity-50',
                                  isPendingTO ? 'text-amber-500' : 'text-red-500',
                                )}
                                title={isPendingTO ? 'Folga Pendente' : 'Folga'}
                              >
                                <CalendarOff className="h-2.5 w-2.5" />
                              </div>
                            )}
                            {isVacation && (
                              <div
                                className="absolute top-0 right-0 p-0.5 text-emerald-600 opacity-80"
                                title={
                                  user.vacation_start && user.vacation_end
                                    ? `Férias de ${format(parseISO(user.vacation_start.split(' ')[0]), 'dd/MM')} a ${format(parseISO(user.vacation_end.split(' ')[0]), 'dd/MM')}`
                                    : 'Férias'
                                }
                                aria-label={
                                  user.vacation_start && user.vacation_end
                                    ? `Férias de ${format(parseISO(user.vacation_start.split(' ')[0]), 'dd/MM')} a ${format(parseISO(user.vacation_end.split(' ')[0]), 'dd/MM')}`
                                    : 'Férias'
                                }
                              >
                                <Palmtree className="h-2.5 w-2.5" />
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {/* Legenda do ScalePlanner */}
          <div className="border-t bg-slate-50/70 px-4 py-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <span className="font-semibold text-slate-700 select-none">Legenda:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-white border border-slate-300 font-bold text-[9px] text-emerald-700 inline-flex items-center justify-center">
                D
              </span>
              <span>Plantão D</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-200 border border-slate-300 font-bold text-[9px] text-indigo-700 inline-flex items-center justify-center">
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
        </div>

        {/* Modal de Acessibilidade por Teclado para remanejar Folga de Fim de Semana */}
        <Dialog
          open={keyboardMoveModal.isOpen}
          onOpenChange={(open) => setKeyboardMoveModal((prev) => ({ ...prev, isOpen: open }))}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Move className="h-5 w-5 text-orange-600" />
                Remanejar Folga de Fim de Semana
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div className="bg-slate-50 p-3 rounded-lg border text-xs space-y-1">
                <div>
                  <span className="font-semibold text-slate-700">Colaborador:</span>{' '}
                  {keyboardMoveModal.userName}
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Data Atual:</span>{' '}
                  {keyboardMoveModal.sourceDate} (
                  {keyboardMoveModal.weekday === 6 ? 'Sábado' : 'Domingo'})
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Regra:{' '}
                  {keyboardMoveModal.weekday === 6
                    ? 'Sábado só pode ir para Sábado'
                    : 'Domingo só para Domingo'}{' '}
                  do mesmo ciclo.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">
                  Nova Data de Folga ({keyboardMoveModal.weekday === 6 ? 'Sábados' : 'Domingos'} no
                  ciclo):
                </label>
                <Select
                  value={keyboardMoveModal.targetDate}
                  onValueChange={(val) =>
                    setKeyboardMoveModal((prev) => ({ ...prev, targetDate: val }))
                  }
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Selecione o destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {days
                      .filter(
                        (d) =>
                          d.dayOfWeek === keyboardMoveModal.weekday &&
                          d.key !== keyboardMoveModal.sourceDate,
                      )
                      .map((d) => (
                        <SelectItem key={d.key} value={d.key}>
                          {format(d.date, 'dd/MM/yyyy (EEEE)', { locale: ptBR })}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setKeyboardMoveModal((prev) => ({ ...prev, isOpen: false }))}
                >
                  Cancelar
                </Button>
                <Button
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                  disabled={!keyboardMoveModal.targetDate}
                  onClick={async () => {
                    const { userId, sourceDate, targetDate, userName } = keyboardMoveModal
                    setKeyboardMoveModal((prev) => ({ ...prev, isOpen: false }))
                    await executeMoveWeekendOff(userId, sourceDate, targetDate, userName)
                  }}
                >
                  Confirmar Remanejamento
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Alert Panel Below Calendar */}
        <div className="border rounded-lg bg-slate-50/80 p-4 shadow-sm mt-2">
          <h3 className="font-semibold mb-4 text-slate-800 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-slate-500" />
            Alertas e Validações
          </h3>

          {validations.length === 0 ? (
            <div className="text-sm text-slate-500 italic flex items-center gap-2 p-4 bg-white rounded-md border border-dashed">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Nenhum alerta para o setor selecionado. Escala validada.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {validations.map((v, i) => {
                const isError =
                  v.toLowerCase().includes('falta') ||
                  v.toLowerCase().includes('abaixo do efetivo mínimo') ||
                  v.toLowerCase().includes('< mínimo') ||
                  v.toLowerCase().includes('excede') ||
                  v.toLowerCase().includes('sem descanso') ||
                  v.toLowerCase().includes('sem fim de semana completo de folga')
                return (
                  <Alert
                    key={i}
                    variant={isError ? 'destructive' : 'default'}
                    className={cn(
                      !isError && 'border-amber-500/50 text-amber-800 bg-amber-50/50',
                      'bg-white',
                    )}
                  >
                    {isError ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                    <AlertTitle className="text-sm font-medium">
                      {isError ? 'Violação de Regra' : 'Aviso de Dimensionamento'}
                    </AlertTitle>
                    <AlertDescription className="text-xs mt-1">{v}</AlertDescription>
                  </Alert>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
