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
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { cn } from '@/lib/utils'

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

import { ShiftCalendar } from './ShiftCalendar'

export function AutoGenerate({
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
    getShiftCycles().then((c) => {
      setCycles(c)
      if (!selectedCycle && c.length > 0) {
        const defaultCycle = c.find((x: any) => x.status === 'active' || x.status === 'draft')
        if (defaultCycle) setSelectedCycle(defaultCycle.id)
      }
    })
    getStaffContracts().then(setContracts)
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
    }
  }, [projectDeps])

  useEffect(() => {
    if (selectedCycle) {
      getShifts(selectedCycle).then((res) => {
        if (selectedSector && selectedSector !== 'all') {
          setShifts(res.filter((s) => s.sector === selectedSector))
        } else {
          setShifts(res)
        }
      })
    }
  }, [selectedCycle, selectedSector])

  useRealtime('shift_cycles', loadData)
  useRealtime('shifts', () => {
    if (selectedCycle) {
      getShifts(selectedCycle).then((res) => {
        if (selectedSector && selectedSector !== 'all') {
          setShifts(res.filter((s) => s.sector === selectedSector))
        } else {
          setShifts(res)
        }
      })
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
      if (cycle && ['active', 'draft'].includes(cycle.status)) {
        cycleDetails.push(`O ciclo ${cycle.name} é válido para geração.`)
      } else {
        cycleStatus = 'error'
        cycleDetails.push('O ciclo selecionado não está ativo ou em rascunho.')
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
      const sectors = sectorFilter
        ? await pb.collection('hospital_sectors').getFullList({ filter: sectorFilter })
        : []

      const sectorDetails = []
      let sectorStatus: 'success' | 'warning' | 'error' = 'success'
      if (sectors.length === 0) {
        sectorStatus = 'error'
        sectorDetails.push('Nenhum setor encontrado para os departamentos do projeto.')
      } else {
        const invalidSectors = sectors.filter((s) => !s.min_staffing || !s.ideal_staffing)
        if (invalidSectors.length > 0) {
          sectorStatus = 'warning'
          invalidSectors.forEach((s) =>
            sectorDetails.push(`Setor "${s.name}" está sem dimensionamento mínimo/ideal.`),
          )
        } else {
          sectorDetails.push(`${sectors.length} setores configurados corretamente.`)
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
      if (sectors.length > 0)
        sfParts.push(`(${sectors.map((s) => `default_sector="${s.id}"`).join(' || ')})`)
      if (projectMembers.length > 0)
        sfParts.push(`(${projectMembers.map((m) => `id="${m}"`).join(' || ')})`)
      const staffFilter = sfParts.join(' || ')

      let users: any[] = []
      if (staffFilter) {
        users = await pb
          .collection('users')
          .getFullList({ filter: staffFilter, expand: 'staff_role,staff_profile' })
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
        const contracts = await pb.collection('staff_contracts').getFullList({
          filter: userIds.map((id) => `user="${id}"`).join(' || '),
        })
        const usersWithoutContract = users.filter((u) => !contracts.some((c) => c.user === u.id))
        const invalidContracts = contracts.filter((c) => !c.contract_type || !c.monthly_hour_limit)

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

      if (rules.length === 0) {
        rulesStatus = 'warning'
        rulesDetails.push(
          'Nenhuma regra específica definida para os departamentos. Serão usadas as regras padrão.',
        )
      } else {
        const hasMinRest = rules.some((r) => r.rule_type === 'min_rest_hours')
        const hasMaxHours = rules.some((r) => r.rule_type === 'max_hours')
        if (!hasMinRest)
          rulesDetails.push(
            'Regra de descanso mínimo (min_rest_hours) não está definida. Isso pode gerar escalas exaustivas.',
          )
        if (!hasMaxHours)
          rulesDetails.push('Regra de máximo de horas (max_hours) não está definida.')
        if (!hasMinRest || !hasMaxHours) rulesStatus = 'warning'
        else
          rulesDetails.push(
            `${rules.length} regras ativas, incluindo as obrigatórias (descanso mínimo e limite de horas).`,
          )
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

    try {
      let total = 0

      const depsToGenerate =
        selectedSector !== 'all'
          ? [sectors.find((s) => s.id === selectedSector)?.department].filter(Boolean)
          : projectDeps

      for (const dep of depsToGenerate) {
        try {
          const res = await generateShifts(
            selectedCycle,
            dep,
            selectedSector !== 'all' ? selectedSector : undefined,
          )
          if (res && res.count) total += res.count
        } catch (e: any) {
          const msg = getErrorMessage(e)
          throw new Error(`Erro no departamento ${dep}: ${msg}`)
        }
      }

      toast({
        title: 'Geração Concluída',
        description: `Escala gerada com sucesso! (${total} plantões totais)`,
      })
      getShifts(selectedCycle).then((res) => {
        if (selectedSector && selectedSector !== 'all') {
          setShifts(res.filter((s) => s.sector === selectedSector))
        } else {
          setShifts(res)
        }
      })
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

  const hasIssues = validations.some((v) => v.status === 'error' || v.status === 'warning')

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
                      {c.name} ({format(new Date(c.start_date), 'dd/MM', { locale: ptBR })} -{' '}
                      {format(new Date(c.end_date), 'dd/MM', { locale: ptBR })})
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
              onClick={(e) => {
                if (!isReady) {
                  e.preventDefault()
                  setShowPendencyModal(true)
                } else {
                  handleGenerate()
                }
              }}
              disabled={loading || !selectedCycle || isValidating}
              className={cn(
                'w-full sm:w-auto gap-2 transition-all',
                !isReady && selectedCycle && !isValidating && 'opacity-70 hover:opacity-80',
              )}
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

            {!isValidating && selectedCycle && hasIssues && (
              <Button
                variant="ghost"
                className="gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 w-full sm:w-auto"
                onClick={() => setShowPendencyModal(true)}
              >
                <Info className="h-4 w-4" />
                Ver Pendências
              </Button>
            )}
          </div>
          {!isReady && !isValidating && selectedCycle && (
            <p className="text-xs text-red-500 font-medium">
              A geração está desabilitada devido a erros de validação nos parâmetros críticos.
              Clique em Ver Pendências para detalhes.
            </p>
          )}
        </CardFooter>
      </Card>

      {shifts.length > 0 && (
        <Card className="shadow-md overflow-hidden border-primary/10">
          <CardHeader className="bg-slate-50 border-b pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
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
            <ShiftCalendar
              shifts={shifts}
              cycle={cycles.find((c) => c.id === selectedCycle)}
              contracts={contracts}
            />
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
            {isValidating ? (
              <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Atualizando dados...</span>
              </div>
            ) : (
              validations.map((v) => (
                <div key={v.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckItemIcon status={v.status} />
                    <h4 className="font-semibold text-base text-slate-800">{v.label}</h4>
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
