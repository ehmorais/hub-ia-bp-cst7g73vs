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
import { Trash2, Plus, Clock } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Switch } from '@/components/ui/switch'
import { getShiftTypes, createShiftType, updateShiftType, deleteShiftType } from '@/services/escala'
import { useRealtime } from '@/hooks/use-realtime'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export function ShiftTypes() {
  const [types, setTypes] = useState<any[]>([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [workHours, setWorkHours] = useState(12)
  const [restHours, setRestHours] = useState(36)
  const [isAdministrative, setIsAdministrative] = useState(false)
  const { toast } = useToast()

  const loadData = async () => getShiftTypes().then(setTypes).catch(console.error)
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('shift_types', loadData)

  const handleCreate = async () => {
    if (!name || !code)
      return toast({
        title: 'Erro',
        description: 'Nome e código obrigatórios',
        variant: 'destructive',
      })

    if (!startTime || !endTime) {
      return toast({
        title: 'Erro',
        description: 'Horário de início e fim são obrigatórios',
        variant: 'destructive',
      })
    }

    if (types.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      return toast({
        title: 'Erro',
        description: 'Nome de turno já existe.',
        variant: 'destructive',
      })
    }

    if (types.some((t) => t.code === code)) {
      return toast({
        title: 'Erro',
        description: 'Código de turno já existe.',
        variant: 'destructive',
      })
    }

    try {
      await createShiftType({
        name,
        code,
        start_time: startTime,
        end_time: endTime,
        work_hours: workHours,
        rest_hours: restHours,
        is_administrative: isAdministrative,
      })
      setName('')
      setCode('')
      setStartTime('')
      setEndTime('')
      setWorkHours(12)
      setRestHours(36)
      setIsAdministrative(false)
      toast({
        title: 'Tipo de escala criado',
        className: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      })
    } catch (e: any) {
      toast({ title: 'Erro', description: getErrorMessage(e), variant: 'destructive' })
    }
  }

  const handleUpdate = async (id: string, field: string, val: any) => {
    if (field === 'code' && types.some((t) => t.id !== id && t.code === val)) {
      return toast({
        title: 'Erro',
        description: 'Código de turno já existe.',
        variant: 'destructive',
      })
    }
    if (
      field === 'name' &&
      types.some((t) => t.id !== id && t.name.toLowerCase() === String(val).toLowerCase())
    ) {
      return toast({
        title: 'Erro',
        description: 'Nome de turno já existe.',
        variant: 'destructive',
      })
    }
    try {
      await updateShiftType(id, { [field]: val })
    } catch (e: any) {
      toast({ title: 'Erro', description: getErrorMessage(e), variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteShiftType(id)
      toast({ title: 'Tipo de escala removido' })
    } catch (e: any) {
      toast({ title: 'Erro', description: getErrorMessage(e), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle>Novo Tipo de Escala</CardTitle>
          <CardDescription>
            Defina modelos de trabalho e horários (Ex: Manhã das 07:00 às 13:00).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-8 gap-4 items-end">
            <div className="space-y-2 md:col-span-2">
              <Label>Nome (Ex: Manhã)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Manhã" />
            </div>
            <div className="space-y-2">
              <Label>Código Único</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="MANHA" />
            </div>
            <div className="space-y-2">
              <Label>Início</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Horas Trab.</Label>
              <Input
                type="number"
                min={0}
                value={workHours}
                onChange={(e) => setWorkHours(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Horas Folga</Label>
              <Input
                type="number"
                min={0}
                value={restHours}
                onChange={(e) => setRestHours(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2 flex flex-col items-center">
              <Label className="mb-2">Admin?</Label>
              <Switch checked={isAdministrative} onCheckedChange={setIsAdministrative} />
            </div>
            <div className="md:col-span-8">
              <Button onClick={handleCreate} className="w-full md:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Tipo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tipos Cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Horários</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Carga Horária</TableHead>
                <TableHead className="text-center">Admin</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <Input
                      defaultValue={t.name}
                      onBlur={(e) => handleUpdate(t.id, 'name', e.target.value)}
                      className="w-40 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <Input
                        type="time"
                        defaultValue={t.start_time}
                        onBlur={(e) => handleUpdate(t.id, 'start_time', e.target.value)}
                        className="w-24 h-8"
                      />
                      <span>-</span>
                      <Input
                        type="time"
                        defaultValue={t.end_time}
                        onBlur={(e) => handleUpdate(t.id, 'end_time', e.target.value)}
                        className="w-24 h-8"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      defaultValue={t.code}
                      onBlur={(e) => handleUpdate(t.id, 'code', e.target.value)}
                      className="w-24 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <Input
                        type="number"
                        defaultValue={t.work_hours}
                        onBlur={(e) => handleUpdate(t.id, 'work_hours', Number(e.target.value))}
                        className="w-16 h-8"
                      />
                      <span>x</span>
                      <Input
                        type="number"
                        defaultValue={t.rest_hours}
                        onBlur={(e) => handleUpdate(t.id, 'rest_hours', Number(e.target.value))}
                        className="w-16 h-8"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={t.is_administrative}
                      onCheckedChange={(val) => handleUpdate(t.id, 'is_administrative', val)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {types.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    Nenhum tipo de escala cadastrado.
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
