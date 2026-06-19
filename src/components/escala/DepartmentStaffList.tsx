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
import { UserPlus, Pencil, Trash2 } from 'lucide-react'
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

export function DepartmentStaffList({ departmentId }: { departmentId: string }) {
  const [users, setUsers] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const { user: authUser } = useAuth()
  const { toast } = useToast()

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
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
        u.filter((user: any) => !user.default_sector || sectorIds.includes(user.default_sector)),
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
    setFormData({
      name: '',
      staff_role: '',
      default_sector: sectors[0]?.id || 'none',
      staff_profile: '',
      assigned_rules: [],
    })
    setEditingUser(null)
    setIsAddOpen(true)
  }

  const openEdit = (user: any) => {
    setFormData({
      name: user.name,
      staff_role: user.staff_role || '',
      default_sector: user.default_sector || 'none',
      staff_profile: user.staff_profile || '',
      assigned_rules: user.assigned_rules || [],
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
                  <Label>Cargo</Label>
                  <Select
                    value={formData.staff_role}
                    onValueChange={(val) => setFormData({ ...formData, staff_role: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
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
                <Label>Perfil Padrão (Regras base)</Label>
                <Select
                  value={formData.staff_profile || 'none'}
                  onValueChange={handleProfileChange}
                >
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
                          onCheckedChange={(checked) => handleRuleToggle(rule.id, checked === true)}
                        />
                        <label
                          htmlFor={`rule-${rule.id}`}
                          className="text-sm font-normal cursor-pointer flex-1 leading-tight"
                        >
                          {rule.name}{' '}
                          <span className="text-[10px] text-slate-400 block">{rule.rule_type}</span>
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
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead>Colaborador</TableHead>
                <TableHead>Cargo / Perfil</TableHead>
                <TableHead>Regras Individuais</TableHead>
                <TableHead>Setor Padrão</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium text-slate-700">{u.name}</TableCell>
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
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
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
