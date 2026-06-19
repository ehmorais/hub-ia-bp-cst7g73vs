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
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { UserPlus, Pencil, Trash2, Search } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import {
  getUsers,
  getHospitalSectors,
  getStaffRoles,
  getStaffProfiles,
  getShiftRules,
  updateUser,
  createUser,
  deleteUser,
} from '@/services/escala'
import { useRealtime } from '@/hooks/use-realtime'
import { TimeoffRequestDialog } from './TimeoffRequestDialog'
import { useAuth } from '@/hooks/use-auth'
import { Badge } from '@/components/ui/badge'

export function DepartmentStaffList({ departmentId }: { departmentId?: string }) {
  const [users, setUsers] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const { user: authUser } = useAuth()
  const { toast } = useToast()

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    role: 'Operador',
    staff_role: '',
    default_sector: '',
    staff_profile: '',
    assigned_rules: [] as string[],
  })

  const loadData = async () => {
    try {
      const [u, s, r, p, sr] = await Promise.all([
        getUsers().catch(() => []),
        getHospitalSectors(departmentId).catch(() => []),
        getStaffRoles().catch(() => []),
        getStaffProfiles().catch(() => []),
        getShiftRules(departmentId).catch(() => []),
      ])
      const sectorIds = s.map((sec: any) => sec.id)

      setUsers(
        departmentId
          ? u.filter((user: any) => !user.default_sector || sectorIds.includes(user.default_sector))
          : u,
      )
      setSectors(s)
      setRoles(r)
      setProfiles(p)
      setRules(sr)
    } catch (e) {
      console.error('Failed to load staff list data', e)
    }
  }

  useEffect(() => {
    loadData()
  }, [departmentId])
  useRealtime('users', loadData)

  const handleProfileChange = (profileId: string) => {
    if (profileId === 'none') {
      setFormData({ ...formData, staff_profile: '' })
      return
    }
    const profile = profiles.find((p) => p.id === profileId)
    if (profile) {
      setFormData({
        ...formData,
        staff_profile: profileId,
        assigned_rules: profile.rules || [],
      })
    }
  }

  const handleRuleToggle = (ruleId: string, checked: boolean) => {
    if (checked) {
      setFormData({ ...formData, assigned_rules: [...formData.assigned_rules, ruleId] })
    } else {
      setFormData({
        ...formData,
        assigned_rules: formData.assigned_rules.filter((id) => id !== ruleId),
      })
    }
  }

  const handleSaveUser = async () => {
    try {
      const dataToSave = {
        ...formData,
        default_sector: formData.default_sector === 'none' ? null : formData.default_sector,
        staff_profile: formData.staff_profile === 'none' ? null : formData.staff_profile,
        staff_role: formData.staff_role === 'none' ? null : formData.staff_role,
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
    setFormData({
      name: '',
      role: 'Operador',
      staff_role: 'none',
      default_sector: sectors[0]?.id || 'none',
      staff_profile: 'none',
      assigned_rules: [],
    })
    setEditingUser(null)
    setIsAddOpen(true)
  }

  const openEdit = (user: any) => {
    setFormData({
      name: user.name || '',
      role: user.role || 'Operador',
      staff_role: user.staff_role || 'none',
      default_sector: user.default_sector || 'none',
      staff_profile: user.staff_profile || 'none',
      assigned_rules: user.assigned_rules || [],
    })
    setEditingUser(user)
    setIsAddOpen(true)
  }

  const filteredUsers = users.filter((u) => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    const nameMatch = u.name?.toLowerCase().includes(searchLower)
    const sectorName = sectors.find((s) => s.id === u.default_sector)?.name || ''
    const sectorMatch = sectorName.toLowerCase().includes(searchLower)
    return nameMatch || sectorMatch
  })

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader className="pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <CardTitle className="text-lg">Gerenciar Colaboradores</CardTitle>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Buscar por nome ou setor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <Button size="sm" onClick={openAdd} className="gap-2 shrink-0">
              <UserPlus className="h-4 w-4" />
              Novo Colaborador
            </Button>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Acesso (Sistema)</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(val) => setFormData({ ...formData, role: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Operador">Operador</SelectItem>
                        <SelectItem value="Admin">Admin</SelectItem>
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
                        <SelectValue placeholder="Selecione..." />
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

                <div className="space-y-2 pt-2 border-t">
                  <Label>Cargo / Função</Label>
                  <Select
                    value={formData.staff_role}
                    onValueChange={(val) => setFormData({ ...formData, staff_role: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem cargo</SelectItem>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <Label>Perfil Padrão (Regras base)</Label>
                  <Select value={formData.staff_profile} onValueChange={handleProfileChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sem perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem perfil</SelectItem>
                      {profiles.length === 0 && (
                        <SelectItem value="empty" disabled>
                          Nenhum perfil cadastrado
                        </SelectItem>
                      )}
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-slate-500">
                    Selecionar um perfil irá preencher as regras automaticamente.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Regras Associadas (Exceções ou Adições)</Label>
                  <ScrollArea className="h-32 border rounded-md p-2 bg-slate-50">
                    {rules.length === 0 ? (
                      <p className="text-xs text-slate-500 p-4 text-center leading-relaxed">
                        Nenhuma regra cadastrada neste departamento.
                        <br />
                        Por favor, adicione regras na área de administração de escalas.
                      </p>
                    ) : (
                      rules.map((rule) => (
                        <div
                          key={rule.id}
                          className="flex items-center space-x-2 py-1.5 px-1 hover:bg-slate-100 rounded"
                        >
                          <Checkbox
                            id={`rule-${rule.id}`}
                            checked={formData.assigned_rules.includes(rule.id)}
                            onCheckedChange={(checked) =>
                              handleRuleToggle(rule.id, checked === true)
                            }
                          />
                          <label
                            htmlFor={`rule-${rule.id}`}
                            className="text-sm font-normal cursor-pointer flex-1 leading-tight"
                          >
                            {rule.name}{' '}
                            <span className="text-[10px] text-slate-400 block">
                              {rule.rule_type}
                            </span>
                          </label>
                        </div>
                      ))
                    )}
                  </ScrollArea>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveUser} disabled={!formData.name}>
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead>Colaborador</TableHead>
                <TableHead>Acesso</TableHead>
                <TableHead>Cargo / Perfil</TableHead>
                <TableHead>Regras</TableHead>
                <TableHead>Setor Padrão</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium text-slate-700">{u.name || u.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={u.role === 'Admin' ? 'default' : 'secondary'}
                      className="font-normal text-[10px] uppercase"
                    >
                      {u.role || 'Operador'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      {u.expand?.staff_role ? (
                        <Badge
                          variant="secondary"
                          className="font-normal text-[10px] uppercase bg-slate-100"
                        >
                          {u.expand.staff_role.name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">Sem Cargo</span>
                      )}
                      {u.expand?.staff_profile && (
                        <Badge
                          variant="outline"
                          className="font-normal text-[10px] uppercase border-blue-200 text-blue-700 bg-blue-50"
                        >
                          {u.expand.staff_profile.name}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.assigned_rules?.length > 0 ? (
                      <Badge variant="outline" className="bg-white">
                        {u.assigned_rules.length} Regra(s)
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-600">
                      {sectors.find((s) => s.id === u.default_sector)?.name || 'Sem setor'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right flex items-center justify-end gap-1">
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
                            Tem certeza que deseja remover {u.name || u.email}? Esta ação não pode
                            ser desfeita.
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
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    Nenhum colaborador encontrado.
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
