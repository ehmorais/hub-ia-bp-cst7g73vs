import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
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
import { ShieldAlert, Trash2, Plus, Pencil, Building2, ArrowLeft, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import {
  getHospitalSectors,
  createHospitalSector,
  updateHospitalSector,
  deleteHospitalSector,
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
}

const emptyForm: SectorForm = {
  name: '',
  department: '',
  min_staffing: 0,
  ideal_staffing: 0,
  bed_capacity: 0,
  staffing_ratio: 10,
  is_critical: false,
}

export default function Sectors() {
  const [sectors, setSectors] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SectorForm>(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  const loadData = useCallback(async () => {
    try {
      const [sectorRecords, deptRecords] = await Promise.all([
        getHospitalSectors(),
        getDepartments(),
      ])
      setSectors(sectorRecords)
      setDepartments(deptRecords)
    } catch (e: any) {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar setores.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('hospital_sectors', () => {
    loadData()
  })

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
      }
      if (editingId) {
        await updateHospitalSector(editingId, payload)
        toast({ title: 'Setor atualizado', description: form.name })
      } else {
        await createHospitalSector(payload)
        toast({ title: 'Setor criado', description: form.name })
      }
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

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteHospitalSector(deleteTarget.id)
      toast({ title: 'Setor removido', description: deleteTarget.name })
      setDeleteTarget(null)
    } catch (e: any) {
      toast({
        title: 'Erro',
        description: e.message || 'Falha ao remover setor.',
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

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#06402B] flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              Setores Hospitalares
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Gerencie áreas de trabalho, dimensionamento e criticidade.
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-[#06402B] hover:bg-[#06402B]/90">
          <Plus className="h-4 w-4 mr-2" />
          Novo Setor
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Setores e Dimensionamento</CardTitle>
          <CardDescription>
            {sectors.length} setor(es) cadastrado(s). A lista atualiza automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Setor</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Leitos</TableHead>
                <TableHead>Ratio (1:X)</TableHead>
                <TableHead>Mín. Profs</TableHead>
                <TableHead>Ideal Profs</TableHead>
                <TableHead>Crítico</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : sectors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum setor cadastrado. Clique em "Novo Setor" para começar.
                  </TableCell>
                </TableRow>
              ) : (
                sectors.map((s) => (
                  <TableRow key={s.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium flex items-center gap-2">
                      {s.is_critical && <ShieldAlert className="h-4 w-4 text-orange-500" />}
                      {s.name}
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
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(s)}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4 text-slate-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(s)}
                          className="h-8 w-8"
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o setor <strong>{deleteTarget?.name}</strong>? Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
