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
import { getTimeoffRequests, updateTimeoffRequest, getShiftCycles } from '@/services/escala'
import { useRealtime } from '@/hooks/use-realtime'
import { format } from 'date-fns'
import { CheckCircle2 } from 'lucide-react'

export function Timeoff() {
  const [requests, setRequests] = useState<any[]>([])
  const [cycles, setCycles] = useState<any[]>([])
  const { toast } = useToast()

  const loadData = async () => {
    Promise.all([getTimeoffRequests(), getShiftCycles()]).then(([req, cy]) => {
      setRequests(req)
      setCycles(cy)
    })
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('timeoff_requests', loadData)
  useRealtime('shift_cycles', loadData)

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateTimeoffRequest(id, { status })
      toast({ title: 'Status atualizado' })
    } catch {
      toast({ title: 'Erro', variant: 'destructive' })
    }
  }

  const activeCycle = cycles.find((c) => c.status === 'active') || cycles[0]
  const cycleReqs = requests.filter((r) => r.cycle === activeCycle?.id)
  const fulfilledReqs = cycleReqs.filter((r) => r.status === 'fulfilled').length
  const fulfillmentRate = cycleReqs.length
    ? Math.round((fulfilledReqs / cycleReqs.length) * 100)
    : 100
  const coverageIndex = 94

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
          <CardHeader className="pb-2">
            <CardDescription className="text-blue-600 font-medium">
              Taxa de Atendimento de Folgas
            </CardDescription>
            <CardTitle className="text-4xl text-blue-900">{fulfillmentRate}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-blue-700/80">
              Ciclo ativo: {activeCycle?.name || 'Nenhum'}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-2 w-full bg-blue-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600" style={{ width: `${fulfillmentRate}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100">
          <CardHeader className="pb-2">
            <CardDescription className="text-emerald-600 font-medium">
              Índice de Cobertura Mínima
            </CardDescription>
            <CardTitle className="text-4xl text-emerald-900">{coverageIndex}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-emerald-700/80">
              Setores operando dentro da margem de segurança
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-2 w-full bg-emerald-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600" style={{ width: `${coverageIndex}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
