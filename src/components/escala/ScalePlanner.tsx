import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  getUsers,
  getStaffContracts,
  getTimeoffRequests,
} from '@/services/escala'
import {
  AlertCircle,
  CheckCircle2,
  UserPlus,
  Save,
  Wand2,
  Trash2,
  Download,
  CalendarOff,
  Info,
} from 'lucide-react'
import { format, eachDayOfInterval, addDays, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import pb from '@/lib/pocketbase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

type DraftCell = 'D' | 'N' | 'M' | 'T' | 'F' | ''

export function ScalePlanner({ departmentId }: { departmentId?: string }) {
  const [cycles, setCycles] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [timeoffs, setTimeoffs] = useState<any[]>([])
  const [allShifts, setAllShifts] = useState<any[]>([])

  const [selectedCycleId, setSelectedCycleId] = useState<string>('')
  const [selectedSectorId, setSelectedSectorId] = useState<string>('')
  const [draftUsers, setDraftUsers] = useState<any[]>([])
  const [draft, setDraft] = useState<Record<string, Record<string, DraftCell>>>({})
  const [isSaving, setIsSaving] = useState(false)

  const { toast } = useToast()

  const currentDay = new Date().getDate()
  const isCollectionPast = currentDay > 10

  useEffect(() => {
    Promise.all([
      getShiftCycles(),
      getHospitalSectors(departmentId),
      getUsers(),
      getStaffContracts(),
      getTimeoffRequests(),
    ]).then(([c, s, u, cont, to]) => {
      setCycles(c)
      setSectors(s)
      setUsers(u.filter((user: any) => user.expand?.staff_role))
      setContracts(cont)
      setTimeoffs(to)
      if (c.length > 0) setSelectedCycleId(c.find((x: any) => x.status === 'active')?.id || c[0].id)
      if (s.length > 0) setSelectedSectorId(s[0].id)
    })
  }, [departmentId])

  useEffect(() => {
    if (selectedCycleId) {
      pb.collection('shifts')
        .getFullList({ filter: `cycle="${selectedCycleId}"` })
        .then(setAllShifts)
    }
  }, [selectedCycleId])

  const selectedCycle = useMemo(
    () => cycles.find((c) => c.id === selectedCycleId),
    [cycles, selectedCycleId],
  )
  const selectedSector = useMemo(
    () => sectors.find((s) => s.id === selectedSectorId),
    [sectors, selectedSectorId],
  )

  const days = useMemo(() => {
    if (!selectedCycle) return []
    try {
      const start = parseISO(selectedCycle.start_date.split(' ')[0])
      const end = parseISO(selectedCycle.end_date.split(' ')[0])
      return eachDayOfInterval({ start, end })
    } catch {
      return []
    }
  }, [selectedCycle])

  const timeoffsForCycle = useMemo(() => {
    return timeoffs.filter((t) => t.cycle === selectedCycleId && t.status === 'fulfilled')
  }, [timeoffs, selectedCycleId])

  const handleAddUser = (user: any) => {
    if (!draftUsers.find((u) => u.id === user.id)) {
      setDraftUsers((prev) => [...prev, user])

      const userTimeoffs = timeoffsForCycle.filter((t) => t.user === user.id)
      if (userTimeoffs.length > 0) {
        setDraft((prev) => {
          const newDraft = { ...prev }
          if (!newDraft[user.id]) newDraft[user.id] = {}
          userTimeoffs.forEach((t) => {
            const dateStr = t.date.substring(0, 10)
            newDraft[user.id][dateStr] = 'F'
          })
          return newDraft
        })
      }
    }
  }

  const handleRemoveUser = (userId: string) => {
    setDraftUsers((prev) => prev.filter((u) => u.id !== userId))
    setDraft((prev) => {
      const newDraft = { ...prev }
      delete newDraft[userId]
      return newDraft
    })
  }

  const updateCell = (userId: string, dateStr: string, value: DraftCell) => {
    setDraft((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {}),
        [dateStr]: value,
      },
    }))
  }

  const validations = useMemo(() => {
    if (!selectedSector || days.length === 0) return []
    const alerts: string[] = []

    const minStaff = Math.max(
      selectedSector.min_staffing || 0,
      selectedSector.bed_capacity ? Math.ceil(selectedSector.bed_capacity / 10) : 0,
      2,
    )

    days.forEach((day) => {
      const dateStr = format(day, 'yyyy-MM-dd')
      let staffCount = 0
      let hasSupervisor = false
      let requiresSupervisionCount = 0

      draftUsers.forEach((user) => {
        const cell = draft[user.id]?.[dateStr]
        if (cell && cell !== 'F') {
          staffCount++
          if (user.expand?.staff_role?.requires_supervision === false) {
            hasSupervisor = true
          } else {
            requiresSupervisionCount++
          }

          if (
            allShifts.some(
              (s) =>
                s.user === user.id &&
                s.start_time.startsWith(dateStr) &&
                s.sector !== selectedSectorId,
            )
          ) {
            alerts.push(
              `${user.name} já possui plantão dia ${format(day, 'dd/MM')} em outro setor.`,
            )
          }
        }
      })

      if (staffCount > 0 && staffCount < minStaff) {
        alerts.push(
          `Dia ${format(day, 'dd/MM')}: Abaixo do efetivo mínimo (${staffCount}/${minStaff})`,
        )
      }
      if (requiresSupervisionCount > 0 && !hasSupervisor) {
        alerts.push(`Dia ${format(day, 'dd/MM')}: Falta Enfermeiro p/ supervisão de Técnicos`)
      }
    })

    draftUsers.forEach((user) => {
      const contract = contracts.find((c) => c.user === user.id)
      const maxHours = contract?.monthly_hour_limit || 180
      let userHours = 0
      let consecutive12h = 0
      let lastShift12h = false

      days.forEach((day) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const cell = draft[user.id]?.[dateStr]
        if (cell === 'D' || cell === 'N') {
          userHours += 12
          if (lastShift12h) consecutive12h++
          lastShift12h = true
        } else if (cell === 'M' || cell === 'T') {
          userHours += 6
          lastShift12h = false
        } else {
          lastShift12h = false
        }
      })

      if (userHours > maxHours) {
        alerts.push(`${user.name} excede o limite de ${maxHours}h (Total: ${userHours}h)`)
      }
      if (consecutive12h > 0) {
        alerts.push(`${user.name} possui turnos de 12h consecutivos (Risco de Fadiga)`)
      }
    })

    return Array.from(new Set(alerts))
  }, [days, draft, draftUsers, selectedSector, allShifts, contracts])

  const handleSave = async () => {
    if (!selectedCycleId || !selectedSectorId) return
    if (validations.some((v) => v.includes('em outro setor'))) {
      toast({
        title: 'Conflito de Alocação',
        description: 'Remova os conflitos intersetoriais antes de salvar.',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    const shiftsToCreate: any[] = []

    draftUsers.forEach((user) => {
      days.forEach((day) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const cell = draft[user.id]?.[dateStr]
        if (cell && cell !== 'F') {
          let startTime = ''
          let endTime = ''
          if (cell === 'D') {
            startTime = '07:00:00'
            endTime = '19:00:00'
          } else if (cell === 'N') {
            startTime = '19:00:00'
            endTime = '07:00:00'
          } else if (cell === 'M') {
            startTime = '07:00:00'
            endTime = '13:00:00'
          } else if (cell === 'T') {
            startTime = '13:00:00'
            endTime = '19:00:00'
          }

          let startFull = `${dateStr} ${startTime}`
          let endFull =
            cell === 'N'
              ? `${format(addDays(day, 1), 'yyyy-MM-dd')} ${endTime}`
              : `${dateStr} ${endTime}`

          shiftsToCreate.push({
            user: user.id,
            sector: selectedSectorId,
            cycle: selectedCycleId,
            start_time: startFull,
            end_time: endFull,
          })
        }
      })
    })

    if (shiftsToCreate.length === 0) {
      toast({ title: 'Aviso', description: 'Nenhum plantão preenchido para salvar.' })
      setIsSaving(false)
      return
    }

    try {
      for (const shift of shiftsToCreate) {
        await pb.collection('shifts').create(shift)
      }

      try {
        await pb.collection('audit_logs').create({
          user: pb.authStore.record?.id,
          action: 'create_shifts',
          department: departmentId || 'Geral',
          details: `Generated ${shiftsToCreate.length} shifts for sector ${selectedSector?.name} in cycle ${selectedCycle?.name}`,
        })
      } catch (err) {
        console.error('Audit log failed', err)
      }

      toast({ title: 'Sucesso', description: 'Escala salva e publicada com sucesso!' })
      const updatedShifts = await pb
        .collection('shifts')
        .getFullList({ filter: `cycle="${selectedCycleId}"` })
      setAllShifts(updatedShifts)
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleAutoSuggest = () => {
    if (draftUsers.length === 0) {
      toast({ title: 'Aviso', description: 'Adicione colaboradores ao rascunho primeiro.' })
      return
    }
    const newDraft = { ...draft }
    draftUsers.forEach((user, i) => {
      if (!newDraft[user.id]) newDraft[user.id] = {}

      const contract = contracts.find((c) => c.user === user.id)
      const maxHours = contract?.monthly_hour_limit || 180
      let currentHours = 0

      days.forEach((day, j) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const isTimeoff = timeoffsForCycle.some(
          (t) => t.user === user.id && t.date.substring(0, 10) === dateStr,
        )

        if (isTimeoff) {
          newDraft[user.id][dateStr] = 'F'
        } else {
          if ((i + j) % 2 === 0 && currentHours + 12 <= maxHours) {
            newDraft[user.id][dateStr] = 'D'
            currentHours += 12
          } else {
            newDraft[user.id][dateStr] = 'F'
          }
        }
      })
    })
    setDraft(newDraft)
    toast({
      title: 'Sugestão Aplicada',
      description: 'Template base preenchido respeitando limites e folgas.',
    })
  }

  const handleExportCSV = () => {
    if (!selectedSector || !selectedCycle || draftUsers.length === 0) return
    let csv = 'Colaborador,Funcao,' + days.map((d) => format(d, 'dd/MM')).join(',') + '\n'
    draftUsers.forEach((user) => {
      const row = [user.name, user.expand?.staff_role?.name || '']
      days.forEach((day) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        row.push(draft[user.id]?.[dateStr] || '')
      })
      csv += row.join(',') + '\n'
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `Escala_${selectedSector.name.replace(/\s+/g, '_')}_${selectedCycle.name.replace(/\s+/g, '_')}.csv`
    link.click()
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10">
      {isCollectionPast && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-3 py-2 rounded-lg flex items-center gap-2 mb-2">
          <Info className="h-4 w-4" />
          A etapa de coleta de pretensões de folga para o ciclo vigente já foi encerrada (prazo: dia
          10).
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
            <SelectTrigger className="w-[200px] bg-slate-50">
              <SelectValue placeholder="Selecione o Ciclo" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedSectorId} onValueChange={setSelectedSectorId}>
            <SelectTrigger className="w-[200px] bg-slate-50">
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

        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 bg-white flex-1 md:flex-auto whitespace-nowrap"
              >
                <UserPlus className="h-4 w-4" /> Add Colaborador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Colaborador à Escala</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[300px] mt-2 rounded-md border p-2">
                <div className="space-y-2">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="flex justify-between items-center p-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-200"
                    >
                      <div>
                        <p className="font-medium text-sm text-slate-800">{u.name || 'Sem nome'}</p>
                        <p className="text-[11px] text-slate-500 uppercase tracking-wider">
                          {u.expand?.staff_role?.name}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={draftUsers.some((d) => d.id === u.id) ? 'secondary' : 'default'}
                        onClick={() => handleAddUser(u)}
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
            variant="outline"
            onClick={handleExportCSV}
            className="gap-2 flex-1 md:flex-auto bg-white whitespace-nowrap"
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>

          <Button
            variant="secondary"
            onClick={handleAutoSuggest}
            className="gap-2 flex-1 md:flex-auto whitespace-nowrap"
          >
            <Wand2 className="h-4 w-4" /> Sugerir
          </Button>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2 flex-1 md:flex-auto whitespace-nowrap"
          >
            <Save className="h-4 w-4" /> {isSaving ? 'Salvando...' : 'Gerar Escala'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 border rounded-xl bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="p-3 border-b bg-slate-50 flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> D: Dia (12h)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-800" /> N: Noite (12h)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> M: Manhã (6h)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-600" /> T: Tarde (6h)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-300" /> F: Folga
              </span>
            </div>
          </div>

          <ScrollArea className="w-full max-w-[calc(100vw-2rem)]">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-slate-100 border-b border-r p-2 text-left min-w-[150px] font-semibold text-slate-700 shadow-[1px_0_0_0_#e2e8f0]">
                    Colaborador
                  </th>
                  {days.map((day) => (
                    <th
                      key={day.toISOString()}
                      className="border-b border-r p-1.5 min-w-[36px] bg-slate-50 text-center font-medium"
                    >
                      <div className="text-[10px] uppercase text-slate-500">
                        {format(day, 'eee', { locale: ptBR })}
                      </div>
                      <div className="text-xs">{format(day, 'dd')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draftUsers.length === 0 ? (
                  <tr>
                    <td colSpan={days.length + 1} className="p-8 text-center text-muted-foreground">
                      Nenhum colaborador adicionado ao rascunho de planejamento.
                    </td>
                  </tr>
                ) : (
                  draftUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 group">
                      <td className="sticky left-0 z-20 bg-white group-hover:bg-slate-50/90 border-b border-r p-2 shadow-[1px_0_0_0_#e2e8f0]">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col overflow-hidden">
                            <span className="font-medium text-xs truncate max-w-[120px]">
                              {user.name}
                            </span>
                            <span className="text-[9px] text-slate-400 truncate max-w-[120px]">
                              {user.expand?.staff_role?.name}
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveUser(user.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      {days.map((day) => {
                        const dateStr = format(day, 'yyyy-MM-dd')
                        const val = draft[user.id]?.[dateStr] || ''
                        const isTimeoff = timeoffsForCycle.some(
                          (t) => t.user === user.id && t.date.substring(0, 10) === dateStr,
                        )

                        return (
                          <td key={dateStr} className="p-0 border-b border-r relative">
                            <select
                              value={val}
                              onChange={(e) =>
                                updateCell(user.id, dateStr, e.target.value as DraftCell)
                              }
                              disabled={isTimeoff}
                              className={cn(
                                'w-full h-11 appearance-none bg-transparent text-center text-xs outline-none cursor-pointer hover:bg-slate-100 focus:bg-primary/10 transition-colors disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50',
                                {
                                  'font-bold text-blue-600': val === 'D',
                                  'font-bold text-indigo-900': val === 'N',
                                  'font-bold text-amber-600': val === 'M',
                                  'font-bold text-orange-700': val === 'T',
                                  'text-slate-300': val === 'F' && !isTimeoff,
                                  'text-red-400 font-bold bg-red-50': isTimeoff,
                                },
                              )}
                            >
                              <option value=""></option>
                              <option value="D">D</option>
                              <option value="N">N</option>
                              <option value="M">M</option>
                              <option value="T">T</option>
                              <option value="F">F</option>
                            </select>
                            {isTimeoff && (
                              <div
                                className="absolute top-0 right-0 p-0.5 pointer-events-none text-red-500 opacity-50"
                                title="Folga/Férias Aprovada"
                              >
                                <CalendarOff className="h-2.5 w-2.5" />
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        <div className="lg:col-span-1 flex flex-col gap-4">
          <Card className="border-amber-200 bg-amber-50/30 flex-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800">
                <AlertCircle className="h-4 w-4" />
                Validação em Tempo Real
              </CardTitle>
            </CardHeader>
            <CardContent>
              {validations.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-4 text-green-700 gap-2">
                  <CheckCircle2 className="h-8 w-8" />
                  <p className="text-xs font-medium">Escala validada e sem conflitos.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {validations.map((v, i) => (
                    <li
                      key={i}
                      className="text-xs text-amber-800 bg-amber-100/50 p-2 rounded flex items-start gap-2"
                    >
                      <span className="mt-0.5">•</span> <span>{v}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
