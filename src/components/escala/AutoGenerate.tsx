import React, { useState, useEffect, useCallback, Component, ReactNode } from 'react'
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
import { getShiftCycles, generateShifts, getShifts, getStaffContracts } from '@/services/escala'
import { useRealtime } from '@/hooks/use-realtime'
import {
  Wand2,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Info,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import pb from '@/lib/pocketbase/client'
import { cn } from '@/lib/utils'
import { ShiftCalendar } from './ShiftCalendar'

const formatDateSafely = (dateStr: string, fmt: string) => {
  try {
    if (!dateStr) return 'Sem data'
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return 'Data inválida'
    return format(date, fmt, { locale: ptBR })
  } catch (e) {
    return 'Data inválida'
  }
}

class ErrorBoundary extends Component<
  { children: ReactNode; fallback: (error: Error, reset: () => void) => ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback(this.state.error, () =>
        this.setState({ hasError: false, error: null }),
      )
    }
    return this.props.children
  }
}

type ValidationCheck = {
  id: string
  label: string
  status: 'loading' | 'success' | 'warning' | 'error'
  message: string
  details?: string[]
}

function CheckItemIcon({ status }: { status: ValidationCheck['status'] }) {
  const Icon =
    status === 'success'
      ? CheckCircle2
      : status === 'warning'
        ? AlertCircle
        : status === 'error'
          ? XCircle
          : Loader2

  const color =
    status === 'success'
      ? 'text-green-600'
      : status === 'warning'
        ? 'text-amber-600'
        : status === 'error'
          ? 'text-red-600'
          : 'text-slate-500'

  return <Icon className={`h-5 w-5 ${color}`} />
}

function CheckItem({ check }: { check: ValidationCheck }) {
  const bgColor =
    check.status === 'success'
      ? 'bg-green-50'
      : check.status === 'warning'
        ? 'bg-amber-50'
        : check.status === 'error'
          ? 'bg-red-50'
          : 'bg-slate-50'

  const color =
    check.status === 'success'
      ? 'text-green-600'
      : check.status === 'warning'
        ? 'text-amber-600'
        : check.status === 'error'
          ? 'text-red-600'
          : 'text-slate-500'

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-md border transition-colors',
        bgColor,
        check.status === 'error' ? 'border-red-200' : 'border-transparent',
      )}
    >
      <div className="mt-0.5 shrink-0">
        <CheckItemIcon status={check.status} />
      </div>
      <div>
        <p className={cn('text-sm font-medium', color)}>{check.label}</p>
        <p className="text-xs text-slate-600 mt-0.5">{check.message}</p>
      </div>
    </div>
  )
}

function AutoGenerateInner({
  departmentId,
  projectId,
}: {
  departmentId?: string
  projectId?: string
}) {
  const [cycles, setCycles] = useState<any[]>([])
  const [selectedCycle, setSelectedCycle] = useState<string>('')
  const [sectors, setSectors] = useState<any[]>([])
  const [selectedSector, setSelectedSector] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [shifts, setShifts] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])

  const [projectDeps, setProjectDeps] = useState<string[]>([])
  const [projectMembers, setProjectMembers] = useState<string[]>([])
  const [validations, setValidations] = useState<ValidationCheck[]>([])
  const [isReady, setIsReady] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [showPendencyModal, setShowPendencyModal] = useState(false)

  const { toast } = useToast()

  const loadData = async () => {
    try {
      const c = await getShiftCycles()
      setCycles(c)
      if (!selectedCycle && c.length > 0) {
        const defaultCycle = c.find((x: any) => x.status === 'active')
        if (defaultCycle) setSelectedCycle(defaultCycle.id)
      }
      const conts = await getStaffContracts()
      setContracts(conts)
    } catch (err) {
      console.error('Failed to load cycles or contracts:', err)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (projectDeps.length > 0) {
      const sectorFilter = projectDeps.map((d) => `department="${d}"`).join(' || ')
      pb.collection('hospital_sectors')
        .getFullList({ filter: sectorFilter, sort: 'name' })
        .then(setSectors)
        .catch(console.error)
    }
  }, [projectDeps])

  useEffect(() => {
    if (selectedCycle) {
      getShifts(selectedCycle)
        .then((res) => {
          if (selectedSector && selectedSector !== 'all') {
            setShifts(res.filter((s) => s.sector === selectedSector))
          } else {
            setShifts(res)
          }
        })
        .catch(console.error)
    }
  }, [selectedCycle, selectedSector])

  useRealtime('shift_cycles', loadData)
  useRealtime('hospital_sectors', validate)
  useRealtime('staff_contracts', () => {
    loadData()
    validate()
  })
  useRealtime('shift_rules', validate)
  useRealtime('users', validate)
  useRealtime('shifts', () => {
    if (selectedCycle) {
      getShifts(selectedCycle)
        .then((res) => {
          if (selectedSector && selectedSector !== 'all') {
            setShifts(res.filter((s) => s.sector === selectedSector))
          } else {
            setShifts(res)
          }
        })
        .catch(console.error)
    }
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
      const cycleDetails = []
      let cycleStatus: 'success' | 'error' = 'success'
      if (cycle && cycle.status === 'active') {
        if (!cycle.start_date || !cycle.end_date) {
          cycleStatus = 'error'
          cycleDetails.push('O ciclo selecionado possui datas de início e/ou fim inválidas.')
        } else {
          cycleDetails.push(`O ciclo ${cycle.name} é válido para geração.`)
        }
      } else {
        cycleStatus = 'error'
        cycleDetails.push('O ciclo selecionado não está ativo. O status deve ser "ativo".')
      }
      checks.push({
        id: 'cycle',
        label: 'Ciclos',
        status: cycleStatus,
        message: cycleStatus === 'error' ? 'Ciclo inválido' : 'Ciclo configurado',
        details: cycleDetails,
      })

      // Sectors
      let sectorFilter = projectDeps.map((d) => `department="${d}"`).join(' || ')
      const sectorsList = sectorFilter
        ? await pb.collection('hospital_sectors').getFullList({ filter: sectorFilter })
        : []

      const sectorDetails = []
      let sectorStatus: 'success' | 'warning' | 'error' = 'success'
      if (sectorsList.length === 0) {
        sectorStatus = 'error'
        sectorDetails.push('Nenhum setor encontrado para os departamentos do projeto.')
      } else {
        const invalidSectors = sectorsList.filter((s) => !s.min_staffing || !s.ideal_staffing)
        if (invalidSectors.length > 0) {
          sectorStatus = 'error'
          invalidSectors.forEach((s) =>
            sectorDetails.push(`Setor "${s.name}" está sem dimensionamento mínimo/ideal.`),
          )
        } else {
          sectorDetails.push(`${sectorsList.length} setores configurados corretamente.`)
        }
      }
      checks.push({
        id: 'sectors',
        label: 'Setores',
        status: sectorStatus,
        message:
          sectorStatus === 'error'
            ? 'Setores ausentes'
            : sectorStatus === 'warning'
              ? 'Configuração incompleta'
              : 'Configurados',
        details: sectorDetails,
      })

      // Staff
      const sfParts = []
      if (sectorsList.length > 0)
        sfParts.push(`(${sectorsList.map((s) => `default_sector="${s.id}"`).join(' || ')})`)
      if (projectMembers.length > 0)
        sfParts.push(`(${projectMembers.map((m) => `id="${m}"`).join(' || ')})`)
      const staffFilter = sfParts.join(' || ')

      let users: any[] = []
      if (staffFilter) {
        users = await pb.collection('users').getFullList({
          filter: `(${staffFilter}) && role!="Admin"`,
          expand: 'staff_role,staff_profile',
        })
      }

      const staffDetails = []
      let staffStatus: 'success' | 'warning' | 'error' = 'success'

      if (users.length === 0) {
        staffStatus = 'error'
        staffDetails.push('Nenhum colaborador associado aos setores ou ao projeto.')
      } else {
        const usersWithoutProfile = users.filter((u) => !u.staff_profile)
        const usersWithoutRole = users.filter((u) => !u.staff_role)

        if (usersWithoutProfile.length > 0 || usersWithoutRole.length > 0) {
          staffStatus = 'error'
          usersWithoutProfile.forEach((u) =>
            staffDetails.push(
              `Colaborador(a) ${u.name || u.email} está sem perfil de escala (staff_profile).`,
            ),
          )
          usersWithoutRole.forEach((u) =>
            staffDetails.push(`Colaborador(a) ${u.name || u.email} está sem cargo (staff_role).`),
          )
        } else {
          staffDetails.push(`Todos os ${users.length} colaboradores possuem cargo e perfil.`)
        }
      }
      checks.push({
        id: 'staff',
        label: 'Colaboradores',
        status: staffStatus,
        message: staffStatus === 'error' ? 'Dados incompletos ou ausentes' : 'Configurados',
        details: staffDetails,
      })

      // Contracts
      const contractDetails = []
      let contractStatus: 'success' | 'warning' | 'error' = 'success'
      if (users.length > 0) {
        const userIds = users.map((u) => u.id)
        const contractsList = await pb.collection('staff_contracts').getFullList({
          filter: userIds.map((id) => `user="${id}"`).join(' || '),
        })
        const usersWithoutContract = users.filter(
          (u) => !contractsList.some((c) => c.user === u.id),
        )
        const invalidContracts = contractsList.filter(
          (c) => !c.contract_type || !c.monthly_hour_limit,
        )

        if (usersWithoutContract.length > 0 || invalidContracts.length > 0) {
          contractStatus = 'error'
          usersWithoutContract.forEach((u) =>
            contractDetails.push(
              `Colaborador(a) ${u.name || u.email} não possui contrato cadastrado.`,
            ),
          )
          invalidContracts.forEach((c) => {
            const u = users.find((x) => x.id === c.user)
            contractDetails.push(
              `Contrato de ${u?.name || u?.email || 'Desconhecido'} possui dados incompletos (tipo ou carga horária).`,
            )
          })
        } else {
          contractDetails.push(`Todos os ${users.length} colaboradores possuem contratos válidos.`)
        }
      } else {
        contractStatus = 'error'
        contractDetails.push('Sem colaboradores para validar contratos.')
      }
      checks.push({
        id: 'contracts',
        label: 'Contratos',
        status: contractStatus,
        message: contractStatus === 'error' ? 'Contratos pendentes' : 'Configurados',
        details: contractDetails,
      })

      // Rules
      let rulesFilter = projectDeps.map((d) => `department="${d}"`).join(' || ')
      const rules = rulesFilter
        ? await pb.collection('shift_rules').getFullList({ filter: rulesFilter })
        : []
      const rulesDetails = []
      let rulesStatus: 'success' | 'warning' | 'error' = 'success'

      const usersWithRules = users.filter((u) => {
        const hasPersonalRules = u.assigned_rules && u.assigned_rules.length > 0
        const hasProfileRules =
          u.expand?.staff_profile?.rules && u.expand.staff_profile.rules.length > 0
        return hasPersonalRules || hasProfileRules
      })

      if (rules.length === 0 && usersWithRules.length === 0) {
        rulesStatus = 'error'
        rulesDetails.push(
          'Nenhuma regra de escala definida (nem no departamento, nem nos colaboradores/perfis). É obrigatório ter regras.',
        )
      } else {
        const hasMinRest = rules.some((r) => r.rule_type === 'min_rest_hours')
        const hasMaxHours = rules.some((r) => r.rule_type === 'max_hours')

        if (!hasMinRest) {
          rulesDetails.push(
            'Aviso: Regra de descanso mínimo (min_rest_hours) não está definida no departamento.',
          )
          rulesStatus = 'warning'
        }
        if (!hasMaxHours) {
          rulesDetails.push(
            'Aviso: Regra de máximo de horas (max_hours) não está definida no departamento.',
          )
          rulesStatus = 'warning'
        }

        if (rulesStatus === 'success') {
          rulesDetails.push(`${rules.length} regras ativas no departamento.`)
        }
        if (usersWithRules.length > 0) {
          rulesDetails.push(
            `${usersWithRules.length} colaboradores possuem regras específicas (pessoais ou do perfil).`,
          )
        }
      }

      checks.push({
        id: 'rules',
        label: 'Regras de Escala',
        status: rulesStatus,
        message:
          rulesStatus === 'error'
            ? 'Regras Ausentes'
            : rulesStatus === 'warning'
              ? 'Atenção às regras'
              : 'Configuradas',
        details: rulesDetails,
      })

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

  useEffect(() => {
    if (showPendencyModal) {
      validate()
    }
  }, [showPendencyModal, validate])

  const handleGenerate = async () => {
    if (!selectedCycle || projectDeps.length === 0) return
    setLoading(true)

    toast({
      title: 'Iniciando Geração',
      description: 'A IA está analisando os parâmetros para montar a escala...',
    })

    const timeoutId = setTimeout(() => {
      toast({
        title: 'Processamento longo',
        description:
          'A geração está levando mais tempo que o normal devido à complexidade das regras. Por favor, aguarde...',
        duration: 10000,
      })
    }, 15000)

    try {
      let total = 0

      const rulesPrompt = validations.find((v) => v.id === 'rules')?.details?.join('\n') || ''

      const sectorsToGenerate =
        selectedSector !== 'all' ? [selectedSector] : sectors.map((s) => s.id)

      if (sectorsToGenerate.length === 0) {
        throw new Error('Nenhum setor disponível para geração.')
      }

      const warnings = validations.filter((v) => v.status === 'warning')
      if (warnings.length > 0) {
        try {
          await pb.collection('audit_logs').create({
            user: pb.authStore.record?.id,
            action: 'Generate Shifts (with warnings)',
            department: projectDeps[0] || 'Gestão de Escalas',
            details: `Geração iniciada com os seguintes avisos: ${warnings.map((w) => w.label).join(', ')}`,
            token_usage: 0,
          })
        } catch {
          /* intentionally ignored */
        }
      }

      const res = await generateShifts(selectedCycle, sectorsToGenerate, rulesPrompt)
      if (res && res.count) total += res.count

      toast({
        title: 'Geração Concluída',
        description: `Escala gerada com sucesso! (${total} plantões totais)`,
      })
      const resShifts = await getShifts(selectedCycle)
      if (selectedSector && selectedSector !== 'all') {
        setShifts(resShifts.filter((s) => s.sector === selectedSector))
      } else {
        setShifts(resShifts)
      }
    } catch (err: any) {
      console.error('Error during AI generation:', err)
      const isPBError = err && typeof err === 'object' && 'response' in err
      const respData = isPBError ? err.response : null

      const msg =
        respData?.error || respData?.message || err.message || 'Falha na geração da escala.'
      const suggestion =
        respData?.suggestion || respData?.hint || (respData?.data && respData.data.suggestion)

      toast({
        title: 'Falha na geração de escala',
        description: typeof msg === 'string' ? msg : JSON.stringify(msg),
        variant: 'destructive',
      })

      if (suggestion) {
        toast({
          title: 'Análise do Especialista (IA)',
          description: typeof suggestion === 'string' ? suggestion : JSON.stringify(suggestion),
          duration: 15000,
        })
      }
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  const hasIssues = validations.some((v) => v.status === 'error' || v.status === 'warning')
  const cycleObj = cycles.find((c) => c.id === selectedCycle)

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-b from-white to-primary/5 shadow-sm">
        <div className="absolute top-0 left-0 right-0 h-1 bg-green-700 z-10" />
        <CardHeader className="pb-4 pt-6">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-green-700" />
            <CardTitle>Geração Inteligente de Escalas</CardTitle>
          </div>
          <CardDescription>
            O motor de IA analisará os contratos, regras, disponibilidade e setorização para gerar
            uma escala ótima.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ciclo Alvo</label>
              <Select value={selectedCycle} onValueChange={setSelectedCycle}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o ciclo..." />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({formatDateSafely(c.start_date, 'dd/MM')} -{' '}
                      {formatDateSafely(c.end_date, 'dd/MM')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Setor Específico</label>
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os setores..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {sectors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
        <CardFooter className="bg-white/50 border-t py-4 flex flex-col items-start gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Button
              onClick={handleGenerate}
              disabled={loading || !selectedCycle || isValidating || !isReady}
              className={cn(
                'w-full sm:w-auto gap-2 transition-all',
                isReady && 'bg-green-700 hover:bg-green-800 text-white',
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando com IA...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Gerar Escala Automática
                </>
              )}
            </Button>

            {selectedCycle && hasIssues && (
              <Button
                variant={!isReady ? 'destructive' : 'secondary'}
                className={cn(
                  'gap-2 w-full sm:w-auto transition-colors',
                  isReady && 'bg-amber-100 text-amber-700 hover:bg-amber-200',
                )}
                onClick={() => setShowPendencyModal(true)}
              >
                {!isReady ? <AlertCircle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                Ver Pendências
              </Button>
            )}
          </div>
          {!isReady && selectedCycle && (
            <p className="text-xs text-red-500 font-medium">
              A geração está desabilitada devido a erros de validação nos parâmetros críticos.
              Clique em Ver Pendências para detalhes.
            </p>
          )}
        </CardFooter>
      </Card>

      {shifts.length > 0 && cycleObj && (
        <Card className="relative overflow-hidden shadow-md border-primary/10">
          <div className="absolute top-0 left-0 right-0 h-1 bg-green-700 z-10" />
          <CardHeader className="bg-slate-50 border-b pb-4 pt-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-green-700" />
                Calendário de Escala Gerada
              </CardTitle>
              <Button
                size="sm"
                className="gap-2 text-green-700 bg-green-100 hover:text-green-800 hover:bg-green-200 border border-green-300"
              >
                <CheckCircle2 className="h-4 w-4" />
                Aprovar e Publicar Escala
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ShiftCalendar shifts={shifts} cycle={cycleObj} contracts={contracts} />
          </CardContent>
        </Card>
      )}

      <Dialog open={showPendencyModal} onOpenChange={setShowPendencyModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="text-xl">Pendências para Geração de Escala</DialogTitle>
            <DialogDescription className="mt-2">
              Verifique os itens abaixo para permitir a geração automática. Resolva as pendências
              listadas antes de prosseguir.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isValidating && validations.length === 0 ? (
              <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Atualizando dados...</span>
              </div>
            ) : (
              validations.map((v) => (
                <div key={v.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckItemIcon status={v.status} />
                    <h4 className="font-semibold text-base text-slate-800 flex items-center gap-2">
                      {v.label}
                      {v.status === 'error' && (
                        <Badge variant="destructive" className="text-[10px] h-5">
                          Erro Crítico
                        </Badge>
                      )}
                      {v.status === 'warning' && (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-5 bg-amber-50 text-amber-700 border-amber-200"
                        >
                          Aviso
                        </Badge>
                      )}
                    </h4>
                  </div>
                  {v.details && v.details.length > 0 ? (
                    <ul className="space-y-1.5 ml-8 border-l-2 border-slate-100 pl-4">
                      {v.details.map((detail, idx) => (
                        <li key={idx} className="text-sm text-slate-600">
                          {detail}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500 ml-8 italic">Sem detalhes adicionais.</p>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function AutoGenerate(props: { departmentId?: string; projectId?: string }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg space-y-4 max-w-2xl mx-auto mt-6">
          <div className="flex items-center gap-3 text-red-700">
            <XCircle className="h-6 w-6" />
            <h3 className="font-semibold text-lg">Erro Inesperado</h3>
          </div>
          <p className="text-red-600 text-sm">
            Um problema ocorreu ao carregar a interface de geração de escalas com IA.
          </p>
          <div className="bg-white p-3 rounded border border-red-100 text-xs text-red-800 overflow-auto">
            {error.message}
          </div>
          <Button
            variant="outline"
            onClick={reset}
            className="border-red-200 text-red-700 hover:bg-red-100"
          >
            Tentar Novamente
          </Button>
        </div>
      )}
    >
      <AutoGenerateInner {...props} />
    </ErrorBoundary>
  )
}
