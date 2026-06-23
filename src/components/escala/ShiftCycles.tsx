import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getShiftCycles, createShiftCycle, updateShiftCycle } from '@/services/escala'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useRealtime } from '@/hooks/use-realtime'
import { Pencil } from 'lucide-react'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { format, addMonths, setDate } from 'date-fns'
import { Badge } from '@/components/ui/badge'

export function ShiftCycles() {
  const [cycles, setCycles] = useState<any[]>([])
  const [isOpen, setIsOpen] = useState(false)

  const today = new Date()
  const startD = setDate(today, 26)
  const endD = setDate(addMonths(today, 1), 25)
  const deadline = setDate(addMonths(today, 1), 10)

  const [formData, setFormData] = useState({
    name: `Ciclo ${format(startD, 'MM/yyyy')}`,
    start_date: format(startD, 'yyyy-MM-dd') + ' 00:00:00.000Z',
    end_date: format(endD, 'yyyy-MM-dd') + ' 23:59:59.000Z',
    request_deadline: format(deadline, 'yyyy-MM-dd') + ' 23:59:59.000Z',
    status: 'draft',
  })

  const [editingCycle, setEditingCycle] = useState<any>(null)
  const [editFormData, setEditFormData] = useState<any>(null)

  const { toast } = useToast()

  const loadData = () => {
    getShiftCycles().then(setCycles)
  }
  useEffect(() => {
    loadData()
  }, [])

  useRealtime('shift_cycles', loadData)

  const handleSubmit = async () => {
    try {
      await createShiftCycle(formData)
      toast({ title: 'Sucesso', description: 'Ciclo criado' })
      setIsOpen(false)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-800">Ciclos de Escala (26 a 25)</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>Novo Ciclo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Ciclo Padrão</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Início (Dia 26)</label>
                  <Input
                    type="date"
                    value={formData.start_date.split(' ')[0]}
                    onChange={(e) =>
                      setFormData({ ...formData, start_date: e.target.value + ' 00:00:00.000Z' })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fim (Dia 25)</label>
                  <Input
                    type="date"
                    value={formData.end_date.split(' ')[0]}
                    onChange={(e) =>
                      setFormData({ ...formData, end_date: e.target.value + ' 23:59:59.000Z' })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Prazo Folgas (Dia 10)</label>
                <Input
                  type="date"
                  value={formData.request_deadline.split(' ')[0]}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      request_deadline: e.target.value + ' 23:59:59.000Z',
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status Inicial</label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
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
              <Button className="w-full" onClick={handleSubmit}>
                Criar Ciclo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Prazo Folgas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[140px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cycles.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>
                  {format(new Date(c.start_date), 'dd/MM/yyyy')} a{' '}
                  {format(new Date(c.end_date), 'dd/MM/yyyy')}
                </TableCell>
                <TableCell>{format(new Date(c.request_deadline), 'dd/MM/yyyy')}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      c.status === 'active'
                        ? 'default'
                        : c.status === 'draft'
                          ? 'secondary'
                          : 'destructive'
                    }
                  >
                    {c.status.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      setEditingCycle(c)
                      setEditFormData({
                        name: c.name,
                        start_date: c.start_date.split(' ')[0],
                        end_date: c.end_date.split(' ')[0],
                        request_deadline: c.request_deadline.split(' ')[0],
                        status: c.status,
                      })
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Editar Ciclo
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editingCycle} onOpenChange={(open) => !open && setEditingCycle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Ciclo</DialogTitle>
          </DialogHeader>
          {editFormData && (
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome</label>
                <Input
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Início</label>
                  <Input
                    type="date"
                    value={editFormData.start_date}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, start_date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fim</label>
                  <Input
                    type="date"
                    value={editFormData.end_date}
                    onChange={(e) => setEditFormData({ ...editFormData, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Prazo Folgas</label>
                <Input
                  type="date"
                  value={editFormData.request_deadline}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, request_deadline: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={editFormData.status}
                  onValueChange={(v) => setEditFormData({ ...editFormData, status: v })}
                >
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
              <Button
                className="w-full"
                onClick={async () => {
                  try {
                    const start = new Date(editFormData.start_date + 'T00:00:00')
                    const end = new Date(editFormData.end_date + 'T23:59:59')

                    if (end < start) {
                      throw new Error('A data de fim não pode ser anterior à data de início.')
                    }

                    await updateShiftCycle(editingCycle.id, {
                      name: editFormData.name,
                      start_date: editFormData.start_date + ' 00:00:00.000Z',
                      end_date: editFormData.end_date + ' 23:59:59.000Z',
                      request_deadline: editFormData.request_deadline + ' 23:59:59.000Z',
                      status: editFormData.status,
                    })
                    toast({ title: 'Sucesso', description: 'Ciclo atualizado com sucesso' })
                    setEditingCycle(null)
                    loadData()
                  } catch (err: any) {
                    toast({
                      title: 'Erro',
                      description: getErrorMessage(err),
                      variant: 'destructive',
                    })
                  }
                }}
              >
                Salvar Alterações
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
