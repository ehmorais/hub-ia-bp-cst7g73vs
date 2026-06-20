import { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getStaffContracts,
  getUsers,
  getShiftTypes,
  createStaffContract,
  updateStaffContract,
  deleteStaffContract,
} from '@/services/escala'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Badge } from '@/components/ui/badge'
import { AlertCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function StaffContracts({ departmentId }: { departmentId?: string }) {
  const [contracts, setContracts] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [shiftTypes, setShiftTypes] = useState<any[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [userHours, setUserHours] = useState<Record<string, number>>({})

  const [formData, setFormData] = useState({
    user: '',
    contract_type: 'CLT 180h',
    monthly_hour_limit: 180,
    shift_type: '',
  })

  const { toast } = useToast()

  const loadData = async () => {
    try {
      const [c, u, st, cycles] = await Promise.all([
        getStaffContracts(),
        getUsers(),
        getShiftTypes(),
        import('@/services/escala').then((m) => m.getShiftCycles()),
      ])

      let filteredContracts = c
      let filteredUsers = u

      if (departmentId) {
        filteredContracts = c.filter((contract: any) => {
          const userSector = contract.expand?.user?.expand?.default_sector
          if (userSector?.department) {
            return userSector.department === departmentId
          }
          return true
        })

        filteredUsers = u.filter((user: any) => {
          const userSector = user.expand?.default_sector
          if (userSector?.department) {
            return userSector.department === departmentId
          }
          return true
        })
      }

      setContracts(filteredContracts)
      setUsers(filteredUsers)
      setShiftTypes(st)

      const activeCycle = cycles.find((cy: any) => cy.status === 'active') || cycles[0]
      if (activeCycle) {
        const { getShifts } = await import('@/services/escala')
        const allShifts = await getShifts(activeCycle.id)
        const hoursMap: Record<string, number> = {}
        allShifts.forEach((s: any) => {
          const start = new Date(s.start_time)
          const end = new Date(s.end_time)
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
          hoursMap[s.user] = (hoursMap[s.user] || 0) + hours
        })
        setUserHours(hoursMap)
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [departmentId])

  const handleSubmit = async () => {
    try {
      if (editingId) {
        await updateStaffContract(editingId, formData)
        toast({
          title: 'Sucesso',
          description: 'Contrato atualizado',
          className: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        })
      } else {
        await createStaffContract(formData)
        toast({
          title: 'Sucesso',
          description: 'Contrato criado',
          className: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        })
      }
      setIsOpen(false)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteStaffContract(id)
      toast({ title: 'Sucesso', description: 'Contrato excluído com sucesso' })
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: 'Erro ao excluir o contrato. Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-800">
          Contratos e Regimes (Associação de Turno)
        </h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingId(null)
                setFormData({
                  user: '',
                  contract_type: 'CLT 180h',
                  monthly_hour_limit: 180,
                  shift_type: '',
                })
              }}
            >
              Novo Contrato
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Contrato' : 'Novo Contrato'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Colaborador</label>
                <Select
                  value={formData.user}
                  onValueChange={(v) => setFormData({ ...formData, user: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Contrato</label>
                <Select
                  value={formData.contract_type}
                  onValueChange={(v) => setFormData({ ...formData, contract_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLT 180h">CLT 180h</SelectItem>
                    <SelectItem value="PJ">PJ</SelectItem>
                    <SelectItem value="Autônomo">Autônomo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Limite Mensal (Horas)</label>
                <Input
                  type="number"
                  value={formData.monthly_hour_limit}
                  onChange={(e) =>
                    setFormData({ ...formData, monthly_hour_limit: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Escala (Shift Type)</label>
                <Select
                  value={formData.shift_type}
                  onValueChange={(v) => setFormData({ ...formData, shift_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ex: 12x36 Dia, 5x2..." />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftTypes.map((st) => (
                      <SelectItem key={st.id} value={st.id}>
                        {st.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleSubmit}>
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Limite (h)</TableHead>
              <TableHead>Regime de Turno</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.expand?.user?.name}</TableCell>
                <TableCell>{c.contract_type}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{c.monthly_hour_limit}h</span>
                    {(userHours[c.user] || 0) > c.monthly_hour_limit && (
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-white text-slate-800 border-amber-200">
                          <p>
                            Atenção: Colaborador com {(userHours[c.user] || 0).toFixed(1)}h
                            agendadas (excede o limite de {c.monthly_hour_limit}h).
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className="border-emerald-200 text-emerald-800 bg-emerald-50"
                  >
                    {c.expand?.shift_type?.name || 'Não associado'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFormData({
                        user: c.user,
                        contract_type: c.contract_type,
                        monthly_hour_limit: c.monthly_hour_limit,
                        shift_type: c.shift_type || '',
                      })
                      setEditingId(c.id)
                      setIsOpen(true)
                    }}
                  >
                    Editar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Contrato</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir este contrato? Esta ação não pode ser
                          desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-500 hover:bg-red-600 text-white"
                          onClick={() => handleDelete(c.id)}
                        >
                          Confirmar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
