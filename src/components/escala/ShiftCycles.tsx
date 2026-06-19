import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Plus, Trash2, Edit } from 'lucide-react'
import { format } from 'date-fns'
import { useToast } from '@/components/ui/use-toast'
import {
  getShiftCycles,
  createShiftCycle,
  updateShiftCycle,
  deleteShiftCycle,
} from '@/services/escala'
import { useRealtime } from '@/hooks/use-realtime'

export function ShiftCycles() {
  const { toast } = useToast()
  const [cycles, setCycles] = useState<any[]>([])

  // Create form state
  const [cName, setCName] = useState('')
  const [cStart, setCStart] = useState('')
  const [cEnd, setCEnd] = useState('')
  const [cDeadline, setCDeadline] = useState('')

  // Edit sheet state
  const [editingCycle, setEditingCycle] = useState<any>(null)
  const [editName, setEditName] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editDeadline, setEditDeadline] = useState('')
  const [editStatus, setEditStatus] = useState('')

  const loadData = async () => getShiftCycles().then(setCycles).catch(console.error)
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('shift_cycles', loadData)

  const handleCreate = async () => {
    if (!cName || !cStart || !cEnd || !cDeadline) {
      return toast({
        title: 'Erro',
        description: 'Preencha todos os campos.',
        variant: 'destructive',
      })
    }
    try {
      await createShiftCycle({
        name: cName,
        start_date: cStart + ' 12:00:00.000Z',
        end_date: cEnd + ' 12:00:00.000Z',
        request_deadline: cDeadline + ' 12:00:00.000Z',
        status: 'draft',
      })
      toast({ title: 'Ciclo criado' })
      setCName('')
      setCStart('')
      setCEnd('')
      setCDeadline('')
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    }
  }

  const openEdit = (c: any) => {
    setEditingCycle(c)
    setEditName(c.name)
    setEditStart(c.start_date.substring(0, 10))
    setEditEnd(c.end_date.substring(0, 10))
    setEditDeadline(c.request_deadline.substring(0, 10))
    setEditStatus(c.status)
  }

  const handleUpdate = async () => {
    try {
      await updateShiftCycle(editingCycle.id, {
        name: editName,
        start_date: editStart + ' 12:00:00.000Z',
        end_date: editEnd + ' 12:00:00.000Z',
        request_deadline: editDeadline + ' 12:00:00.000Z',
        status: editStatus,
      })
      toast({ title: 'Ciclo atualizado' })
      setEditingCycle(null)
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteShiftCycle(id)
      toast({ title: 'Ciclo removido' })
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Novo Ciclo</CardTitle>
          <CardDescription>Crie um ciclo definindo o período de validade.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="Ex: Janeiro 2027"
              />
            </div>
            <div className="space-y-2">
              <Label>Início</Label>
              <Input type="date" value={cStart} onChange={(e) => setCStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Término</Label>
              <Input type="date" value={cEnd} onChange={(e) => setCEnd(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Prazo para Pedidos</Label>
              <Input type="date" value={cDeadline} onChange={(e) => setCDeadline(e.target.value)} />
            </div>
            <Button onClick={handleCreate} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Criar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ciclos Existentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Término</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cycles.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{format(new Date(c.start_date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{format(new Date(c.end_date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        c.status === 'active'
                          ? 'default'
                          : c.status === 'closed'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                      <Edit className="h-4 w-4 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {cycles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    Nenhum ciclo.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={!!editingCycle} onOpenChange={(o) => !o && setEditingCycle(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Editar Ciclo</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Início</Label>
              <Input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Término</Label>
              <Input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Input
                type="date"
                value={editDeadline}
                onChange={(e) => setEditDeadline(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="closed">Fechado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleUpdate} className="w-full">
              Salvar Alterações
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
