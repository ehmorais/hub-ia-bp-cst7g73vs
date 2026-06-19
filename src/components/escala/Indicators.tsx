import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { getTimeoffRequests, getShiftCycles } from '@/services/escala'
import { useRealtime } from '@/hooks/use-realtime'

export function Indicators() {
  const [requests, setRequests] = useState<any[]>([])
  const [cycles, setCycles] = useState<any[]>([])

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

  const activeCycle = cycles.find((c) => c.status === 'active') || cycles[0]
  const cycleReqs = requests.filter((r) => r.cycle === activeCycle?.id)
  const fulfilledReqs = cycleReqs.filter((r) => r.status === 'fulfilled').length
  const fulfillmentRate = cycleReqs.length
    ? Math.round((fulfilledReqs / cycleReqs.length) * 100)
    : 100
  const coverageIndex = 94

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h3 className="text-lg font-medium">Indicadores de Desempenho</h3>
        <p className="text-sm text-muted-foreground">
          Métricas e performance dos ciclos de escala operacionais.
        </p>
      </div>
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
    </div>
  )
}
