import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { getShiftCycles, generateShifts, getShifts } from '@/services/escala'
import { useRealtime } from '@/hooks/use-realtime'
import { Wand2, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import pb from '@/lib/pocketbase/client'

export function AutoGenerate({
  departmentId,
  projectId,
}: {
  departmentId?: string
  projectId?: string
}) {
  const [cycles, setCycles] = useState<any[]>([])
  const [selectedCycle, setSelectedCycle] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [shifts, setShifts] = useState<any[]>([])
  const { toast } = useToast()

  const loadData = async () => {
    getShiftCycles().then((c) => {
      setCycles(c)
      if (!selectedCycle && c.length > 0) {
        setSelectedCycle(c.find((x: any) => x.status === 'active')?.id || c[0].id)
      }
    })
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedCycle) {
      getShifts(selectedCycle).then(setShifts)
    }
  }, [selectedCycle])

  useRealtime('shift_cycles', loadData)
  useRealtime('shifts', () => {
    if (selectedCycle) getShifts(selectedCycle).then(setShifts)
  })

  const handleGenerate = async () => {
    if (!selectedCycle || (!departmentId && !projectId)) return
    setLoading(true)
    try {
      if (projectId) {
        const p = await pb.collection('projects').getOne(projectId)
        const deps = [p.department, ...(p.associated_departments || [])]
        let total = 0
        for (const dep of deps) {
          try {
            const res = await generateShifts(selectedCycle, dep)
            if (res && res.count) total += res.count
          } catch (e) {
            console.warn(`Erro ao gerar para departamento ${dep}:`, e)
          }
        }
        toast({
          title: 'Geração Concluída',
          description: `Escala gerada com sucesso para os departamentos do projeto! (${total} plantões totais)`,
        })
        getShifts(selectedCycle).then(setShifts)
      } else {
        const res = await generateShifts(selectedCycle, departmentId)
        toast({
          title: 'Geração Concluída',
          description: `Escala gerada com sucesso! (${res?.count || 0} plantões)`,
        })
        getShifts(selectedCycle).then(setShifts)
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar escala',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border-primary/20 bg-gradient-to-b from-white to-primary/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            <CardTitle>Geração Inteligente</CardTitle>
          </div>
          <CardDescription>
            O motor de IA analisará os contratos, regras, disponibilidade e setorização para gerar
            uma escala ótima.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-sm">
            <label className="text-sm font-medium">Ciclo Alvo</label>
            <Select value={selectedCycle} onValueChange={setSelectedCycle}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o ciclo..." />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({format(new Date(c.start_date), 'dd/MM', { locale: ptBR })} -{' '}
                    {format(new Date(c.end_date), 'dd/MM', { locale: ptBR })})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleGenerate}
            disabled={loading || !selectedCycle}
            className="w-full sm:w-auto gap-2"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Processando regras...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Gerar Escala Automática
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {shifts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Prévia da Escala Gerada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shifts.map((shift) => (
                <div
                  key={shift.id}
                  className="border rounded-lg p-3 bg-slate-50 flex flex-col gap-2 relative"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-sm">
                      {shift.expand?.user?.name || 'Desconhecido'}
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-white">
                      {shift.expand?.sector?.name}
                    </Badge>
                  </div>
                  <div className="flex items-center text-xs text-slate-500 gap-1 mt-1">
                    <CalendarIcon className="h-3 w-3" />
                    <span>
                      {format(new Date(shift.start_time), 'dd/MM HH:mm', { locale: ptBR })} -{' '}
                      {format(new Date(shift.end_time), 'HH:mm')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                className="gap-2 text-green-700 hover:text-green-800 hover:bg-green-50 border-green-200"
              >
                <CheckCircle2 className="h-4 w-4" />
                Aprovar e Publicar Escala
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
