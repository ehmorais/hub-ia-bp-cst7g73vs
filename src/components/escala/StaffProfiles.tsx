import { useEffect, useState } from 'react'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import { CollaboratorImportDialog } from '@/components/CollaboratorImportDialog'
import { TimeoffRequestDialog } from './TimeoffRequestDialog'
import { useToast } from '@/components/ui/use-toast'
import {
  createStaffProfile,
  deleteStaffProfile,
  getHospitalSectors,
  getShiftRules,
  getStaffProfiles,
  getStaffRoles,
  updateStaffProfile,
} from '@/services/escala'
import { useRealtime } from '@/hooks/use-realtime'

type ProfileForm = {
  name: string
  professional_id: string
  staff_role: string
  default_sector: string
  rules: string[]
}

const emptyForm: ProfileForm = {
  name: '',
  professional_id: '',
  staff_role: 'none',
  default_sector: 'none',
  rules: [],
}

export function StaffProfiles({ departmentId }: { departmentId?: string; projectId?: string }) {
  const [profiles, setProfiles] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<any>(null)
  const [formData, setFormData] = useState<ProfileForm>(emptyForm)
  const { toast } = useToast()

  const loadData = async () => {
    try {
      const [profileList, roleList, sectorList, ruleList] = await Promise.all([
        getStaffProfiles().catch(() => []),
        getStaffRoles().catch(() => []),
        getHospitalSectors(departmentId).catch(() => []),
        departmentId
          ? getShiftRules(departmentId).catch(() => [])
          : getShiftRules().catch(() => []),
      ])
      setProfiles(profileList)
      setRoles(roleList)
      setSectors(sectorList)
      setRules(ruleList)
    } catch (error) {
      console.error('Failed to load collaborator profiles', error)
    }
  }

  useEffect(() => {
    loadData()
  }, [departmentId])

  useRealtime('staff_profiles', loadData)

  const openAdd = () => {
    setEditingProfile(null)
    setFormData(emptyForm)
    setIsFormOpen(true)
  }

  const openEdit = (profile: any) => {
    setEditingProfile(profile)
    setFormData({
      name: profile.name || '',
      professional_id: profile.professional_id || '',
      staff_role: profile.staff_role || 'none',
      default_sector: profile.default_sector || 'none',
      rules: profile.rules || [],
    })
    setIsFormOpen(true)
  }

  const toggleRule = (ruleId: string, checked: boolean) => {
    setFormData((current) => ({
      ...current,
      rules: checked ? [...current.rules, ruleId] : current.rules.filter((id) => id !== ruleId),
    }))
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome do colaborador.',
        variant: 'destructive',
      })
      return
    }

    const payload = {
      name: formData.name.trim(),
      professional_id: formData.professional_id.trim(),
      staff_role: formData.staff_role === 'none' ? null : formData.staff_role,
      default_sector: formData.default_sector === 'none' ? null : formData.default_sector,
      rules: formData.rules,
    }

    try {
      if (editingProfile) {
        await updateStaffProfile(editingProfile.id, payload)
        toast({ title: 'Cadastro atualizado com sucesso' })
      } else {
        await createStaffProfile(payload)
        toast({ title: 'Colaborador cadastrado com sucesso' })
      }
      setIsFormOpen(false)
      setEditingProfile(null)
      setFormData(emptyForm)
      loadData()
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar cadastro',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteStaffProfile(id)
      toast({ title: 'Colaborador removido com sucesso' })
      loadData()
    } catch (error: any) {
      toast({
        title: 'Erro ao remover colaborador',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const filteredProfiles = profiles.filter((profile) => {
    if (!searchTerm) return true
    const query = searchTerm.toLowerCase()
    return (
      profile.name?.toLowerCase().includes(query) ||
      profile.professional_id?.toLowerCase().includes(query) ||
      profile.expand?.staff_role?.name?.toLowerCase().includes(query) ||
      profile.expand?.default_sector?.name?.toLowerCase().includes(query)
    )
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border-slate-200 bg-white">
        <CardHeader className="pb-3 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Cadastro de Colaboradores
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastro operacional integrado a contratos, folgas e geração de escalas. Estes
              colaboradores não são usuários do portal.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
            <div className="relative sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Buscar por nome, registro, cargo ou setor..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <CollaboratorImportDialog onImported={loadData} />
            <Button size="sm" onClick={openAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Colaborador
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead>Colaborador</TableHead>
                <TableHead>Registro Profissional</TableHead>
                <TableHead>Cargo / Função</TableHead>
                <TableHead>Setor Padrão</TableHead>
                <TableHead>Regras</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium text-slate-700">{profile.name}</TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {profile.professional_id || '-'}
                  </TableCell>
                  <TableCell>
                    {profile.expand?.staff_role?.name ? (
                      <Badge variant="secondary" className="font-normal">
                        {profile.expand.staff_role.name}
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-400">Sem cargo</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {profile.expand?.default_sector?.name || 'Sem setor'}
                  </TableCell>
                  <TableCell>
                    {profile.rules?.length ? (
                      <Badge variant="outline">{profile.rules.length} regra(s)</Badge>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <TimeoffRequestDialog staffProfile={profile} departmentId={departmentId} />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Alterar cadastro de ${profile.name}`}
                        onClick={() => openEdit(profile)}
                      >
                        <Pencil className="h-4 w-4 text-slate-500" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            aria-label={`Excluir ${profile.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Colaborador</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir o cadastro de {profile.name}?
                              Contratos, folgas e plantões vinculados também poderão ser removidos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-500 hover:bg-red-600 text-white"
                              onClick={() => handleDelete(profile.id)}
                            >
                              Confirmar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProfiles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    Nenhum colaborador encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProfile ? 'Alterar Cadastro de Colaborador' : 'Novo Colaborador'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                placeholder="Nome do colaborador"
              />
            </div>
            <div className="space-y-2">
              <Label>
                Registro Profissional (CRM / COREN){' '}
                <span className="font-normal text-slate-400">(opcional)</span>
              </Label>
              <Input
                value={formData.professional_id}
                onChange={(event) =>
                  setFormData({ ...formData, professional_id: event.target.value })
                }
                placeholder="Ex.: CRM/SP 123456 ou COREN-SP 123456"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Cargo / Função</Label>
              <Select
                value={formData.staff_role}
                onValueChange={(value) => setFormData({ ...formData, staff_role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cargo</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Setor Padrão</Label>
              <Select
                value={formData.default_sector}
                onValueChange={(value) => setFormData({ ...formData, default_sector: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem setor</SelectItem>
                  {sectors.map((sector) => (
                    <SelectItem key={sector.id} value={sector.id}>
                      {sector.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Regras Associadas</Label>
              <ScrollArea className="h-36 border rounded-md p-2 bg-slate-50">
                {rules.length === 0 ? (
                  <p className="text-xs text-slate-500 p-3 text-center">
                    Nenhuma regra cadastrada.
                  </p>
                ) : (
                  rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center space-x-2 py-1.5 px-1 hover:bg-slate-100 rounded"
                    >
                      <Checkbox
                        id={`profile-rule-${rule.id}`}
                        checked={formData.rules.includes(rule.id)}
                        onCheckedChange={(checked) => toggleRule(rule.id, checked === true)}
                      />
                      <label
                        htmlFor={`profile-rule-${rule.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {rule.name}
                      </label>
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
