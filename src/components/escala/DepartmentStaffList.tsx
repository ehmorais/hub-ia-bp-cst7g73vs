import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { UserPlus, Pencil, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import {
  getUsers,
  getHospitalSectors,
  getStaffRoles,
  updateUser,
  createUser,
  deleteUser,
} from '@/services/escala'
import { useRealtime } from '@/hooks/use-realtime'
import { TimeoffRequestDialog } from './TimeoffRequestDialog'
import { useAuth } from '@/hooks/use-auth'
import { Badge } from '@/components/ui/badge'

export function DepartmentStaffList({ departmentId }: { departmentId: string }) {
  const [users, setUsers] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const { user: authUser } = useAuth()
  const { toast } = useToast()

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)

  // Form state
  const [formData, setFormData] = useState({ name: '', staff_role: '', default_sector: '' })

  const loadData = async () => {
    Promise.all([getUsers(), getHospitalSectors(departmentId), getStaffRoles()]).then(
      ([u, s, r]) => {
        const sectorIds = s.map((sec: any) => sec.id)
        setUsers(
          u.filter(
            (user: any) =>
              user.expand?.staff_role &&
              (!user.default_sector || sectorIds.includes(user.default_sector)),
          ),
        )
        setSectors(s)
        setRoles(r)
      },
    )
  }

  useEffect(() => {
    loadData()
  }, [departmentId])
  useRealtime('users', loadData)

  const handleAssignSector = async (userId: string, sectorId: string) => {
    try {
      await updateUser(userId, { default_sector: sectorId === 'none' ? null : sectorId })
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveUser = async () => {
    try {
      const dataToSave = {
        ...formData,
        default_sector: formData.default_sector === 'none' ? null : formData.default_sector,
      }
      if (editingUser) {
        await updateUser(editingUser.id, dataToSave)
        toast({ title: 'Colaborador atualizado com sucesso' })
      } else {
        const timestamp = Date.now()
        await createUser({
          ...dataToSave,
          email: `colab_${timestamp}@hub-ia.local`,
          password: 'Password123!',
          passwordConfirm: 'Password123!',
          role: 'Operador',
        })
        toast({ title: 'Colaborador adicionado com sucesso' })
      }
      setIsAddOpen(false)
      setEditingUser(null)
      loadData()
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' })
    }
  }

  const handleDeleteUser = async (id: string) => {
    try {
      await deleteUser(id)
      toast({ title: 'Colaborador removido com sucesso' })
      loadData()
    } catch (e: any) {
      toast({ title: 'Erro ao remover', description: e.message, variant: 'destructive' })
    }
  }

  const openAdd = () => {
    setFormData({ name: '', staff_role: '', default_sector: sectors[0]?.id || 'none' })
    setEditingUser(null)
    setIsAddOpen(true)
  }

  const openEdit = (user: any) => {
    setFormData({
      name: user.name,
      staff_role: user.staff_role || '',
      default_sector: user.default_sector || 'none',
    })
    setEditingUser(user)
    setIsAddOpen(true)
  }

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Gerenciar Colaboradores</CardTitle>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <Button size="sm" onClick={openAdd} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Adicionar Colaborador
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Alterar Colaborador' : 'Adicionar Colaborador'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do colaborador"
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Select
                  value={formData.staff_role}
                  onValueChange={(val) => setFormData({ ...formData, staff_role: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Setor Padrão</Label>
                <Select
                  value={formData.default_sector}
                  onValueChange={(val) => setFormData({ ...formData, default_sector: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um setor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem setor</SelectItem>
                    {sectors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveUser}
                disabled={!formData.name || !formData.staff_role || !formData.default_sector}
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead>Colaborador</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Setor Padrão</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium text-slate-700">{u.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="font-normal text-xs uppercase bg-slate-100"
                    >
                      {u.expand?.staff_role?.name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-600">
                      {sectors.find((s) => s.id === u.default_sector)?.name || 'Sem setor'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right flex items-center justify-end gap-2">
                    <TimeoffRequestDialog user={u} departmentId={departmentId} />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(u)}
                      className="h-8 w-8"
                    >
                      <Pencil className="h-4 w-4 text-slate-500" />
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
                          <AlertDialogTitle>Excluir Colaborador</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja remover {u.name}? Esta ação não pode ser
                            desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600 text-white"
                            onClick={() => handleDeleteUser(u.id)}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                    Nenhum colaborador encontrado neste departamento.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
