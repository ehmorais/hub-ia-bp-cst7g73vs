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
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ShieldAlert, Trash2, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import {
  getHospitalSectors,
  createHospitalSector,
  updateHospitalSector,
  deleteHospitalSector,
} from '@/services/escala'
import { useRealtime } from '@/hooks/use-realtime'

export function Sectors({ departmentId }: { departmentId?: string }) {
  const [sectors, setSectors] = useState<any[]>([])
  const [name, setName] = useState('')
  const [min, setMin] = useState(0)
  const [ideal, setIdeal] = useState(0)
  const [bedCapacity, setBedCapacity] = useState(0)
  const [staffingRatio, setStaffingRatio] = useState(10)
  const [isCritical, setIsCritical] = useState(false)
  const { toast } = useToast()

  const loadData = async () =>
    getHospitalSectors(departmentId).then(setSectors).catch(console.error)
  useEffect(() => {
    loadData()
  }, [departmentId])
  useRealtime('hospital_sectors', loadData)

  const handleCreate = async () => {
    if (!name)
      return toast({ title: 'Erro', description: 'Nome obrigatório', variant: 'destructive' })
    try {
      await createHospitalSector({
        name,
        min_staffing: min,
        ideal_staffing: ideal,
        bed_capacity: bedCapacity,
        staffing_ratio: staffingRatio,
        is_critical: isCritical,
        department: departmentId,
      })
      setName('')
      setMin(0)
      setIdeal(0)
      setBedCapacity(0)
      setStaffingRatio(10)
      setIsCritical(false)
      toast({ title: 'Setor criado' })
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    }
  }

  const handleUpdate = async (id: string, field: string, val: any) => {
    try {
      await updateHospitalSector(id, { [field]: val })
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteHospitalSector(id)
      toast({ title: 'Setor removido' })
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle>Novo Setor</CardTitle>
          <CardDescription>
            Crie um novo setor assistencial e defina regras de dimensionamento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
            <div className="space-y-2 md:col-span-2">
              <Label>Nome do Setor</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: UTI Adulto"
              />
            </div>
            <div className="space-y-2">
              <Label>Leitos</Label>
              <Input
                type="number"
                min={0}
                value={bedCapacity}
                onChange={(e) => setBedCapacity(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Ratio (1:X)</Label>
              <Input
                type="number"
                min={1}
                value={staffingRatio}
                onChange={(e) => setStaffingRatio(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Min. Profs</Label>
              <Input
                type="number"
                min={0}
                value={min}
                onChange={(e) => setMin(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Ideal Profs</Label>
              <Input
                type="number"
                min={0}
                value={ideal}
                onChange={(e) => setIdeal(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2 flex flex-col pb-2">
              <Label className="mb-2">Crítico?</Label>
              <Switch checked={isCritical} onCheckedChange={setIsCritical} />
            </div>
            <div className="md:col-span-7">
              <Button onClick={handleCreate} className="w-full md:w-auto mt-2">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Setor
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setores e Dimensionamento</CardTitle>
          <CardDescription>Gerencie a lotação e proporções de leitos.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Setor</TableHead>
                <TableHead>Leitos</TableHead>
                <TableHead>Ratio (1:X)</TableHead>
                <TableHead>Mínimo</TableHead>
                <TableHead>Ideal</TableHead>
                <TableHead>Crítico?</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sectors.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-orange-500" />
                    <Input
                      defaultValue={s.name}
                      onBlur={(e) => handleUpdate(s.id, 'name', e.target.value)}
                      className="w-40 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      defaultValue={s.bed_capacity || 0}
                      onBlur={(e) => handleUpdate(s.id, 'bed_capacity', Number(e.target.value))}
                      className="w-20 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      defaultValue={s.staffing_ratio || 10}
                      onBlur={(e) => handleUpdate(s.id, 'staffing_ratio', Number(e.target.value))}
                      className="w-20 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      defaultValue={s.min_staffing}
                      onBlur={(e) => handleUpdate(s.id, 'min_staffing', Number(e.target.value))}
                      className="w-20 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      defaultValue={s.ideal_staffing}
                      onBlur={(e) => handleUpdate(s.id, 'ideal_staffing', Number(e.target.value))}
                      className="w-20 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={s.is_critical}
                      onCheckedChange={(val) => handleUpdate(s.id, 'is_critical', val)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {sectors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    Nenhum setor.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
