import React, { useState, useEffect, useCallback, useMemo, Component, ReactNode } from 'react'
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
import {
  getShiftCycles,
  generateDraftShifts,
  getStaffContracts,
  getTimeoffRequests,
} from '@/services/escala'
import { useRealtime } from '@/hooks/use-realtime'
import {
  Wand2,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Info,
  Send,
  Save,
  MessageSquare,
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
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

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
  const [selectedSector, setSelectedSector] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isSectorsLoading, setIsSectorsLoading] = useState(false)
  const [contracts, setContracts] = useState<any[]>([])
  const [usersList, setUsersList] = useState<any[]>([])
  const [timeoffsList, setTimeoffsList] = useState<any[]>([])

  const [projectDeps, setProjectDeps] = useState<string[]>([])
  const [projectMembers, setProjectMembers] = useState<string[]>([])
  const [validations, setValidations] = useState<ValidationCheck[]>([])
  const [isReady, setIsReady] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [showPendencyModal, setShowPendencyModal] = useState(false)

  const [draftShifts, setDraftShifts] = useState<any[]>([])
  const [rawDraft, setRawDraft] = useState<any[]>([])
  const [refinementPrompt, setRefinementPrompt] = useState('')
  const [isDraftMode, setIsDraftMode] = useState(false)
  const [draftIteration, setDraftIteration] = useState(1)

  const { toast } = useToast()

  const loadData = async () => {
    try {
      const [c, conts, to] = await Promise.all([
        getShiftCycles(),
        getStaffContracts(),
        getTimeoffRequests(),
      ])
      setCycles(c)
      if (!selectedCycle && c.length > 0) {
        const defaultCycle = c.find((x: any) => x.status === 'active') || c[0]
        if (defaultCycle) setSelectedCycle(defaultCycle.id)
      }
      setContracts(conts)
      setTimeoffsList(to)
    } catch (err) {
      console.error('Failed to load cycles or contracts:', err)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (projectDeps.length > 0) {
      setIsSectorsLoading(true)
      const sectorFilter = projectDeps.map((d) => `department="${d}"`).join(' || ')
      pb.collection('hospital_sectors')
        .getFullList({ filter: sectorFilter, sort: 'name' })
        .then((res) => {
          setSectors(res)
          if (res.length > 0) {
            setSelectedSector((prev) => prev || res[0].id)
          }
        })
        .catch(console.error)
        .finally(() => setIsSectorsLoading(false))
    }
  }, [projectDeps])

  useRealtime('shift_cycles', loadData)
  useRealtime('staff_contracts', loadData)

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
    if (!selectedCycle || !selectedSector || projectDeps.length === 0) {
      setIsReady(false)
      return
    }
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
          cycleDetails.push('⚠️ O ciclo selecionado possui datas de início e/ou fim inválidas.')
        } else {
          cycleDetails.push(`✅ O ciclo ${cycle.name} é válido para geração.`)
        }
      } else {
        cycleStatus = 'error'
        cycleDetails.push('⚠️ O ciclo selecionado não está ativo. O status deve ser "ativo".')
      }
      checks.push({
        id: 'cycle',
        label: 'Ciclo Vigente',
        status: cycleStatus,
        message: cycleStatus === 'error' ? 'Ciclo inválido' : 'Ciclo configurado',
        details: cycleDetails,
      })

      // Sector
      const sector = sectors.find((s) => s.id === selectedSector)
      const sectorDetails = []
      let sectorStatus: 'success' | 'error' = 'success'
      if (!sector) {
        sectorStatus = 'error'
        sectorDetails.push('⚠️ Nenhum setor selecionado.')
      } else {
        if (!sector.min_staffing || !sector.ideal_staffing) {
          sectorStatus = 'error'
          sectorDetails.push(`⚠️ Setor "${sector.name}" está sem dimensionamento mínimo/ideal.`)
        } else {
          sectorDetails.push(`✅ Setor configurado corretamente.`)
        }
      }
      checks.push({
        id: 'sectors',
        label: 'Configuração do Setor',
        status: sectorStatus,
        message: sectorStatus === 'error' ? 'Configuração de Setor Ausente' : 'Configurado',
        details: sectorDetails,
      })

      // Staff & Default Sector
      const sfParts = []
      if (sector) sfParts.push(`default_sector="${sector.id}"`)
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
      setUsersList(users)

      const staffDetails = []
      let staffStatus: 'success' | 'error' | 'warning' = 'success'

      if (users.length === 0) {
        staffStatus = 'error'
        staffDetails.push('Nenhum colaborador associado ao setor selecionado ou ao projeto.')
      } else {
        const usersWithoutRole = users.filter((u) => !u.staff_role)
        const usersWithoutProfile = users.filter((u) => !u.staff_profile)
        const usersWrongSector = users.filter((u) => u.default_sector !== selectedSector)

        if (usersWithoutRole.length > 0) {
          staffStatus = 'error'
          usersWithoutRole.forEach((u) =>
            staffDetails.push(
              `⚠️ Colaborador(a) ${u.name || u.email} está sem cargo (staff_role) atribuído.`,
            ),
          )
        }

        if (usersWithoutProfile.length > 0) {
          staffStatus = 'error'
          usersWithoutProfile.forEach((u) =>
            staffDetails.push(
              `⚠️ Colaborador(a) ${u.name || u.email} está sem perfil (staff_profile) configurado.`,
            ),
          )
        }

        if (usersWrongSector.length > 0) {
          if (staffStatus !== 'error') staffStatus = 'warning'
          usersWrongSector.forEach((u) =>
            staffDetails.push(
              `⚠️ Colaborador(a) ${u.name || u.email} não possui este setor como setor padrão.`,
            ),
          )
        }

        if (staffStatus === 'success') {
          staffDetails.push(
            `✅ Todos os ${users.length} colaboradores possuem cargo e perfil configurados e pertencem ao setor.`,
          )
        }
      }
      checks.push({
        id: 'staff',
        label: 'Colaboradores (Cargos e Perfis)',
        status: staffStatus,
        message:
          staffStatus === 'error'
            ? 'Dados incompletos ou ausentes'
            : staffStatus === 'warning'
              ? 'Atenção aos setores'
              : 'Configurados',
        details: staffDetails,
      })

      // Contracts & Shift Types
      const contractDetails = []
      let contractStatus: 'success' | 'error' = 'success'
      if (users.length > 0) {
        const userIds = users.map((u) => u.id)
        const contractsList = contracts.filter((c) => userIds.includes(c.user))
        const usersWithoutContract = users.filter(
          (u) => !contractsList.some((c) => c.user === u.id),
        )
        const invalidContracts = contractsList.filter(
          (c) => !c.contract_type || !c.monthly_hour_limit || !c.shift_type,
        )

        if (usersWithoutContract.length > 0 || invalidContracts.length > 0) {
          contractStatus = 'error'
          usersWithoutContract.forEach((u) =>
            contractDetails.push(
              `⚠️ Colaborador(a) ${u.name || u.email} não possui contrato (staff_contracts) cadastrado.`,
            ),
          )
          invalidContracts.forEach((c) => {
            const u = users.find((x) => x.id === c.user)
            contractDetails.push(
              `⚠️ Contrato de ${u?.name || u?.email || 'Desconhecido'} possui dados incompletos (tipo, carga horária ou tipo de turno).`,
            )
          })
        } else {
          contractDetails.push(
            `✅ Todos os ${users.length} colaboradores possuem contratos válidos cadastrados.`,
          )
        }
      } else {
        contractStatus = 'error'
        contractDetails.push('⚠️ Sem colaboradores para validar contratos.')
      }
      checks.push({
        id: 'contracts',
        label: 'Contratos e Tipos de Turno',
        status: contractStatus,
        message: contractStatus === 'error' ? 'Contratos pendentes' : 'Configurados',
        details: contractDetails,
      })

      // Timeoff requests
      const timeoffDetails = []
      let timeoffStatus: 'success' | 'warning' = 'success'
      const timeoffsInCycle = timeoffsList.filter(
        (t) => t.cycle === selectedCycle && users.some((u) => u.id === t.user),
      )

      if (timeoffsInCycle.length === 0) {
        timeoffStatus = 'warning'
        timeoffDetails.push(
          '⚠️ Nenhuma solicitação de folga encontrada para os colaboradores neste ciclo.',
        )
      } else {
        timeoffDetails.push(
          `✅ ${timeoffsInCycle.length} solicitações de folga cadastradas neste ciclo.`,
        )
      }

      checks.push({
        id: 'timeoff',
        label: 'Solicitações de Folga',
        status: timeoffStatus,
        message: timeoffStatus === 'warning' ? 'Sem folgas cadastradas' : 'Folgas carregadas',
        details: timeoffDetails,
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
  }, [
    selectedCycle,
    selectedSector,
    projectDeps,
    projectMembers,
    cycles,
    sectors,
    contracts,
    toast,
  ])

  useEffect(() => {
    validate()
  }, [validate])

  useEffect(() => {
    if (showPendencyModal) {
      validate()
    }
  }, [showPendencyModal, validate])

  const mapDraftToShifts = (draftArray: any[]) => {
    return draftArray.map((d: any, index: number) => {
      const contract = contracts.find((c) => c.user === d.user_id)
      const wh = contract?.expand?.shift_type?.work_hours || 12

      let st = '07:00:00'
      let duration = wh
      if (d.shift === 'D') {
        st = '07:00:00'
        duration = wh || 12
      } else if (d.shift === 'N') {
        st = '19:00:00'
        duration = wh || 12
      } else if (d.shift === 'M') {
        st = '07:00:00'
        duration = wh || 6
      } else if (d.shift === 'T') {
        st = '13:00:00'
        duration = wh || 6
      }

      const startDate = new Date(`${d.date}T${st}.000Z`)
      const endDate = new Date(startDate.getTime() + duration * 3600000)

      return {
        id: `draft_${index}_${Math.random().toString(36).substring(2, 9)}`,
        user: d.user_id,
        sector: selectedSector,
        cycle: selectedCycle,
        start_time: startDate.toISOString().replace('T', ' ').substring(0, 23) + 'Z',
        end_time: endDate.toISOString().replace('T', ' ').substring(0, 23) + 'Z',
        expand: {
          user: usersList.find((u) => u.id === d.user_id),
          sector: sectors.find((s) => s.id === selectedSector),
        },
      }
    })
  }

  const handleGenerateDraft = async (isRefinement = false) => {
    if (!selectedCycle || !selectedSector || projectDeps.length === 0) return
    setLoading(true)

    toast({
      title: isRefinement ? 'Refinando Rascunho' : 'Iniciando Geração',
      description: 'A IA está analisando os parâmetros para montar a escala...',
    })

    const cycle = cycles.find((c) => c.id === selectedCycle)
    const sector = sectors.find((s) => s.id === selectedSector)

    const context = {
      cycle: { start_date: cycle?.start_date, end_date: cycle?.end_date },
      sector: {
        name: sector?.name,
        min_staffing: sector?.min_staffing,
        ideal_staffing: sector?.ideal_staffing,
      },
      users: usersList.map((u) => {
        const contract = contracts.find((c) => c.user === u.id)
        const timeoffs = timeoffsList.filter(
          (t) => t.user === u.id && t.cycle === selectedCycle && t.status === 'fulfilled',
        )
        return {
          id: u.id,
          name: u.name,
          role: u.expand?.staff_role?.name,
          contract_hours: contract?.monthly_hour_limit,
          shift_type: contract?.expand?.shift_type?.name,
          work_hours: contract?.expand?.shift_type?.work_hours,
          timeoffs: timeoffs.map((t) => t.date.substring(0, 10)),
        }
      }),
    }

    try {
      const aiSettings = {
        priority: localStorage.getItem('escala_ai_priority') || 'timeoff',
        strictness: parseInt(localStorage.getItem('escala_ai_strictness') || '50', 10),
      }

      const fullContext = {
        ...context,
        ai_settings: aiSettings,
      }

      const res = await generateDraftShifts(
        selectedCycle,
        selectedSector,
        fullContext,
        isRefinement ? refinementPrompt : undefined,
        isRefinement ? rawDraft : undefined,
      )

      if (res && res.draft) {
        setRawDraft(res.draft)
        const mapped = mapDraftToShifts(res.draft)
        setDraftShifts(mapped)
        setIsDraftMode(true)
        if (isRefinement) {
          setDraftIteration((p) => p + 1)
          setRefinementPrompt('')
        }
        toast({
          title: 'Draft Gerado',
          description: `Versão ${isRefinement ? draftIteration + 1 : 1} gerada com sucesso!`,
        })
      }
    } catch (err: any) {
      console.error('Error during AI draft generation:', err)
      const isPBError = err && typeof err === 'object' && 'response' in err
      const respData = isPBError ? err.response : null
      const msg = respData?.error || respData?.message || err.message || 'Falha na geração.'
      const suggestion = respData?.suggestion
      toast({
        title: 'Falha na geração do draft',
        description: typeof msg === 'string' ? msg : JSON.stringify(msg),
        variant: 'destructive',
      })
      if (suggestion) {
        toast({
          title: 'Sugestão da IA',
          description: suggestion,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSaveScale = async () => {
    if (!draftShifts.length) return
    setSaving(true)
    try {
      // Clear previous shifts for this sector and cycle
      const existing = await pb
        .collection('shifts')
        .getFullList({ filter: `cycle="${selectedCycle}" && sector="${selectedSector}"` })
      for (const s of existing) await pb.collection('shifts').delete(s.id)

      // Save new shifts
      for (const ds of draftShifts) {
        await pb.collection('shifts').create({
          user: ds.user,
          sector: ds.sector,
          cycle: ds.cycle,
          start_time: ds.start_time,
          end_time: ds.end_time,
        })
      }
      toast({
        title: 'Escala Salva',
        description: 'Os plantões foram persistidos no banco de dados com sucesso.',
      })
      setIsDraftMode(false)
      setDraftShifts([])
      setRawDraft([])
      setDraftIteration(1)
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const hasIssues = validations.some((v) => v.status === 'error' || v.status === 'warning')
  const cycleObj = cycles.find((c) => c.id === selectedCycle)

  const dailyStaffing = useMemo(() => {
    if (!cycleObj || !selectedSector || !isDraftMode) return []
    const sectorObj = sectors.find((s) => s.id === selectedSector)
    if (!sectorObj) return []

    try {
      const start = new Date(cycleObj.start_date.split(' ')[0])
      const end = new Date(cycleObj.end_date.split(' ')[0])

      const days = []
      let curr = start
      while (curr <= end) {
        days.push(new Date(curr))
        curr.setDate(curr.getDate() + 1)
      }

      return days.map((d) => {
        const dateStr = d.toISOString().split('T')[0]
        const count = draftShifts.filter((s) => s.start_time.startsWith(dateStr)).length

        let status = 'optimal'
        if (count < (sectorObj.min_staffing || 0)) status = 'understaffed'
        else if (count < (sectorObj.ideal_staffing || 0)) status = 'suboptimal'

        return {
          date: d,
          dateStr,
          count,
          status,
          min: sectorObj.min_staffing,
          ideal: sectorObj.ideal_staffing,
        }
      })
    } catch {
      return []
    }
  }, [draftShifts, cycleObj, selectedSector, sectors, isDraftMode])

  const draftAlerts = dailyStaffing.filter((d) => d.status !== 'optimal')

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="relative overflow-hidden border-emerald-900/20 bg-gradient-to-b from-white to-emerald-50/30 shadow-sm">
        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-700 z-10" />
        <CardHeader className="pb-4 pt-6">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-emerald-700" />
            <CardTitle>Geração Inteligente de Escalas</CardTitle>
          </div>
          <CardDescription>
            O motor de IA analisará os contratos, regras, disponibilidade e setorização para gerar
            um rascunho de escala para revisão.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ciclo Alvo</label>
              <Select value={selectedCycle} onValueChange={setSelectedCycle} disabled={isDraftMode}>
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
              <Select
                value={selectedSector}
                onValueChange={setSelectedSector}
                disabled={isDraftMode || isSectorsLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isSectorsLoading ? 'Carregando setores...' : 'Selecione o setor...'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-white/50 border-t py-4 flex flex-col items-start gap-4">
          {!isDraftMode ? (
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <Button
                onClick={() => {
                  validate()
                  setShowPendencyModal(true)
                }}
                disabled={loading || !selectedCycle || !selectedSector}
                className="w-full sm:w-auto gap-2 transition-all bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                Gerar com IA
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full bg-emerald-50 p-3 rounded-lg border border-emerald-200 shadow-sm">
              <Info className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800">
                  Modo Rascunho Ativo (Versão {draftIteration})
                </p>
                <p className="text-xs text-emerald-600">
                  Refine o draft usando a caixa de texto abaixo ou salve se estiver satisfeito.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDraftMode(false)
                  setDraftShifts([])
                  setRawDraft([])
                  setDraftIteration(1)
                }}
                disabled={loading || saving}
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-100"
              >
                Descartar Rascunho
              </Button>
            </div>
          )}
          {!isReady && selectedCycle && selectedSector && !isDraftMode && (
            <p className="text-xs text-red-500 font-medium">
              A geração está desabilitada devido a erros de validação nos parâmetros. Clique em "Ver
              Pendências".
            </p>
          )}
        </CardFooter>
      </Card>

      {isDraftMode && draftShifts.length > 0 && cycleObj && (
        <Card className="relative overflow-hidden shadow-md border-emerald-900/10 animate-fade-in-up">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-600 z-10" />
          <CardHeader className="bg-slate-50 border-b pb-4 pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                <CalendarIcon className="h-5 w-5 text-emerald-600" />
                Rascunho de Escala (Versão {draftIteration})
                <Badge
                  variant="outline"
                  className="bg-amber-100 text-amber-800 border-amber-300 ml-2"
                >
                  Não Salvo
                </Badge>
              </CardTitle>
              <Button
                size="sm"
                onClick={handleSaveScale}
                disabled={saving || loading}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto shadow-sm"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar Escala Definitiva
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ShiftCalendar shifts={draftShifts} cycle={cycleObj} contracts={contracts} />

            <div className="p-5 bg-emerald-50/50 border-t flex flex-col gap-3">
              {draftAlerts.length > 0 && (
                <div className="mb-2">
                  <label className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Alertas de Efetivo no Rascunho
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {draftAlerts.map((alert) => (
                      <Badge
                        key={alert.dateStr}
                        variant="outline"
                        className={cn(
                          'cursor-pointer hover:bg-slate-100 transition-colors',
                          alert.status === 'understaffed'
                            ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                            : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100',
                        )}
                        onClick={() =>
                          setRefinementPrompt(
                            `Encontre um profissional disponível para preencher a lacuna no dia ${format(alert.date, 'dd/MM/yyyy')} que está com ${alert.count} profissionais (ideal: ${alert.ideal}).`,
                          )
                        }
                      >
                        {format(alert.date, 'dd/MM')}: {alert.count} agendados (Min: {alert.min},
                        Ideal: {alert.ideal})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <label className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                Refinamento com IA
              </label>
              <p className="text-xs text-emerald-700">
                Utilize linguagem natural para solicitar ajustes e melhorias na escala atual. A IA
                considerará este rascunho como base.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: Troque o plantão do João com a Maria no dia 15, ou garanta mais uma folga para Pedro."
                  value={refinementPrompt}
                  onChange={(e) => setRefinementPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && refinementPrompt.trim()) {
                      e.preventDefault()
                      handleGenerateDraft(true)
                    }
                  }}
                  disabled={loading || saving}
                  className="bg-white border-emerald-200 focus-visible:ring-emerald-500"
                />
                <Button
                  onClick={() => handleGenerateDraft(true)}
                  disabled={!refinementPrompt.trim() || loading || saving}
                  className="gap-2 shrink-0 bg-slate-800 hover:bg-slate-900 text-white"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Refinar Draft
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showPendencyModal} onOpenChange={setShowPendencyModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b bg-white">
            <DialogTitle className="text-xl text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Checklist de Validação (Pré-Geração)
            </DialogTitle>
            <DialogDescription className="mt-2 text-slate-600">
              A IA precisa de dados estruturados para gerar a escala. Verifique as pendências
              abaixo.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 p-6 bg-slate-50/50">
            <div className="space-y-6">
              {isValidating && validations.length === 0 ? (
                <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Verificando dados no banco...</span>
                </div>
              ) : (
                validations.map((v) => (
                  <div key={v.id} className="space-y-3 bg-white p-4 rounded-lg border shadow-sm">
                    <div className="flex items-center gap-2">
                      <CheckItemIcon status={v.status} />
                      <h4 className="font-semibold text-base text-slate-800 flex items-center gap-2">
                        {v.label}
                        {v.status === 'error' && (
                          <Badge
                            variant="destructive"
                            className="text-[10px] h-5 px-1.5 font-medium"
                          >
                            Erro Crítico
                          </Badge>
                        )}
                        {v.status === 'warning' && (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 bg-amber-50 text-amber-700 border-amber-200 px-1.5 font-medium"
                          >
                            Atenção
                          </Badge>
                        )}
                        {v.status === 'success' && (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 bg-emerald-50 text-emerald-700 border-emerald-200 px-1.5 font-medium"
                          >
                            Validado
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
          </ScrollArea>
          <div className="p-4 border-t bg-white flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
            <Button
              variant="outline"
              onClick={() => setShowPendencyModal(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              disabled={!isReady || loading || isValidating}
              onClick={() => {
                setShowPendencyModal(false)
                handleGenerateDraft(false)
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {isReady ? 'Prosseguir para Geração' : 'Resolva as pendências'}
            </Button>
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
