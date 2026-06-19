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
        department: departmentId,
      })
      setName('')
      setMin(0)
      setIdeal(0)
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Novo Setor</CardTitle>
          <CardDescription>
            Crie um novo setor assistencial para gerenciar sua lotação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Nome do Setor</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: UTI Adulto"
              />
            </div>
            <div className="space-y-2">
              <Label>Lotação Mínima</Label>
              <Input
                type="number"
                min={0}
                value={min}
                onChange={(e) => setMin(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Lotação Ideal</Label>
              <Input
                type="number"
                min={0}
                value={ideal}
                onChange={(e) => setIdeal(Number(e.target.value))}
              />
            </div>
            <Button onClick={handleCreate} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Setor
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regras de Lotação (No-Code)</CardTitle>
          <CardDescription>Edite a lotação em tempo real clicando nos campos.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Setor</TableHead>
                <TableHead>Lotação Mínima</TableHead>
                <TableHead>Lotação Ideal</TableHead>
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
                      className="w-48 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        defaultValue={s.min_staffing}
                        onBlur={(e) => handleUpdate(s.id, 'min_staffing', Number(e.target.value))}
                        className="w-24 h-8"
                      />
                      <span className="text-xs text-muted-foreground">profs/turno</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      defaultValue={s.ideal_staffing}
                      onBlur={(e) => handleUpdate(s.id, 'ideal_staffing', Number(e.target.value))}
                      className="w-24 h-8"
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
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
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
