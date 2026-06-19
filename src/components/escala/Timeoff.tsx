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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { getTimeoffRequests, updateTimeoffRequest } from '@/services/escala'
import { useRealtime } from '@/hooks/use-realtime'
import { format } from 'date-fns'

export function Timeoff() {
  const [requests, setRequests] = useState<any[]>([])
  const { toast } = useToast()

  const loadData = async () => {
    getTimeoffRequests().then(setRequests)
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('timeoff_requests', loadData)

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateTimeoffRequest(id, { status })
      toast({ title: 'Status atualizado' })
    } catch {
      toast({ title: 'Erro', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Solicitações de Folga</CardTitle>
          <CardDescription>Visão geral de pedidos e gestão de deferimentos.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profissional</TableHead>
                <TableHead>Data Solicitada</TableHead>
                <TableHead>Ciclo</TableHead>
                <TableHead>Peso de Prioridade</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.expand?.user?.name}</TableCell>
                  <TableCell>{format(new Date(r.date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{r.expand?.cycle?.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.priority_weight >= 8
                          ? 'destructive'
                          : r.priority_weight >= 5
                            ? 'default'
                            : 'secondary'
                      }
                    >
                      {r.priority_weight} / 10
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select value={r.status} onValueChange={(val) => handleStatusChange(r.id, val)}>
                      <SelectTrigger className="w-[160px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="fulfilled">Atendida</SelectItem>
                        <SelectItem value="not_fulfilled">Não Atendida</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    Nenhuma solicitação.
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
