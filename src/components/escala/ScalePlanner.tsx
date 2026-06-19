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
import { getShiftCycles, getHospitalSectors, getUsers } from '@/services/escala'
import { AlertCircle, CheckCircle2, UserPlus, Save, Wand2, Trash2 } from 'lucide-react'
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
  const [allShifts, setAllShifts] = useState<any[]>([])

  const [selectedCycleId, setSelectedCycleId] = useState<string>('')
  const [selectedSectorId, setSelectedSectorId] = useState<string>('')
  const [draftUsers, setDraftUsers] = useState<any[]>([])
  const [draft, setDraft] = useState<Record<string, Record<string, DraftCell>>>({})
  const [isSaving, setIsSaving] = useState(false)

  const { toast } = useToast()

  useEffect(() => {
    Promise.all([getShiftCycles(), getHospitalSectors(departmentId), getUsers()]).then(
      ([c, s, u]) => {
        setCycles(c)
        setSectors(s)
        setUsers(u.filter((user: any) => user.expand?.staff_role))
        if (c.length > 0)
          setSelectedCycleId(c.find((x: any) => x.status === 'active')?.id || c[0].id)
        if (s.length > 0) setSelectedSectorId(s[0].id)
      },
    )
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

  const handleAddUser = (user: any) => {
    if (!draftUsers.find((u) => u.id === user.id)) {
      setDraftUsers((prev) => [...prev, user])
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

    days.forEach((day) => {
      const dateStr = format(day, 'yyyy-MM-dd')
      let staffCount = 0
      let hasSupervisor = false

      draftUsers.forEach((user) => {
        const cell = draft[user.id]?.[dateStr]
        if (cell && cell !== 'F') {
          staffCount++
          if (user.expand?.staff_role?.requires_supervision === false) {
            hasSupervisor = true
          }

          // Double allocation check
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

      if (staffCount > 0 && staffCount < (selectedSector.min_staffing || 0)) {
        alerts.push(
          `Dia ${format(day, 'dd/MM')}: Abaixo do efetivo mínimo (${staffCount}/${selectedSector.min_staffing})`,
        )
      }
      if (staffCount > 0 && !hasSupervisor) {
        alerts.push(`Dia ${format(day, 'dd/MM')}: Faltam Enfermeiros (Supervisão)`)
      }
    })
    return Array.from(new Set(alerts))
  }, [days, draft, draftUsers, selectedSector, allShifts])

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
      days.forEach((day, j) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        if ((i + j) % 2 === 0) {
          newDraft[user.id][dateStr] = 'D'
        } else {
          newDraft[user.id][dateStr] = 'F'
        }
      })
    })
    setDraft(newDraft)
    toast({ title: 'Sugestão Aplicada', description: 'Template base 12x36 preenchido.' })
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
            <SelectTrigger className="w-[180px] bg-slate-50">
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
            <SelectTrigger className="w-[180px] bg-slate-50">
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

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 bg-white flex-1 md:flex-auto">
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
            variant="secondary"
            onClick={handleAutoSuggest}
            className="gap-2 flex-1 md:flex-auto"
          >
            <Wand2 className="h-4 w-4" /> Sugerir
          </Button>

          <Button onClick={handleSave} disabled={isSaving} className="gap-2 flex-1 md:flex-auto">
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
                        return (
                          <td key={dateStr} className="p-0 border-b border-r relative">
                            <select
                              value={val}
                              onChange={(e) =>
                                updateCell(user.id, dateStr, e.target.value as DraftCell)
                              }
                              className={cn(
                                'w-full h-11 appearance-none bg-transparent text-center text-xs outline-none cursor-pointer hover:bg-slate-100 focus:bg-primary/10 transition-colors',
                                {
                                  'font-bold text-blue-600': val === 'D',
                                  'font-bold text-indigo-900': val === 'N',
                                  'font-bold text-amber-600': val === 'M',
                                  'font-bold text-orange-700': val === 'T',
                                  'text-slate-300': val === 'F',
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
                  <p className="text-xs font-medium">Draft validado e sem conflitos.</p>
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
