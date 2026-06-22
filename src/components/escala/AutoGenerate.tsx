import { useState, useEffect, useCallback } from 'react'
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
import {
  Wand2,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
} from 'lucide-react'
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
import { getErrorMessage } from '@/lib/pocketbase/errors'

type ValidationCheck = {
  id: string
  label: string
  status: 'loading' | 'success' | 'warning' | 'error'
  message: string
}

function CheckItem({ check }: { check: ValidationCheck }) {
  const Icon =
    check.status === 'success'
      ? CheckCircle2
      : check.status === 'warning'
        ? AlertCircle
        : check.status === 'error'
          ? XCircle
          : Loader2

  const color =
    check.status === 'success'
      ? 'text-green-600'
      : check.status === 'warning'
        ? 'text-amber-600'
        : check.status === 'error'
          ? 'text-red-600'
          : 'text-slate-500'

  const bgColor =
    check.status === 'success'
      ? 'bg-green-50'
      : check.status === 'warning'
        ? 'bg-amber-50'
        : check.status === 'error'
          ? 'bg-red-50'
          : 'bg-slate-50'

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-md border ${bgColor} ${check.status === 'error' ? 'border-red-200' : 'border-transparent'} transition-colors`}
    >
      <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${color}`} />
      <div>
        <p className={`text-sm font-medium ${color}`}>{check.label}</p>
        <p className="text-xs text-slate-600 mt-0.5">{check.message}</p>
      </div>
    </div>
  )
}

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

  const [projectDeps, setProjectDeps] = useState<string[]>([])
  const [projectMembers, setProjectMembers] = useState<string[]>([])
  const [validations, setValidations] = useState<ValidationCheck[]>([])
  const [isReady, setIsReady] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

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

  useEffect(() => {
    if (projectId) {
      pb.collection('projects')
        .getOne(projectId, { expand: 'members' })
        .then((p) => {
          setProjectDeps([p.department, ...(p.associated_departments || [])].filter(Boolean))
          setProjectMembers(p.members || [])
        })
        .catch(console.error)
    } else if (departmentId) {
      setProjectDeps([departmentId])
    }
  }, [projectId, departmentId])

  const validate = useCallback(async () => {
    if (!selectedCycle || projectDeps.length === 0) return
    setIsValidating(true)
    setIsReady(false)
    const checks: ValidationCheck[] = []

    try {
      const cycle = cycles.find((c) => c.id === selectedCycle)
      if (cycle && ['active', 'draft'].includes(cycle.status)) {
        checks.push({
          id: 'cycle',
          label: 'Ciclo Vigente',
          status: 'success',
          message: 'Ciclo selecionado é válido para geração.',
        })
      } else {
        checks.push({
          id: 'cycle',
          label: 'Ciclo Vigente',
          status: 'error',
          message: 'O ciclo selecionado não está ativo ou em rascunho.',
        })
      }

      let sectorFilter = ''
      if (projectDeps.length > 0) {
        sectorFilter = projectDeps.map((d) => `department="${d}"`).join(' || ')
      }
      const sectors = sectorFilter
        ? await pb.collection('hospital_sectors').getFullList({ filter: sectorFilter })
        : []

      if (sectors.length === 0) {
        checks.push({
          id: 'sectors',
          label: 'Setores',
          status: 'error',
          message: 'Nenhum setor encontrado para os departamentos do projeto.',
        })
      } else {
        const invalidSectors = sectors.filter((s) => !s.min_staffing || !s.ideal_staffing)
        if (invalidSectors.length > 0) {
          checks.push({
            id: 'sectors',
            label: 'Setores',
            status: 'warning',
            message: `${invalidSectors.length} setor(es) sem dimensionamento mínimo/ideal.`,
          })
        } else {
          checks.push({
            id: 'sectors',
            label: 'Setores',
            status: 'success',
            message: `${sectors.length} setores configurados corretamente.`,
          })
        }
      }

      const sfParts = []
      if (sectors.length > 0)
        sfParts.push(`(${sectors.map((s) => `default_sector="${s.id}"`).join(' || ')})`)
      if (projectMembers.length > 0)
        sfParts.push(`(${projectMembers.map((m) => `id="${m}"`).join(' || ')})`)
      const staffFilter = sfParts.join(' || ')

      let users: any[] = []
      if (staffFilter) {
        users = await pb.collection('users').getFullList({ filter: staffFilter })
      }

      if (users.length === 0) {
        checks.push({
          id: 'staff',
          label: 'Colaboradores e Contratos',
          status: 'error',
          message: 'Nenhum colaborador associado aos setores ou ao projeto.',
        })
      } else {
        const userIds = users.map((u) => u.id)
        const contracts = await pb.collection('staff_contracts').getFullList({
          filter: userIds.map((id) => `user="${id}"`).join(' || '),
        })
        const usersWithoutContract = users.filter((u) => !contracts.some((c) => c.user === u.id))
        const invalidContracts = contracts.filter((c) => !c.contract_type || !c.monthly_hour_limit)

        if (usersWithoutContract.length > 0) {
          checks.push({
            id: 'staff',
            label: 'Colaboradores e Contratos',
            status: 'error',
            message: `${usersWithoutContract.length} colaborador(es) sem contrato cadastrado.`,
          })
        } else if (invalidContracts.length > 0) {
          checks.push({
            id: 'staff',
            label: 'Colaboradores e Contratos',
            status: 'warning',
            message: `${invalidContracts.length} contrato(s) com dados incompletos.`,
          })
        } else {
          checks.push({
            id: 'staff',
            label: 'Colaboradores e Contratos',
            status: 'success',
            message: `Todos os ${users.length} colaboradores possuem contratos válidos.`,
          })
        }
      }

      const shiftTypes = await pb.collection('shift_types').getFullList()
      if (shiftTypes.length === 0) {
        checks.push({
          id: 'types',
          label: 'Tipos de Plantão',
          status: 'error',
          message: 'Nenhum tipo de plantão configurado no sistema.',
        })
      } else {
        const invalidTypes = shiftTypes.filter((t) => !t.work_hours || !t.rest_hours)
        if (invalidTypes.length > 0) {
          checks.push({
            id: 'types',
            label: 'Tipos de Plantão',
            status: 'warning',
            message: `${invalidTypes.length} tipo(s) com horas de trabalho/descanso não definidas.`,
          })
        } else {
          checks.push({
            id: 'types',
            label: 'Tipos de Plantão',
            status: 'success',
            message: `${shiftTypes.length} tipos de plantão configurados corretamente.`,
          })
        }
      }

      let rulesFilter = ''
      if (projectDeps.length > 0) {
        rulesFilter = projectDeps.map((d) => `department="${d}"`).join(' || ')
      }
      const rules = rulesFilter
        ? await pb.collection('shift_rules').getFullList({ filter: rulesFilter })
        : []

      if (rules.length === 0) {
        checks.push({
          id: 'rules',
          label: 'Regras de Escala',
          status: 'warning',
          message:
            'Nenhuma regra específica definida para os departamentos. Serão usadas as regras padrão.',
        })
      } else {
        checks.push({
          id: 'rules',
          label: 'Regras de Escala',
          status: 'success',
          message: `${rules.length} regras ativas e aplicáveis.`,
        })
      }

      const timeoffs = await pb.collection('timeoff_requests').getFullList({
        filter: `cycle="${selectedCycle}"`,
      })
      const pendingTimeoffs = timeoffs.filter((t) => t.status === 'pending')
      if (pendingTimeoffs.length > 0) {
        checks.push({
          id: 'timeoff',
          label: 'Solicitações de Folga',
          status: 'warning',
          message: `${pendingTimeoffs.length} solicitação(ões) pendente(s) no ciclo.`,
        })
      } else {
        checks.push({
          id: 'timeoff',
          label: 'Solicitações de Folga',
          status: 'success',
          message: `Nenhuma solicitação pendente (${timeoffs.length} processadas).`,
        })
      }

      setValidations(checks)
      setIsReady(!checks.some((c) => c.status === 'error'))
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro de Validação',
        description: 'Não foi possível carregar os parâmetros de validação.',
        variant: 'destructive',
      })
    } finally {
      setIsValidating(false)
    }
  }, [selectedCycle, projectDeps, projectMembers, cycles, toast])

  useEffect(() => {
    validate()
  }, [validate])

  const handleGenerate = async () => {
    if (!selectedCycle || projectDeps.length === 0) return
    setLoading(true)

    toast({
      title: 'Iniciando Geração',
      description: 'A IA está analisando os parâmetros para montar a escala...',
    })

    try {
      let total = 0
      for (const dep of projectDeps) {
        try {
          const res = await generateShifts(selectedCycle, dep)
          if (res && res.count) total += res.count
        } catch (e: any) {
          const msg = getErrorMessage(e)
          throw new Error(`Erro no departamento ${dep}: ${msg}`)
        }
      }

      toast({
        title: 'Geração Concluída',
        description: `Escala gerada com sucesso para os departamentos do projeto! (${total} plantões totais)`,
      })
      getShifts(selectedCycle).then(setShifts)
    } catch (err: any) {
      toast({
        title: 'Falha na geração de escala',
        description: err.message || 'Tente novamente. Verifique se os parâmetros estão corretos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border-primary/20 bg-gradient-to-b from-white to-primary/5 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            <CardTitle>Geração Inteligente de Escalas</CardTitle>
          </div>
          <CardDescription>
            O motor de IA analisará os contratos, regras, disponibilidade e setorização para gerar
            uma escala ótima.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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

          <div className="pt-4 border-t border-primary/10">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              Dashboard de Prontidão (Readiness Report)
              {isValidating && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </h3>

            {!selectedCycle ? (
              <p className="text-sm text-muted-foreground">
                Selecione um ciclo para validar os parâmetros.
              </p>
            ) : validations.length === 0 && isValidating ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Verificando banco de dados...
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {validations.map((v) => (
                  <CheckItem key={v.id} check={v} />
                ))}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="bg-white/50 border-t py-4">
          <Button
            onClick={handleGenerate}
            disabled={loading || !selectedCycle || !isReady || isValidating}
            className="w-full sm:w-auto gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando regras com IA...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Gerar Escala Automática
              </>
            )}
          </Button>
          {!isReady && !isValidating && selectedCycle && (
            <p className="text-xs text-red-500 ml-4 font-medium">
              A geração está desabilitada devido a erros de validação nos parâmetros críticos.
            </p>
          )}
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
