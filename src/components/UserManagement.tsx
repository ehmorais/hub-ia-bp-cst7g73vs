import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, Plus, Edit2, Trash2, ArrowLeft, ShieldCheck, User as UserIcon } from 'lucide-react'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import pb from '@/lib/pocketbase/client'

export function UserManagement() {
  const { user } = useAuth()
  const { toast } = useToast()

  if (user?.role !== 'Admin') {
    return (
      <div className="p-8 text-center text-red-500">Acesso negado. Apenas administradores.</div>
    )
  }

  const [users, setUsers] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])

  const [search, setSearch] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Operador',
    staff_role: '',
    default_sector: '',
    staff_profile: '',
    assigned_rules: [] as string[],
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = async () => {
    try {
      const [u, s, r, p, sr] = await Promise.all([
        pb.collection('users').getFullList({ sort: 'name', expand: 'default_sector,staff_role' }),
        pb.collection('hospital_sectors').getFullList({ sort: 'name' }),
        pb.collection('staff_roles').getFullList({ sort: 'name' }),
        pb.collection('staff_profiles').getFullList({ sort: 'name' }),
        pb.collection('shift_rules').getFullList({ sort: 'name' }),
      ])
      setUsers(u)
      setSectors(s)
      setRoles(r)
      setProfiles(p)
      setRules(sr)
    } catch (err) {
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' })
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('users', () => loadData())

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter(
      (u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q),
    )
  }, [users, search])

  const handleOpenForm = (u?: any) => {
    setFormErrors({})
    if (u) {
      setSelectedUser(u)
      setFormData({
        name: u.name || '',
        email: u.email || '',
        password: '',
        role: u.role || 'Operador',
        staff_role: u.staff_role || '',
        default_sector: u.default_sector || '',
        staff_profile: u.staff_profile || '',
        assigned_rules: u.assigned_rules || [],
      })
    } else {
      setSelectedUser(null)
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'Operador',
        staff_role: '',
        default_sector: '',
        staff_profile: '',
        assigned_rules: [],
      })
    }
    setIsFormOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErrors({})

    const errors: Record<string, string> = {}
    if (!formData.name) errors.name = 'Nome é obrigatório'
    if (!formData.email) errors.email = 'Email é obrigatório'
    if (!selectedUser && !formData.password)
      errors.password = 'Senha é obrigatória para novos usuários'

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setIsSubmitting(true)
    try {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        staff_role: formData.staff_role || null,
        default_sector: formData.default_sector || null,
        staff_profile: formData.staff_profile || null,
        assigned_rules: formData.assigned_rules,
      }

      if (formData.password) {
        payload.password = formData.password
        payload.passwordConfirm = formData.password
      }

      if (selectedUser) {
        await pb.collection('users').update(selectedUser.id, payload)
        toast({ title: 'Usuário atualizado com sucesso' })
      } else {
        await pb.collection('users').create(payload)
        toast({ title: 'Usuário criado com sucesso' })
      }
      setIsFormOpen(false)
    } catch (err: any) {
      const fieldErrs = extractFieldErrors(err)
      if (Object.keys(fieldErrs).length > 0) {
        setFormErrors(fieldErrs)
      } else {
        toast({ title: 'Erro ao salvar usuário', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedUser) return
    setIsSubmitting(true)
    try {
      await pb.collection('users').delete(selectedUser.id)
      toast({ title: 'Usuário removido com sucesso' })
      setIsDeleteOpen(false)
    } catch (err: any) {
      toast({ title: 'Erro ao remover usuário', description: err.message, variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (window.location.hash = '')}
            className="hover:bg-emerald-50 hover:text-emerald-600"
          >
            <ArrowLeft className="w-5 h-5 text-emerald-600" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Usuários</h1>
            <p className="text-sm text-gray-500">Crie, edite e gerencie os acessos do sistema.</p>
          </div>
        </div>
        <Button
          onClick={() => handleOpenForm()}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 border-gray-300 focus-visible:ring-emerald-500"
          />
        </div>
      </div>

      <div className="border border-gray-200 rounded-md bg-white overflow-hidden flex-1">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader className="bg-gray-50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="font-semibold text-gray-700">Nome</TableHead>
                <TableHead className="font-semibold text-gray-700">Email</TableHead>
                <TableHead className="font-semibold text-gray-700">Função</TableHead>
                <TableHead className="font-semibold text-gray-700">Setor Padrão</TableHead>
                <TableHead className="font-semibold text-gray-700">Cargo</TableHead>
                <TableHead className="text-right font-semibold text-gray-700">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => (
                  <TableRow key={u.id} className="hover:bg-emerald-50/50 transition-colors">
                    <TableCell className="font-medium text-gray-900">{u.name || '-'}</TableCell>
                    <TableCell className="text-gray-600">{u.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          u.role === 'Admin'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                        }
                      >
                        {u.role === 'Admin' ? (
                          <ShieldCheck className="w-3 h-3 mr-1" />
                        ) : (
                          <UserIcon className="w-3 h-3 mr-1" />
                        )}
                        {u.role || 'Operador'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {u.expand?.default_sector?.name || '-'}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {u.expand?.staff_role?.name || '-'}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-emerald-600 hover:bg-emerald-50"
                        onClick={() => handleOpenForm(u)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setSelectedUser(u)
                          setIsDeleteOpen(true)
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[600px] bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-xl text-gray-900">
              {selectedUser ? 'Editar Usuário' : 'Novo Usuário'}
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Preencha os dados do usuário e defina suas permissões e vínculos.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-700">Nome</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={
                    formErrors.name
                      ? 'border-red-500'
                      : 'border-gray-300 focus-visible:ring-emerald-500'
                  }
                />
                {formErrors.name && <p className="text-xs text-red-500">{formErrors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700">Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={
                    formErrors.email
                      ? 'border-red-500'
                      : 'border-gray-300 focus-visible:ring-emerald-500'
                  }
                />
                {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-700">
                  Senha{' '}
                  {selectedUser && <span className="text-gray-400 font-normal">(Opcional)</span>}
                </Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={
                    formErrors.password
                      ? 'border-red-500'
                      : 'border-gray-300 focus-visible:ring-emerald-500'
                  }
                />
                {formErrors.password && (
                  <p className="text-xs text-red-500">{formErrors.password}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700">Função no Sistema</Label>
                <Select
                  value={formData.role}
                  onValueChange={(val) => setFormData({ ...formData, role: val })}
                >
                  <SelectTrigger className="border-gray-300 focus:ring-emerald-500">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Operador">Operador</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-700">Cargo (Staff Role)</Label>
                <Select
                  value={formData.staff_role || 'none'}
                  onValueChange={(val) =>
                    setFormData({ ...formData, staff_role: val === 'none' ? '' : val })
                  }
                >
                  <SelectTrigger className="border-gray-300 focus:ring-emerald-500">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700">Setor Padrão</Label>
                <Select
                  value={formData.default_sector || 'none'}
                  onValueChange={(val) =>
                    setFormData({ ...formData, default_sector: val === 'none' ? '' : val })
                  }
                >
                  <SelectTrigger className="border-gray-300 focus:ring-emerald-500">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {sectors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-700">Perfil de Escala</Label>
                <Select
                  value={formData.staff_profile || 'none'}
                  onValueChange={(val) =>
                    setFormData({ ...formData, staff_profile: val === 'none' ? '' : val })
                  }
                >
                  <SelectTrigger className="border-gray-300 focus:ring-emerald-500">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700">Regras Específicas Atribuídas</Label>
              <ScrollArea className="h-[100px] border border-gray-300 rounded-md p-2">
                {rules.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma regra disponível.</p>
                ) : (
                  rules.map((rule) => (
                    <div key={rule.id} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`rule-${rule.id}`}
                        checked={formData.assigned_rules.includes(rule.id)}
                        onCheckedChange={(checked) => {
                          if (checked)
                            setFormData({
                              ...formData,
                              assigned_rules: [...formData.assigned_rules, rule.id],
                            })
                          else
                            setFormData({
                              ...formData,
                              assigned_rules: formData.assigned_rules.filter(
                                (id) => id !== rule.id,
                              ),
                            })
                        }}
                      />
                      <label
                        htmlFor={`rule-${rule.id}`}
                        className="text-sm font-medium leading-none cursor-pointer text-gray-700"
                      >
                        {rule.name}
                      </label>
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>

            <DialogFooter className="pt-4 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[400px] bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-xl text-gray-900">Excluir Usuário</DialogTitle>
            <DialogDescription className="text-gray-500">
              Tem certeza que deseja excluir o usuário <strong>{selectedUser?.name}</strong>? Esta
              ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isSubmitting}
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {isSubmitting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
