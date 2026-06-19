import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Clock, Plus } from 'lucide-react'
import {
  getShiftCycles,
  getTimeoffRequests,
  createTimeoffRequest,
  deleteTimeoffRequest,
  getUsers,
  getHospitalSectors,
} from '@/services/escala'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { format, parseISO, isWithinInterval } from 'date-fns'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { Badge } from '@/components/ui/badge'

export function TimeoffRequestDialog({ user, departmentId }: { user?: any; departmentId: string }) {
  const [open, setOpen] = useState(false)
  const [cycles, setCycles] = useState<any[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<string>('')
  const [requests, setRequests] = useState<any[]>([])
  const [departmentUsers, setDepartmentUsers] = useState<any[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>(user?.id || '')
  const [date, setDate] = useState('')
  const [priority, setPriority] = useState('5')
  const { toast } = useToast()

  const loadData = async () => {
    const [c, r] = await Promise.all([getShiftCycles(), getTimeoffRequests()])
    setCycles(c)
    setRequests(r)
    if (c.length > 0 && !selectedCycleId) {
      setSelectedCycleId(c[0].id)
    }

    if (!user) {
      const [u, s] = await Promise.all([getUsers(), getHospitalSectors(departmentId)])
      const sectorIds = s.map((sec: any) => sec.id)
      const deptUsers = u.filter(
        (usr: any) => !usr.default_sector || sectorIds.includes(usr.default_sector),
      )
      setDepartmentUsers(deptUsers)
    }
  }

  useEffect(() => {
    if (open) loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) {
      if (!user) setSelectedUserId('')
      setDate('')
      setPriority('5')
    }
  }, [open, user])

  const targetUser = user?.id || selectedUserId
  const selectedCycle = cycles.find((c) => c.id === selectedCycleId)
  const cycleRequests = requests.filter((r) => r.cycle === selectedCycleId && r.user === targetUser)

  const handleAdd = async () => {
    if (!selectedCycleId || !date) return
    if (!targetUser) {
      toast({
        title: 'Atenção',
        description: 'Selecione um colaborador primeiro.',
        variant: 'destructive',
      })
      return
    }

    const d = parseISO(date)
    const start = parseISO(selectedCycle.start_date.substring(0, 10))
    const end = parseISO(selectedCycle.end_date.substring(0, 10))

    if (!isWithinInterval(d, { start, end })) {
      toast({
        title: 'Data inválida',
        description: 'A data deve estar dentro do ciclo selecionado.',
        variant: 'destructive',
      })
      return
    }

    if (cycleRequests.length >= 2) {
      toast({
        title: 'Atenção',
        description: 'Limite de 2 folgas por ciclo atingido.',
        variant: 'destructive',
      })
      return
    }

    try {
      await createTimeoffRequest({
        user: targetUser,
        cycle: selectedCycleId,
        date: `${date} 12:00:00.000Z`,
        priority_weight: parseInt(priority, 10),
        status: 'pending',
      })
      toast({ title: 'Sucesso', description: 'Folga solicitada com sucesso.' })
      setDate('')
      loadData()
    } catch (e: any) {
      const errs = extractFieldErrors(e)
      toast({
        title: 'Erro',
        description: errs.date || errs.cycle || e.message,
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteTimeoffRequest(id)
      loadData()
    } catch {
      toast({ title: 'Erro ao remover folga', variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {user ? (
          <Button variant="outline" size="sm" className="gap-2 bg-white hover:bg-slate-50">
            <Clock className="h-4 w-4 text-slate-500" />
            <span>Solicitar Folga</span>
          </Button>
        ) : (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            <span>Solicitar Folga</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? `Gerenciar Folgas: ${user.name}` : 'Solicitar Folga'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {!user && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Colaborador</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um colaborador..." />
                </SelectTrigger>
                <SelectContent>
                  {departmentUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Ciclo de Escala</label>
            <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um ciclo..." />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCycle && (
              <p className="text-xs text-muted-foreground mt-1">
                Período: {format(parseISO(selectedCycle.start_date), 'dd/MM/yyyy')} a{' '}
                {format(parseISO(selectedCycle.end_date), 'dd/MM/yyyy')}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              Folgas Solicitadas
              <Badge variant="secondary" className="font-mono text-xs">
                {cycleRequests.length}/2
              </Badge>
            </h4>

            {!targetUser ? (
              <p className="text-sm text-muted-foreground p-4 bg-slate-50 rounded-md border border-dashed text-center">
                Selecione um colaborador para ver as folgas.
              </p>
            ) : cycleRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 bg-slate-50 rounded-md border border-dashed text-center">
                Nenhuma folga solicitada neste ciclo.
              </p>
            ) : (
              <ul className="space-y-2">
                {cycleRequests.map((r) => (
                  <li
                    key={r.id}
                    className="flex justify-between items-center bg-slate-50 p-2.5 rounded-md border text-sm group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-slate-700">
                        {format(parseISO(r.date), 'dd/MM/yyyy')}
                      </span>
                      <Badge
                        variant={
                          r.status === 'fulfilled'
                            ? 'default'
                            : r.status === 'not_fulfilled'
                              ? 'destructive'
                              : 'secondary'
                        }
                        className="text-[10px] uppercase h-5"
                      >
                        {r.status === 'pending'
                          ? 'Pendente'
                          : r.status === 'fulfilled'
                            ? 'Aprovada'
                            : 'Recusada'}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDelete(r.id)}
                    >
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!targetUser ? null : cycleRequests.length < 2 ? (
            <div className="flex gap-3 items-end pt-4 border-t">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium block">Nova Data</label>
                <input
                  type="date"
                  className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={selectedCycle?.start_date.substring(0, 10)}
                  max={selectedCycle?.end_date.substring(0, 10)}
                />
              </div>
              <div className="w-[100px] space-y-2">
                <label className="text-sm font-medium block">Prioridade</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                      <SelectItem key={p} value={p.toString()}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} disabled={!date} className="h-10">
                Adicionar
              </Button>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm flex items-center justify-center">
              Limite de 2 folgas por ciclo atingido.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
