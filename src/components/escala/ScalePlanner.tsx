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
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

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
  const [searchUser, setSearchUser] = useState('')

  const { toast } = useToast()
  const isCollectionPast = new Date().getDate() > 10

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
      if (c.length > 0)
        setSelectedCycleId(
          c.find((x: any) => x.status === 'draft' || x.status === 'active')?.id || c[0].id,
        )
      if (s.length > 0) setSelectedSectorId(s[0].id)
    })
  }, [departmentId])

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
  const timeoffsForCycle = useMemo(
    () => timeoffs.filter((t) => t.cycle === selectedCycleId && t.status === 'fulfilled'),
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
          if (isTO) alerts.push(`${user.name} alocado em dia de folga (${format(day, 'dd/MM')})`)
          if (cell === 'D' || cell === 'N') {
            uh += 12
            if (lastEnd) {
              const cs = new Date(day)
              cs.setHours(cell === 'D' ? 7 : 19, 0, 0, 0)
              if (stName.includes('12x36') && (cs.getTime() - lastEnd.getTime()) / 3600000 < 36) {
                alerts.push(`${user.name} sem descanso de 36h (${format(day, 'dd/MM')})`)
              }
            }
            lastEnd = new Date(day)
            lastEnd.setDate(lastEnd.getDate() + (cell === 'N' ? 1 : 0))
            lastEnd.setHours(cell === 'N' ? 7 : 19, 0, 0, 0)
          } else if (cell === 'M' || cell === 'T') {
            uh += 6
            lastEnd = new Date(day)
            lastEnd.setHours(cell === 'M' ? 13 : 19, 0, 0, 0)
          }
        }
      })
      if (uh > maxH) alerts.push(`${user.name} excede o limite mensal (Total: ${uh}h / ${maxH}h)`)
    })
    return Array.from(new Set(alerts))
  }, [days, draft, draftUsers, selectedSector, contracts, timeoffsForCycle])

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
            let st = '',
              et = ''
            if (cell === 'D') {
              st = '07:00:00'
              et = '19:00:00'
            }
            if (cell === 'N') {
              st = '19:00:00'
              et = '07:00:00'
            }
            if (cell === 'M') {
              st = '07:00:00'
              et = '13:00:00'
            }
            if (cell === 'T') {
              st = '13:00:00'
              et = '19:00:00'
            }
            toCreate.push({
              user: u.id,
              sector: selectedSectorId,
              cycle: selectedCycleId,
              start_time: `${dateStr} ${st}.000Z`,
              end_time:
                cell === 'N'
                  ? `${format(addDays(d, 1), 'yyyy-MM-dd')} ${et}.000Z`
                  : `${dateStr} ${et}.000Z`,
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 border rounded-xl bg-white shadow-sm overflow-hidden flex flex-col">
          <ScrollArea className="w-full max-w-[calc(100vw-2rem)]">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-slate-100 border-b border-r p-2 text-left min-w-[150px]">
                    Colaborador
                  </th>
                  {days.map((day) => (
                    <th
                      key={day.toISOString()}
                      className="border-b border-r p-1.5 min-w-[36px] bg-slate-50 text-center"
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
                {draftUsers.map((user) => {
                  const isCov =
                    !allShifts.some((s) => s.user === user.id && s.sector === selectedSectorId) &&
                    allShifts.some((s) => s.user === user.id)
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 group">
                      <td className="sticky left-0 z-20 bg-white border-b border-r p-2 shadow-[1px_0_0_0_#e2e8f0]">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="font-medium text-xs truncate max-w-[120px]">
                              {user.name}
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
                            onClick={() => setDraftUsers((p) => p.filter((u) => u.id !== user.id))}
                            className="text-slate-300 hover:text-red-500"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      {days.map((day) => {
                        const ds = format(day, 'yyyy-MM-dd')
                        const val = draft[user.id]?.[ds] || ''
                        const isTO = timeoffsForCycle.some(
                          (t) => t.user === user.id && t.date.substring(0, 10) === ds,
                        )
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
                                'w-full h-11 appearance-none bg-transparent text-center text-xs outline-none cursor-pointer hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50',
                                {
                                  'font-bold text-blue-600': val === 'D',
                                  'font-bold text-indigo-900': val === 'N',
                                  'text-red-400 font-bold bg-red-50': isTO,
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
                              <div className="absolute top-0 right-0 p-0.5 text-red-500 opacity-50">
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

        <div className="lg:col-span-1 flex flex-col gap-4">
          <Card className="border-amber-200 bg-amber-50/30 flex-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800">
                <AlertCircle className="h-4 w-4" />
                Validação
              </CardTitle>
            </CardHeader>
            <CardContent>
              {validations.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-4 text-green-700 gap-2">
                  <CheckCircle2 className="h-8 w-8" />
                  <p className="text-xs font-medium">Escala validada.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {validations.map((v, i) => (
                    <li key={i} className="text-xs text-amber-800 bg-amber-100/50 p-2 rounded">
                      • {v}
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
