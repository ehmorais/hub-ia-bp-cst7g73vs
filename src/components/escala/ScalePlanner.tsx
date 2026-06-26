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
  getUsers,
  getStaffContracts,
  getTimeoffRequests,
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
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

type DraftCell = 'D' | 'N' | 'M' | 'T' | 'F' | ''

export function ScalePlanner({
  departmentId,
  projectId,
}: {
  departmentId?: string
  projectId?: string
}) {
  const [cycles, setCycles] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [timeoffs, setTimeoffs] = useState<any[]>([])
  const [allShifts, setAllShifts] = useState<any[]>([])

  const [projectDeps, setProjectDeps] = useState<string[]>([])

  useEffect(() => {
    if (projectId) {
      pb.collection('projects')
        .getOne(projectId)
        .then((p) => {
          setProjectDeps([p.department, ...(p.associated_departments || [])])
        })
    } else if (departmentId) {
      setProjectDeps([departmentId])
    }
  }, [projectId, departmentId])

  const [selectedCycleId, setSelectedCycleId] = useState<string>('')
  const [selectedSectorId, setSelectedSectorId] = useState<string>('')
  const [draftUsers, setDraftUsers] = useState<any[]>([])
  const [draft, setDraft] = useState<Record<string, Record<string, DraftCell>>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [searchUser, setSearchUser] = useState('')
  const [generatingUserId, setGeneratingUserId] = useState<string | null>(null)

  const { toast } = useToast()
  const isCollectionPast = new Date().getDate() > 10

  useEffect(() => {
    Promise.all([
      getShiftCycles(),
      pb.collection('hospital_sectors').getFullList({ expand: 'department', sort: 'name' }),
      getUsers(),
      getStaffContracts(),
      getTimeoffRequests(),
    ]).then(([c, sRaw, u, cont, to]) => {
      setCycles(c)

      let s = sRaw
      if (projectDeps.length > 0) {
        s = sRaw.filter((sec: any) => projectDeps.includes(sec.department))
      }
      setSectors(s)

      setUsers(u.filter((user: any) => user.expand?.staff_role))
      setContracts(cont)
      setTimeoffs(to)
      if (c.length > 0)
        setSelectedCycleId(
          c.find((x: any) => x.status === 'draft' || x.status === 'active')?.id || c[0].id,
        )
      if (s.length > 0) setSelectedSectorId(s[0].id)
    })
  }, [projectDeps])

  useEffect(() => {
    if (selectedCycleId)
      pb.collection('shifts')
        .getFullList({ filter: `cycle="${selectedCycleId}"` })
        .then(setAllShifts)
  }, [selectedCycleId])

  useEffect(() => {
    if (!selectedCycleId || !selectedSectorId || allShifts.length === 0) return
    const sectorShifts = allShifts.filter((s) => s.sector === selectedSectorId)
    const newDraft: Record<string, Record<string, DraftCell>> = {}
    const newUsers = new Map<string, any>()

    sectorShifts.forEach((s) => {
      const u = users.find((x) => x.id === s.user)
      if (u) newUsers.set(u.id, u)
      if (!newDraft[s.user]) newDraft[s.user] = {}

      const dateStr = s.start_time.split(' ')[0]
      const sh = s.start_time.split(' ')[1]
      const eh = s.end_time.split(' ')[1]

      let val: DraftCell = ''
      if (sh === '07:00:00' && eh === '19:00:00') val = 'D'
      if (sh === '19:00:00' && eh === '07:00:00') val = 'N'
      if (sh === '07:00:00' && eh === '13:00:00') val = 'M'
      if (sh === '13:00:00' && eh === '19:00:00') val = 'T'

      if (val) newDraft[s.user][dateStr] = val
    })

    draftUsers.forEach((u) => newUsers.set(u.id, u))
    setDraftUsers(Array.from(newUsers.values()))
    setDraft((prev) => ({ ...prev, ...newDraft }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allShifts, selectedSectorId, selectedCycleId])

  const selectedCycle = useMemo(
    () => cycles.find((c) => c.id === selectedCycleId),
    [cycles, selectedCycleId],
  )
  const selectedSector = useMemo(
    () => sectors.find((s) => s.id === selectedSectorId),
    [sectors, selectedSectorId],
  )
  const days = useMemo(() => {
    try {
      return selectedCycle
        ? eachDayOfInterval({
            start: parseISO(selectedCycle.start_date.split(' ')[0]),
            end: parseISO(selectedCycle.end_date.split(' ')[0]),
          })
        : []
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

    days.forEach((day) => {
      const ds = format(day, 'yyyy-MM-dd')
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

  const validations = useMemo(() => {
    if (!selectedSector || days.length === 0) return []
    const alerts: string[] = []
    const isEm = selectedSector.is_critical || selectedSector.name.toLowerCase().includes('ps')
    const fReq = selectedSector.bed_capacity
      ? Math.ceil(selectedSector.bed_capacity / (selectedSector.staffing_ratio || 10))
      : 0

    days.forEach((day) => {
      const dateStr = format(day, 'yyyy-MM-dd')
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
        alerts.push(`Dia ${format(day, 'dd/MM')}: Falta Enfermeiro p/ supervisão`)
      if (isEm) {
        if (count < 2) alerts.push(`Dia ${format(day, 'dd/MM')}: Emergência < mínimo (2)`)
        else if (count < 3) alerts.push(`Dia ${format(day, 'dd/MM')}: Emergência < ideal (3)`)
      } else if (fReq > 0) {
        if (count < fReq)
          alerts.push(`Dia ${format(day, 'dd/MM')}: Andar < efetivo (${count}/${fReq})`)
      } else if (count > 0 && count < (selectedSector.min_staffing || 0)) {
        alerts.push(`Dia ${format(day, 'dd/MM')}: Abaixo do efetivo mínimo`)
      }
    })

    draftUsers.forEach((user) => {
      const contract = contracts.find((c) => c.user === user.id)
      const maxH = contract?.monthly_hour_limit || 180
      const stName = contract?.expand?.shift_type?.name || ''
      let uh = 0,
        lastEnd: Date | null = null

      days.forEach((day) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const cell = draft[user.id]?.[dateStr]
        const isTO = timeoffsForCycle.some(
          (t) => t.user === user.id && t.date.substring(0, 10) === dateStr,
        )

        if (cell && cell !== 'F') {
          if (isTO) {
            const reqStatus = timeoffsForCycle.find(
              (t) => t.user === user.id && t.date.substring(0, 10) === dateStr,
            )?.status
            alerts.push(
              `${user.name} alocado em dia de folga ${reqStatus === 'pending' ? '(pendente)' : ''} (${format(day, 'dd/MM')})`,
            )
          }

          const wh = contract?.expand?.shift_type?.work_hours || 12
          const restH = contract?.expand?.shift_type?.rest_hours || 36

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

          const cs = new Date(day)
          cs.setHours(stHour, 0, 0, 0)

          if (lastEnd && (cs.getTime() - lastEnd.getTime()) / 3600000 < restH) {
            alerts.push(`${user.name} sem descanso de ${restH}h (${format(day, 'dd/MM')})`)
          }

          lastEnd = new Date(cs.getTime() + duration * 3600000)
        }
      })
      if (uh > maxH) alerts.push(`${user.name} excede o limite mensal (Total: ${uh}h / ${maxH}h)`)
    })
    return Array.from(new Set(alerts))
  }, [days, draft, draftUsers, selectedSector, contracts, timeoffsForCycle])

  const exportToCSV = () => {
    if (!selectedCycleId || !selectedSectorId) return
    const sectorName = selectedSector?.name || 'Setor'
    const cycleName = selectedCycle?.name || 'Ciclo'

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
    csvContent += `Escala: ${sectorName} - ${cycleName}\n\n`

    const headers = ['Colaborador', 'Cargo', ...days.map((d) => format(d, 'dd/MM/yyyy'))]
    csvContent += headers.join(',') + '\n'

    draftUsers.forEach((user) => {
      const row = [user.name, user.expand?.staff_role?.name || '']
      days.forEach((day) => {
        const ds = format(day, 'yyyy-MM-dd')
        const cell = draft[user.id]?.[ds] || ''
        row.push(cell)
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
          user_id: userId,
          cycle_id: selectedCycleId,
          sector_id: selectedSectorId,
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      toast({ title: 'Sucesso', description: 'Escala individual gerada com sucesso.' })

      setDraft((prev) => ({ ...prev, [userId]: {} }))
      const newShifts = await pb
        .collection('shifts')
        .getFullList({ filter: `cycle="${selectedCycleId}"` })
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
      const existing = allShifts.filter((s) => s.sector === selectedSectorId)
      for (const s of existing) await pb.collection('shifts').delete(s.id)

      const toCreate: any[] = []
      draftUsers.forEach((u) =>
        days.forEach((d) => {
          const dateStr = format(d, 'yyyy-MM-dd')
          const cell = draft[u.id]?.[dateStr]
          if (cell && cell !== 'F') {
            let st = '07:00:00'
            let duration = 12

            const contract = contracts.find((c) => c.user === u.id)
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
              user: u.id,
              sector: selectedSectorId,
              cycle: selectedCycleId,
              start_time: `${dateStr} ${st}.000Z`,
              end_time: formattedEnd,
            })
          }
        }),
      )
      for (const s of toCreate) await pb.collection('shifts').create(s)

      if (publish && selectedCycle?.status === 'draft') {
        await pb.collection('shift_cycles').update(selectedCycleId, { status: 'active' })
        setCycles((c) => c.map((x) => (x.id === selectedCycleId ? { ...x, status: 'active' } : x)))
        toast({ title: 'Sucesso', description: 'Escala publicada e ativa!' })
      } else {
        toast({ title: 'Sucesso', description: 'Rascunho salvo localmente.' })
      }
      setAllShifts(
        await pb.collection('shifts').getFullList({ filter: `cycle="${selectedCycleId}"` }),
      )
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
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
          <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
            <SelectTrigger className="w-[200px]">
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
            <SelectTrigger className="w-[200px]">
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
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="border rounded-xl bg-white shadow-sm overflow-hidden flex flex-col">
          <ScrollArea className="w-full max-w-[calc(100vw-2rem)]">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-slate-100 border-b border-r p-2 text-left min-w-[150px]">
                    Colaborador
                  </th>
                  {days.map((day) => {
                    const ds = format(day, 'yyyy-MM-dd')
                    const dc = dailyCounts[ds]
                    return (
                      <th
                        key={day.toISOString()}
                        className="border-b border-r p-1.5 min-w-[36px] bg-slate-50 text-center relative"
                      >
                        <div className="text-[10px] uppercase text-slate-500">
                          {format(day, 'eee', { locale: ptBR })}
                        </div>
                        <div className="text-xs">{format(day, 'dd')}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {draftUsers.map((user) => {
                  const isCov =
                    !allShifts.some((s) => s.user === user.id && s.sector === selectedSectorId) &&
                    allShifts.some((s) => s.user === user.id)
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 group">
                      <td
                        className="sticky left-0 z-20 bg-white border-b border-r p-2 shadow-[1px_0_0_0_#e2e8f0] cursor-pointer"
                        onDoubleClick={() => handleDoubleClickStaff(user.id)}
                        title="Duplo clique para preencher a escala automaticamente"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="font-medium text-xs truncate max-w-[120px] flex items-center gap-2">
                              {user.name}
                              {generatingUserId === user.id && (
                                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                              )}
                            </span>
                            <span className="text-[9px] text-slate-400">
                              {user.expand?.staff_role?.name}{' '}
                              {isCov && (
                                <Badge variant="secondary" className="text-[8px] h-3 px-1 ml-1">
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
                            className="text-slate-300 hover:text-red-500"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      {days.map((day) => {
                        const ds = format(day, 'yyyy-MM-dd')
                        const val = draft[user.id]?.[ds] || ''
                        const toReq = timeoffsForCycle.find(
                          (t) => t.user === user.id && t.date.substring(0, 10) === ds,
                        )
                        const isTO = !!toReq
                        const isPendingTO = toReq?.status === 'pending'
                        return (
                          <td key={ds} className="p-0 border-b border-r relative">
                            <select
                              value={val}
                              onChange={(e) =>
                                setDraft((p) => ({
                                  ...p,
                                  [user.id]: { ...p[user.id], [ds]: e.target.value as DraftCell },
                                }))
                              }
                              disabled={isTO || selectedCycle?.status !== 'draft'}
                              className={cn(
                                'w-full h-11 appearance-none bg-transparent text-center text-xs outline-none cursor-pointer hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
                                {
                                  'font-bold text-blue-700 bg-blue-50/80 hover:bg-blue-100':
                                    val === 'D',
                                  'font-bold text-indigo-100 bg-indigo-800 hover:bg-indigo-700':
                                    val === 'N',
                                  'font-bold text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100':
                                    val === 'M',
                                  'font-bold text-orange-700 bg-orange-50/80 hover:bg-orange-100':
                                    val === 'T',
                                  'text-red-400 font-bold bg-red-50/80 hover:bg-red-100':
                                    isTO && !isPendingTO,
                                  'text-amber-500 font-bold bg-amber-50/80 hover:bg-amber-100':
                                    isPendingTO,
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
        </div>

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
                  v.toLowerCase().includes('sem descanso')
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
