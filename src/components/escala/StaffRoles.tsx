import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Trash2, AlertTriangle, Plus, Pencil, Loader2, ShieldCheck } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { getStaffRoles, createStaffRole, updateStaffRole, deleteStaffRole } from '@/services/escala'
import { useRealtime } from '@/hooks/use-realtime'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface RoleFormData {
  name: string
  hierarchy_rank: number
  requires_supervision: boolean
}

const INITIAL_FORM: RoleFormData = {
  name: '',
  hierarchy_rank: 0,
  requires_supervision: false,
}

export function StaffRoles() {
  const [roles, setRoles] = useState<any[]>([])
  const [name, setName] = useState('')
  const [rank, setRank] = useState(0)
  const [reqSup, setReqSup] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Estado para o modal de Edição de Função existente
  const [editingRole, setEditingRole] = useState<any | null>(null)
  const [editFormData, setEditFormData] = useState<RoleFormData>(INITIAL_FORM)
  const [isUpdating, setIsUpdating] = useState(false)

  const { toast } = useToast()

  const loadData = async () => {
    try {
      const data = await getStaffRoles()
      setRoles(data)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar',
        description: getErrorMessage(err) || 'Não foi possível carregar as funções.',
        variant: 'destructive',
      })
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('staff_roles', loadData)

  const validateRoleName = (rawName: string, currentRoleId?: string): string | null => {
    const trimmed = rawName.trim()
    if (!trimmed) {
      return 'Nome da função é obrigatório.'
    }

    const normalized = trimmed.toLowerCase()
    const duplicate = roles.find(
      (r) => r.id !== currentRoleId && (r.name || '').trim().toLowerCase() === normalized,
    )

    if (duplicate) {
      return 'Já existe uma função cadastrada com este nome.'
    }

    return null
  }

  const handleCreate = async () => {
    const trimmed = name.trim()
    const validationError = validateRoleName(trimmed)
    if (validationError) {
      toast({
        title: 'Atenção',
        description: validationError,
        variant: 'destructive',
      })
      return
    }

    setIsCreating(true)
    try {
      await createStaffRole({
        name: trimmed,
        hierarchy_rank: rank,
        requires_supervision: reqSup,
      })
      setName('')
      setRank(0)
      setReqSup(false)
      await loadData()
      toast({ title: 'Sucesso', description: 'Função criada com sucesso.' })
    } catch (err: any) {
      toast({
        title: 'Erro de persistência',
        description: getErrorMessage(err) || 'Falha ao criar função.',
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleStartEdit = (role: any) => {
    setEditingRole(role)
    setEditFormData({
      name: role.name || '',
      hierarchy_rank: Number(role.hierarchy_rank ?? 0),
      requires_supervision: !!role.requires_supervision,
    })
  }

  const handleSaveEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!editingRole) return

    const trimmed = editFormData.name.trim()
    const validationError = validateRoleName(trimmed, editingRole.id)
    if (validationError) {
      toast({
        title: 'Atenção',
        description: validationError,
        variant: 'destructive',
      })
      return
    }

    setIsUpdating(true)
    try {
      // Salva no MESMO registro existente pelo ID, preservando relações
      await updateStaffRole(editingRole.id, {
        name: trimmed,
        hierarchy_rank: editFormData.hierarchy_rank,
        requires_supervision: editFormData.requires_supervision,
      })
      toast({ title: 'Sucesso', description: 'Nome da função alterado com sucesso.' })
      setEditingRole(null)
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro de persistência',
        description: getErrorMessage(err) || 'Falha ao salvar as alterações da função.',
        variant: 'destructive',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteStaffRole(id)
      await loadData()
      toast({ title: 'Sucesso', description: 'Função removida com sucesso.' })
    } catch (err: any) {
      toast({
        title: 'Erro',
        description:
          getErrorMessage(err) ||
          'Falha ao remover função. Verifique se há colaboradores vinculados.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle>Nova Função</CardTitle>
          <CardDescription>Crie uma função na hierarquia assistencial.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="create-role-name">
                Nome da Função <span className="text-red-500">*</span>
              </Label>
              <Input
                id="create-role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Enfermeiro Júnior"
                disabled={isCreating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role-rank">Ranking Hierárquico</Label>
              <Input
                id="create-role-rank"
                type="number"
                value={rank}
                onChange={(e) => setRank(Number(e.target.value))}
                disabled={isCreating}
              />
            </div>
            <div className="flex items-center space-x-2 h-10">
              <Checkbox
                id="reqsup"
                checked={reqSup}
                onCheckedChange={(c) => setReqSup(c as boolean)}
                disabled={isCreating}
              />
              <label htmlFor="reqsup" className="text-sm font-medium leading-none cursor-pointer">
                Requer Supervisão
              </label>
            </div>
            <Button onClick={handleCreate} className="w-full gap-2" disabled={isCreating}>
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              {isCreating ? 'Adicionando...' : 'Adicionar Função'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Funções Existentes</CardTitle>
          <CardDescription>
            Lista de cargos cadastrados. Clique em <strong>Editar</strong> para renomear ou alterar
            as propriedades da função.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome da Função</TableHead>
                <TableHead>Ranking</TableHead>
                <TableHead>Supervisão</TableHead>
                <TableHead className="w-[160px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500 text-sm">
                    Nenhuma função cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((r) => (
                  <TableRow key={r.id} className="hover:bg-slate-50/70">
                    <TableCell className="font-semibold text-slate-900">{r.name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                        {r.hierarchy_rank ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      {r.requires_supervision ? (
                        <Badge
                          variant="outline"
                          className="text-orange-600 bg-orange-50 border-orange-200 font-medium"
                        >
                          <AlertTriangle className="w-3 h-3 mr-1" /> Exige Enfermeiro
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-emerald-700 bg-emerald-50 border-emerald-200 font-medium"
                        >
                          <ShieldCheck className="w-3 h-3 mr-1" /> Habilitado a Supervisionar
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStartEdit(r)}
                          className="h-8 gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900"
                          aria-label={`Editar função ${r.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Editar</span>
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              aria-label={`Excluir função ${r.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Função</AlertDialogTitle>
                              <AlertDialogDescription>
                                Deseja realmente excluir a função <strong>{r.name}</strong>? Esta
                                ação só pode ser realizada se não houver registros vinculados.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(r.id)}
                                className="bg-red-600 hover:bg-red-700 text-white"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal/Formulário de Edição de Função Existente */}
      <Dialog
        open={!!editingRole}
        onOpenChange={(open) => {
          if (!open && !isUpdating) {
            setEditingRole(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleSaveEdit}>
            <DialogHeader>
              <DialogTitle>Editar Função</DialogTitle>
              <DialogDescription>
                Altere o nome e configurações da função. O registro original e todas as relações
                existentes (colaboradores, escalas, permissões) serão estritamente preservados.
              </DialogDescription>
            </DialogHeader>

            {editingRole && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-role-name">
                    Nome da função <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-role-name"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    placeholder="Nome da função"
                    disabled={isUpdating}
                    autoFocus
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-role-rank">Ranking Hierárquico</Label>
                  <Input
                    id="edit-role-rank"
                    type="number"
                    value={editFormData.hierarchy_rank}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        hierarchy_rank: Number(e.target.value),
                      })
                    }
                    disabled={isUpdating}
                  />
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox
                    id="edit-reqsup"
                    checked={editFormData.requires_supervision}
                    onCheckedChange={(c) =>
                      setEditFormData({
                        ...editFormData,
                        requires_supervision: c as boolean,
                      })
                    }
                    disabled={isUpdating}
                  />
                  <label
                    htmlFor="edit-reqsup"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Requer Supervisão (Exige Enfermeiro)
                  </label>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingRole(null)}
                disabled={isUpdating}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isUpdating} className="gap-2">
                {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
