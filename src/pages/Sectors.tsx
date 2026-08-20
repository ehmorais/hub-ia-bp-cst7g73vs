import { useState, useEffect, useCallback, useRef } from 'react'
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
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
  DialogDescription,
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
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { ShieldAlert, Trash2, Plus, Pencil, Building2, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import {
  getHospitalSectors,
  createHospitalSector,
  updateHospitalSector,
  deleteHospitalSector,
  checkSectorReferences,
  getStaffProfiles,
} from '@/services/escala'
import { getDepartments } from '@/services/admin'
import { useRealtime } from '@/hooks/use-realtime'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

interface SectorForm {
  name: string
  department: string
  min_staffing: number
  ideal_staffing: number
  bed_capacity: number
  staffing_ratio: number
  is_critical: boolean
  active: boolean
}

const emptyForm: SectorForm = {
  name: '',
  department: '',
  min_staffing: 0,
  ideal_staffing: 0,
  bed_capacity: 0,
  staffing_ratio: 10,
  is_critical: false,
  active: true,
}

export default function Sectors() {
  const [sectors, setSectors] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [staffCounts, setStaffCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SectorForm>(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)

  // Exclusão: preflight de referências + diálogo de bloqueio/desativação.
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [deleteRefs, setDeleteRefs] = useState<{
    staffProfiles: number
    shifts: number
    drafts: number
    runs: number
    total: number
  } | null>(null)
  const [deleteChecking, setDeleteChecking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  // Filtro de ativos/inativos.
  const [showInactive, setShowInactive] = useState(false)

  const { toast } = useToast()
  const loadRequestRef = useRef(0)

  const loadData = useCallback(async () => {
    const requestId = ++loadRequestRef.current
    try {
      const [sectorRecords, deptRecords, staffRecords] = await Promise.all([
        getHospitalSectors(),
        getDepartments(),
        getStaffProfiles(),
      ])
      const counts = staffRecords.reduce<Record<string, number>>((result, profile) => {
        if (profile.default_sector) {
          result[profile.default_sector] = (result[profile.default_sector] || 0) + 1
        }
        return result
      }, {})
      // Evita que uma leitura antiga, ainda em andamento, apague visualmente
      // um setor que acabou de ser confirmado pelo servidor.
      if (requestId === loadRequestRef.current) {
        setSectors(sectorRecords)
        setDepartments(deptRecords)
        setStaffCounts(counts)
      }
    } catch {
      if (requestId === loadRequestRef.current) {
        toast({
          title: 'Erro',
          description: 'Falha ao carregar setores.',
          variant: 'destructive',
        })
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false)
      }
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('hospital_sectors', loadData)
  useRealtime('staff_profiles', loadData)

  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setFieldErrors({})
    setDialogOpen(true)
  }

  const openEdit = (sector: any) => {
    setForm({
      name: sector.name || '',
      department: sector.department || '',
      min_staffing: sector.min_staffing || 0,
      ideal_staffing: sector.ideal_staffing || 0,
      bed_capacity: sector.bed_capacity || 0,
      staffing_ratio: sector.staffing_ratio || 10,
      is_critical: sector.is_critical || false,
      active: sector.active !== false,
    })
    setEditingId(sector.id)
    setFieldErrors({})
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFieldErrors({ name: 'Nome é obrigatório' })
      return
    }
    if (!form.department) {
      setFieldErrors({ department: 'Departamento é obrigatório' })
      return
    }

    setSaving(true)
    setFieldErrors({})
    try {
      const payload = {
        name: form.name.trim(),
        department: form.department,
        min_staffing: form.min_staffing,
        ideal_staffing: form.ideal_staffing,
        bed_capacity: form.bed_capacity,
        staffing_ratio: form.staffing_ratio,
        is_critical: form.is_critical,
        active: form.active,
      }
      const savedSector = editingId
        ? await updateHospitalSector(editingId, payload)
        : await createHospitalSector(payload)

      setSectors((current) =>
        [...current.filter((sector) => sector.id !== savedSector.id), savedSector].sort((a, b) =>
          String(a.name).localeCompare(String(b.name), 'pt-BR'),
        ),
      )
      await loadData()

      toast({
        title: editingId ? 'Setor atualizado' : 'Setor criado',
        description: savedSector.name,
      })
      setDialogOpen(false)
      setForm(emptyForm)
      setEditingId(null)
    } catch (e: any) {
      const errors = extractFieldErrors(e)
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors)
        toast({
          title: 'Erro de validação',
          description: Object.values(errors).join(' '),
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Erro',
          description: e.message || 'Falha ao salvar setor.',
          variant: 'destructive',
        })
      }
    } finally {
      setSaving(false)
    }
  }

  // Preflight: ao clicar em excluir, contamos as referências antes de tentar.
  const openDelete = async (sector: any) => {
    setDeleteTarget(sector)
    setDeleteRefs(null)
    setDeleteChecking(true)
    try {
      const refs = await checkSectorReferences(sector.id)
      setDeleteRefs(refs)
    } catch {
      // Se o preflight falhar, deixamos tentar a exclusão direto (fallback).
      setDeleteRefs(null)
    } finally {
      setDeleteChecking(false)
    }
  }

  const closeDelete = () => {
    setDeleteTarget(null)
    setDeleteRefs(null)
    setDeleting(false)
    setDeactivating(false)
  }

  const handleDeactivate = async () => {
    if (!deleteTarget) return
    setDeactivating(true)
    try {
      await updateHospitalSector(deleteTarget.id, { active: false })
      toast({ title: 'Setor desativado', description: deleteTarget.name })
      closeDelete()
    } catch (e: any) {
      toast({
        title: 'Erro ao desativar',
        description: e.message || 'Falha ao desativar setor.',
        variant: 'destructive',
      })
    } finally {
      setDeactivating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteHospitalSector(deleteTarget.id)
      toast({ title: 'Setor removido', description: deleteTarget.name })
      closeDelete()
    } catch (e: any) {
      // Erro 400 de relation reference — recarregamos as referências e
      // oferecemos desativar como alternativa segura.
      try {
        const refs = await checkSectorReferences(deleteTarget.id)
        setDeleteRefs(refs)
      } catch (_) {
        /* mantém o que houver */
      }
      toast({
        title: 'Não foi possível excluir',
        description:
          'Existem registros vinculados a este setor. Desative-o como alternativa segura.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const getDeptName = (deptId: string) => {
    const dept = departments.find((d) => d.id === deptId)
    return dept?.name || '—'
  }

  const visibleSectors = sectors.filter((s) => (showInactive ? true : s.active !== false))
  const activeCount = sectors.filter((s) => s.active !== false).length
  const inactiveCount = sectors.length - activeCount

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#06402B] flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Setores
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie áreas de trabalho, dimensionamento e criticidade.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-[#06402B] hover:bg-[#06402B]/90">
          <Plus className="h-4 w-4 mr-2" />
          Novo Setor
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle>Setores e Dimensionamento</CardTitle>
              <CardDescription>
                {activeCount} ativo(s) · {inactiveCount} inativo(s). A lista atualiza
                automaticamente.
              </CardDescription>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} />
              Mostrar inativos
            </label>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Setor</TableHead>
                <TableHead>Colaboradores</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Leitos</TableHead>
                <TableHead>Ratio (1:X)</TableHead>
                <TableHead>Mín. Profs</TableHead>
                <TableHead>Ideal Profs</TableHead>
                <TableHead>Crítico</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : visibleSectors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    {showInactive
                      ? 'Nenhum setor cadastrado.'
                      : 'Nenhum setor ativo. Ative "Mostrar inativos" para ver todos.'}
                  </TableCell>
                </TableRow>
              ) : (
                visibleSectors.map((s) => (
                  <TableRow
                    key={s.id}
                    className={`hover:bg-slate-50/50 ${s.active === false ? 'opacity-60' : ''}`}
                  >
                    <TableCell className="font-medium flex items-center gap-2">
                      {s.is_critical && <ShieldAlert className="h-4 w-4 text-orange-500" />}
                      {s.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {staffCounts[s.id] || 0}{' '}
                        {(staffCounts[s.id] || 0) === 1 ? 'colaborador' : 'colaboradores'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-600">{getDeptName(s.department)}</span>
                    </TableCell>
                    <TableCell>{s.bed_capacity ?? 0}</TableCell>
                    <TableCell>{s.staffing_ratio ?? 10}</TableCell>
                    <TableCell>{s.min_staffing ?? 0}</TableCell>
                    <TableCell>{s.ideal_staffing ?? 0}</TableCell>
                    <TableCell>
                      {s.is_critical ? (
                        <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600">
                          Crítico
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Normal</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.active === false ? (
                        <Badge variant="secondary" className="bg-slate-300 text-slate-700">
                          Inativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-green-500 text-green-700">
                          Ativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(s)}
                          className="h-8 w-8"
                          title="Editar setor"
                        >
                          <Pencil className="h-4 w-4 text-slate-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDelete(s)}
                          className="h-8 w-8"
                          title="Excluir setor"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Setor' : 'Novo Setor'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Atualize os dados do setor hospitalar.'
                : 'Preencha os dados para criar um novo setor.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sector-name">
                Nome do Setor <span className="text-red-500">*</span>
              </Label>
              <Input
                id="sector-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: UTI Adulto"
                className={fieldErrors.name ? 'border-red-500' : ''}
              />
              {fieldErrors.name && <p className="text-sm text-red-500">{fieldErrors.name}</p>}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>
                Departamento <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.department}
                onValueChange={(val) => setForm({ ...form, department: val })}
              >
                <SelectTrigger className={fieldErrors.department ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Selecione um departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.department && (
                <p className="text-sm text-red-500">{fieldErrors.department}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Leitos</Label>
              <Input
                type="number"
                min={0}
                value={form.bed_capacity}
                onChange={(e) => setForm({ ...form, bed_capacity: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Ratio (1:X)</Label>
              <Input
                type="number"
                min={1}
                value={form.staffing_ratio}
                onChange={(e) => setForm({ ...form, staffing_ratio: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Mín. Profissionais</Label>
              <Input
                type="number"
                min={0}
                value={form.min_staffing}
                onChange={(e) => setForm({ ...form, min_staffing: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Ideal Profissionais</Label>
              <Input
                type="number"
                min={0}
                value={form.ideal_staffing}
                onChange={(e) => setForm({ ...form, ideal_staffing: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2 flex items-center gap-3 pt-2">
              <Switch
                checked={form.is_critical}
                onCheckedChange={(val) => setForm({ ...form, is_critical: val })}
              />
              <Label className="cursor-pointer">Setor crítico</Label>
            </div>
            {editingId && (
              <div className="space-y-2 sm:col-span-2 flex items-center gap-3">
                <Switch
                  checked={form.active}
                  onCheckedChange={(val) => setForm({ ...form, active: val })}
                />
                <Label className="cursor-pointer">Setor ativo</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#06402B] hover:bg-[#06402B]/90"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? 'Salvar Alterações' : 'Criar Setor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && closeDelete()}>
        <AlertDialogContent className="sm:max-w-[480px]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteRefs && deleteRefs.total > 0
                ? 'Não é possível excluir este setor'
                : 'Confirmar exclusão'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {deleteChecking ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verificando vínculos do setor <strong>{deleteTarget?.name}</strong>…
                  </span>
                ) : deleteRefs && deleteRefs.total > 0 ? (
                  <>
                    <span>
                      O setor <strong>{deleteTarget?.name}</strong> possui registros vinculados e
                      não pode ser excluído. Remova ou realoque os vínculos antes de tentar
                      novamente — ou desative o setor como alternativa segura.
                    </span>
                    <ul className="list-disc pl-5 space-y-1 text-slate-700">
                      <li>Colaboradores (staff_profiles): {deleteRefs.staffProfiles}</li>
                      <li>Plantões (shifts): {deleteRefs.shifts}</li>
                      <li>Rascunhos (schedule_drafts): {deleteRefs.drafts}</li>
                      <li>Execuções (schedule_generation_runs): {deleteRefs.runs}</li>
                    </ul>
                  </>
                ) : (
                  <span>
                    Tem certeza que deseja remover o setor <strong>{deleteTarget?.name}</strong>?
                    Esta ação não pode ser desfeita.
                  </span>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting || deactivating}>Cancelar</AlertDialogCancel>
            {deleteRefs && deleteRefs.total > 0 ? (
              <AlertDialogAction
                onClick={handleDeactivate}
                disabled={deactivating || deleteChecking}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {deactivating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Desativar Setor
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting || deleteChecking}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Excluir
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
