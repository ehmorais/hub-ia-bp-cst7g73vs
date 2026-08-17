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
  commitShiftSchedule,
  getGenerationRun,
  getDraft,
  getDraftIssues,
  getRunIssues,
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
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronRight,
  Activity,
  ListChecks,
  Cpu,
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
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
  DialogFooter,
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
  } catch {
    return 'Data inválida'
  }
}

type LoadStatus = 'idle' | 'loading' | 'success' | 'error'
type GenStatus = 'idle' | 'validating' | 'generating' | 'saving' | 'success' | 'error'

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

type Diagnostics = {
  eligible_count?: number
  excluded?: Array<{ name: string; reason: string }>
  orphan_contracts_ignored?: number
  hard_rules?: any[]
  preferred_rules?: any[]
  contradictions?: string[]
  effective_rest_hours?: number
  effective_min_staffing?: number
  cycle_start?: string
  cycle_end?: string
}

// Generation-run metrics from schedule_generation_runs.metrics (json).
type RunMetrics = {
  eligible_count?: number
  orphan_contracts_ignored?: number
  hard_rules_count?: number
  preferred_rules_count?: number
  contradictions_count?: number
  tokens_used?: number
  shifts_proposed?: number
  shifts_accepted?: number
  shifts_rejected?: number
}

type ValidationIssue = {
  id: string
  rule_name?: string
  severity?: 'hard' | 'preference' | 'info'
  code?: string
  message?: string
  issue_date?: string
  resolved?: boolean
}

function DiagnosticsPanel({ diagnostics }: { diagnostics: Diagnostics }) {
  if (!diagnostics) return null
  return (
    <div className="space-y-3 bg-white p-4 rounded-lg border">
      <h4 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
        <Info className="h-4 w-4 text-slate-500" />
        Diagnóstico de Elegibilidade e Regras
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-emerald-50 p-2 rounded border border-emerald-100">
          <p className="text-emerald-700 font-medium">Elegíveis</p>
          <p className="text-lg font-bold text-emerald-800">{diagnostics.eligible_count ?? '-'}</p>
        </div>
        <div className="bg-red-50 p-2 rounded border border-red-100">
          <p className="text-red-700 font-medium">Excluídos</p>
          <p className="text-lg font-bold text-red-800">{diagnostics.excluded?.length ?? 0}</p>
        </div>
        <div className="bg-amber-50 p-2 rounded border border-amber-100">
          <p className="text-amber-700 font-medium">Contratos órfãos</p>
          <p className="text-lg font-bold text-amber-800">
            {diagnostics.orphan_contracts_ignored ?? 0}
          </p>
        </div>
        <div className="bg-blue-50 p-2 rounded border border-blue-100">
          <p className="text-blue-700 font-medium">Regras duras</p>
          <p className="text-lg font-bold text-blue-800">{diagnostics.hard_rules?.length ?? 0}</p>
        </div>
      </div>

      {diagnostics.excluded && diagnostics.excluded.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1">Colaboradores excluídos:</p>
          <ul className="text-xs text-slate-500 space-y-1 max-h-32 overflow-y-auto">
            {diagnostics.excluded.map((ex, i) => (
              <li key={i}>
                • {ex.name}: <span className="text-red-600">{ex.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diagnostics.contradictions && diagnostics.contradictions.length > 0 && (
        <div className="bg-amber-50 p-3 rounded border border-amber-200">
          <p className="text-xs font-semibold text-amber-800 mb-1">
            Regras potencialmente conflitantes:
          </p>
          <ul className="text-xs text-amber-700 space-y-1">
            {diagnostics.contradictions.map((c, i) => (
              <li key={i}>• {c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-xs text-slate-500 space-y-1">
        <p>
          <strong>Descanso mínimo efetivo:</strong> {diagnostics.effective_rest_hours ?? '-'}h
        </p>
        <p>
          <strong>Efetivo mínimo diário:</strong> {diagnostics.effective_min_staffing ?? '-'}
        </p>
        {diagnostics.preferred_rules && diagnostics.preferred_rules.length > 0 && (
          <p>
            <strong>Regras preferenciais:</strong>{' '}
            {diagnostics.preferred_rules.map((r) => r.name).join(', ')}
          </p>
        )}
      </div>
    </div>
  )
}

// Badge describing the generation origin (AI / Fallback / Híbrida).
function SourceBadge({ source }: { source?: 'ai' | 'fallback' | string }) {
  if (!source) return null
  const isFallback = source === 'fallback'
  return (
    <Badge
      variant="outline"
      className={cn(
        'ml-2 gap-1',
        isFallback
          ? 'bg-amber-100 text-amber-800 border-amber-300'
          : 'bg-indigo-100 text-indigo-800 border-indigo-300',
      )}
    >
      <Cpu className="h-3 w-3" />
      {isFallback ? 'Fallback' : 'IA'}
    </Badge>
  )
}

// Collapsible metrics panel showing the run metrics (eligible count, tokens,
// shifts proposed/accepted/rejected). Pulled from schedule_generation_runs.
function GenerationMetricsPanel({ metrics }: { metrics: RunMetrics | null }) {
  const [open, setOpen] = useState(false)
  if (!metrics) return null
  const cells = [
    { label: 'Elegíveis', value: metrics.eligible_count ?? '-', tone: 'emerald' },
    { label: 'Tokens usados', value: metrics.tokens_used ?? 0, tone: 'blue' },
    { label: 'Plantões propostos', value: metrics.shifts_proposed ?? 0, tone: 'slate' },
    { label: 'Aceitos', value: metrics.shifts_accepted ?? 0, tone: 'emerald' },
    { label: 'Rejeitados', value: metrics.shifts_rejected ?? 0, tone: 'red' },
    { label: 'Regras duras', value: metrics.hard_rules_count ?? 0, tone: 'blue' },
  ]
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="bg-white rounded-lg border">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 w-full p-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-lg"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
          <Activity className="h-4 w-4 text-emerald-600" />
          Métricas da Geração
          <span className="ml-auto text-xs font-normal text-slate-500">
            {metrics.shifts_accepted ?? 0}/{metrics.shifts_proposed ?? 0} plantões aceitos
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 pt-0 text-xs">
          {cells.map((c) => (
            <div
              key={c.label}
              className={cn(
                'p-2 rounded border',
                c.tone === 'emerald' && 'bg-emerald-50 border-emerald-100',
                c.tone === 'blue' && 'bg-blue-50 border-blue-100',
                c.tone === 'red' && 'bg-red-50 border-red-100',
                c.tone === 'slate' && 'bg-slate-50 border-slate-100',
              )}
            >
              <p
                className={cn(
                  'font-medium',
                  c.tone === 'emerald' && 'text-emerald-700',
                  c.tone === 'blue' && 'text-blue-700',
                  c.tone === 'red' && 'text-red-700',
                  c.tone === 'slate' && 'text-slate-700',
                )}
              >
                {c.label}
              </p>
              <p
                className={cn(
                  'text-lg font-bold',
                  c.tone === 'emerald' && 'text-emerald-800',
                  c.tone === 'blue' && 'text-blue-800',
                  c.tone === 'red' && 'text-red-800',
                  c.tone === 'slate' && 'text-slate-800',
                )}
              >
                {c.value}
              </p>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// Collapsible issues panel listing the validation_issues persisted for the
// run/draft (hard violations + preference warnings).
function GenerationIssuesPanel({ issues }: { issues: ValidationIssue[] }) {
  const [open, setOpen] = useState(false)
  if (issues.length === 0) return null
  const hard = issues.filter((i) => i.severity === 'hard')
  const pref = issues.filter((i) => i.severity === 'preference')
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="bg-white rounded-lg border">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 w-full p-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-lg"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
          <ListChecks className="h-4 w-4 text-amber-600" />
          Issues de Validação
          <span className="ml-auto text-xs font-normal text-slate-500">
            {hard.length} dura(s) · {pref.length} preferencial(is)
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="p-3 pt-0 space-y-1 max-h-60 overflow-y-auto text-xs">
          {issues.map((iss) => (
            <li
              key={iss.id}
              className={cn(
                'flex items-start gap-2 p-2 rounded border',
                iss.severity === 'hard'
                  ? 'bg-red-50 border-red-100 text-red-700'
                  : 'bg-amber-50 border-amber-100 text-amber-700',
              )}
            >
              <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-white/70 shrink-0">
                {iss.code || iss.rule_name || '—'}
              </span>
              <span className="break-words">{iss.message}</span>
              {iss.issue_date && (
                <span className="ml-auto text-[10px] text-slate-400 shrink-0">
                  {iss.issue_date}
                </span>
              )}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
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
  const [cyclesStatus, setCyclesStatus] = useState<LoadStatus>('idle')
  const [cyclesError, setCyclesError] = useState<string>('')

  const [sectors, setSectors] = useState<any[]>([])
  const [selectedSector, setSelectedSector] = useState<string>('')
  const [sectorsStatus, setSectorsStatus] = useState<LoadStatus>('idle')
  const [sectorsError, setSectorsError] = useState<string>('')

  const [contracts, setContracts] = useState<any[]>([])

  const [genStatus, setGenStatus] = useState<GenStatus>('idle')
  const [genError, setGenError] = useState<string>('')
  const [genDiagnostics, setGenDiagnostics] = useState<Diagnostics | null>(null)
  const [genSuggestion, setGenSuggestion] = useState<string>('')

  const [draftExists, setDraftExists] = useState<{
    cycle_id: string
    sector_id: string
    existing_count: number
    existing_run_id?: string
    existing_draft_id?: string
  } | null>(null)

  const [draftShifts, setDraftShifts] = useState<any[]>([])
  const [rawDraft, setRawDraft] = useState<any[]>([])
  const [refinementPrompt, setRefinementPrompt] = useState('')
  const [isDraftMode, setIsDraftMode] = useState(false)
  const [draftIteration, setDraftIteration] = useState(1)

  // Generation run/draft tracking (schedule_generation_runs + schedule_drafts).
  const [runId, setRunId] = useState<string>('')
  const [draftId, setDraftId] = useState<string>('')
  const [genSource, setGenSource] = useState<'ai' | 'fallback' | ''>('')
  const [runMetrics, setRunMetrics] = useState<RunMetrics | null>(null)
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([])

  const { toast } = useToast()

  // Load the full generation run + its validation issues for display. Used
  // both after a fresh generation (run_id from the response) and when opening
  // an existing draft (existing_run_id from the idempotency payload).
  const loadRunTracking = useCallback(async (rId: string, dId?: string) => {
    if (!rId) return
    try {
      const run: any = await getGenerationRun(rId)
      setRunMetrics((run?.metrics as RunMetrics) || null)
      setGenSource(
        run?.generation_source === 'deterministic'
          ? 'fallback'
          : (run?.generation_source as 'ai' | 'fallback') || '',
      )
    } catch (err) {
      console.error('Failed to load generation run:', err)
    }
    // Issues may be attached to the draft (success path) or to the run
    // alone (validation_failed path with no draft). Prefer the draft's.
    try {
      const issues = dId ? await getDraftIssues(dId) : await getRunIssues(rId)
      setValidationIssues(issues as ValidationIssue[])
    } catch (err) {
      // Try the run-only issues as a fallback.
      try {
        const issues = await getRunIssues(rId)
        setValidationIssues(issues as ValidationIssue[])
      } catch (_) {
        setValidationIssues([])
      }
    }
  }, [])

  // --- Load cycles (always terminates in success/empty/error) ---
  const loadCycles = useCallback(async () => {
    setCyclesStatus('loading')
    setCyclesError('')
    try {
      const c = await getShiftCycles()
      setCycles(c)
      setCyclesStatus('success')
    } catch (err: any) {
      console.error('Failed to load cycles:', err)
      setCyclesError(err?.message || 'Não foi possível carregar os ciclos.')
      setCyclesStatus('error')
    }
  }, [])

  // --- Load contracts (for the calendar display) ---
  const loadContracts = useCallback(async () => {
    try {
      const conts = await pb.collection('staff_contracts').getFullList({
        expand: 'staff_profile,staff_profile.default_sector,shift_type',
        sort: '-updated',
      })
      setContracts(conts)
    } catch (err) {
      console.error('Failed to load contracts:', err)
    }
  }, [])

  useEffect(() => {
    loadCycles()
    loadContracts()
  }, [loadCycles, loadContracts])

  // Auto-select first active cycle once loaded
  useEffect(() => {
    if (cyclesStatus === 'success' && !selectedCycle && cycles.length > 0) {
      const defaultCycle = cycles.find((x) => x.status === 'active') || cycles[0]
      if (defaultCycle) setSelectedCycle(defaultCycle.id)
    }
  }, [cyclesStatus, cycles, selectedCycle])

  // --- Load sectors: route-independent, always terminates ---
  // The project/department narrows the sector list, but if no department
  // is resolvable we fall back to ALL sectors so the selector is never
  // stuck in "Carregando setores..." forever.
  const loadSectors = useCallback(async () => {
    setSectorsStatus('loading')
    setSectorsError('')

    // Resolve the department filter (project -> department + associated_departments).
    let depIds: string[] = []
    if (projectId) {
      try {
        const p = await pb.collection('projects').getOne(projectId, {
          expand: 'associated_departments',
        })
        depIds = [p.department, ...(p.associated_departments || [])].filter(Boolean)
      } catch {
        // fall through to departmentId or all
      }
    }
    if (depIds.length === 0 && departmentId) {
      depIds = [departmentId]
    }

    try {
      let result: any[]
      if (depIds.length > 0) {
        const filter = depIds.map((d) => `department="${d}"`).join(' || ')
        result = await pb.collection('hospital_sectors').getFullList({
          filter,
          sort: 'name',
        })
        // If the department filter returned nothing, fall back to all
        // sectors rather than leaving the user stuck.
        if (result.length === 0) {
          result = await pb.collection('hospital_sectors').getFullList({ sort: 'name' })
        }
      } else {
        result = await pb.collection('hospital_sectors').getFullList({ sort: 'name' })
      }
      setSectors(result)
      if (result.length > 0) {
        setSelectedSector((prev) => prev || result[0].id)
      }
      setSectorsStatus('success')
    } catch (err: any) {
      console.error('Failed to load sectors:', err)
      setSectorsError(err?.message || 'Não foi possível carregar os setores.')
      setSectorsStatus('error')
    }
  }, [projectId, departmentId])

  useEffect(() => {
    loadSectors()
  }, [loadSectors])

  useRealtime('shift_cycles', loadCycles)
  useRealtime('hospital_sectors', loadSectors)

  const cycleObj = cycles.find((c) => c.id === selectedCycle)
  const sectorObj = sectors.find((s) => s.id === selectedSector)

  const canGenerate =
    !!selectedCycle &&
    !!selectedSector &&
    cyclesStatus === 'success' &&
    sectorsStatus === 'success' &&
    genStatus !== 'generating' &&
    genStatus !== 'validating' &&
    genStatus !== 'saving'

  // --- Generate (or refine) ---
  const handleGenerateDraft = async (isRefinement = false, replace = false) => {
    if (!selectedCycle || !selectedSector) return
    setGenStatus(isRefinement ? 'generating' : 'validating')
    setGenError('')
    setGenDiagnostics(null)
    setGenSuggestion('')
    setDraftExists(null)
    setRunId('')
    setDraftId('')
    setGenSource('')
    setRunMetrics(null)
    setValidationIssues([])

    toast({
      title: isRefinement ? 'Refinando Rascunho' : 'Iniciando Geração',
      description: isRefinement
        ? 'A IA está refinando o rascunho atual...'
        : 'Validando pré-requisitos e gerando a escala...',
    })

    try {
      const aiSettings = {
        priority: localStorage.getItem('escala_ai_priority') || 'timeoff',
        strictness: parseInt(localStorage.getItem('escala_ai_strictness') || '50', 10),
      }

      const res: any = await generateDraftShifts(
        selectedCycle,
        selectedSector,
        { ai_settings: aiSettings },
        isRefinement ? refinementPrompt : undefined,
        isRefinement ? rawDraft : undefined,
        replace,
      )

      // Idempotency: an existing draft was found and replace was not requested.
      if (res && res.draft_exists) {
        setGenStatus('idle')
        const existingRunId = res.existing_run_id || res.run_id || ''
        const existingDraftId = res.existing_draft_id || ''
        setDraftExists({
          cycle_id: res.cycle_id || '',
          sector_id: res.sector_id || '',
          existing_count: res.existing_count || 0,
          existing_run_id: existingRunId,
          existing_draft_id: existingDraftId,
        })
        // Pre-load the associated run/draft tracking so the idempotency
        // dialog can show metrics + issues for the existing draft.
        if (existingRunId) {
          loadRunTracking(existingRunId, existingDraftId)
        }
        toast({
          title: 'Rascunho existente',
          description: `Já existem ${res.existing_count} plantões para este ciclo/setor.`,
        })
        return
      }

      if (res && res.success && Array.isArray(res.draft)) {
        setRawDraft(res.draft)

        // Reload the records persisted by the backend with their relations
        // expanded. The generation response intentionally contains only IDs;
        // rendering it directly caused every card to show "Sem nome".
        let hydratedDraft = res.draft
        try {
          hydratedDraft = await pb.collection('shifts').getFullList({
            filter: `cycle="${selectedCycle}" && sector="${selectedSector}"`,
            expand: 'staff_profile,staff_profile.staff_role,sector,cycle',
            sort: 'start_time',
          })
        } catch (hydrateError) {
          console.error('Falha ao carregar nomes do rascunho:', hydrateError)
        }
        setDraftShifts(hydratedDraft)
        setIsDraftMode(true)
        if (isRefinement) {
          setDraftIteration((p) => p + 1)
          setRefinementPrompt('')
        }
        setGenStatus('success')
        setGenDiagnostics(res.diagnostics || null)
        const isFallback = res.source === 'fallback'
        setGenSource(isFallback ? 'fallback' : 'ai')
        if (res.run_id) setRunId(res.run_id)
        if (res.draft_id) setDraftId(res.draft_id)
        // Load full metrics + issues from the persisted run/draft.
        if (res.run_id) {
          loadRunTracking(res.run_id, res.draft_id)
        }
        toast({
          title: isFallback ? 'Rascunho gerado (fallback)' : 'Rascunho Gerado',
          description: isFallback
            ? `${res.draft.length} plantões gerados por fallback determinístico (a IA não retornou JSON válido). Revise antes de publicar.`
            : `${res.draft.length} plantões gerados e salvos como rascunho (não publicado).`,
          variant: isFallback ? 'destructive' : 'default',
        })
        // Surface any warnings (rest/staffing notes, or the fallback notice).
        if (Array.isArray(res.warnings) && res.warnings.length > 0) {
          toast({
            title: 'Avisos',
            description: res.warnings.slice(0, 3).join(' • '),
          })
        }
        return
      }

      // Error path with diagnostics
      setGenDiagnostics(res?.diagnostics || null)
      setGenSuggestion(res?.suggestion || '')
      const msg = res?.error || res?.response?.error || 'A geração não retornou um rascunho válido.'
      setGenError(typeof msg === 'string' ? msg : JSON.stringify(msg))
      setGenStatus('error')
      toast({
        title: 'Falha na geração',
        description: typeof msg === 'string' ? msg : JSON.stringify(msg),
        variant: 'destructive',
      })
      if (res?.suggestion) {
        toast({ title: 'Sugestão da IA', description: res.suggestion })
      }
    } catch (err: any) {
      console.error('Error during AI draft generation:', err)
      const isPBError = err && typeof err === 'object' && 'response' in err
      const respData = isPBError ? err.response : null
      // A 502/gateway timeout surfaces from the SDK as a generic
      // "Something went wrong." message (and err.status === 502), which is
      // useless to the user. Detect that specific case and show an
      // actionable, friendly message instead. The hook also returns a
      // structured body with stage='ai_timeout' when it can — prefer that.
      const isTimeout =
        err?.status === 502 ||
        err?.status === 504 ||
        respData?.stage === 'ai_timeout' ||
        err?.message === 'Something went wrong.' ||
        (typeof err?.message === 'string' && /timeout|timed out|gateway/i.test(err.message))
      const fallbackTimeoutMsg =
        'O servidor de IA excedeu o tempo limite. Isto pode ocorrer com muitos colaboradores ou regras complexas. Tente novamente — a segunda tentativa costuma ser mais rápida.'
      const rawMsg = respData?.error || respData?.message || err.message || 'Falha na geração.'
      const msg = isTimeout ? respData?.error || fallbackTimeoutMsg : rawMsg
      setGenError(typeof msg === 'string' ? msg : JSON.stringify(msg))
      setGenDiagnostics(respData?.diagnostics || null)
      setGenSuggestion(respData?.suggestion || '')
      setGenStatus('error')
      toast({
        title: isTimeout ? 'Tempo limite da IA' : 'Falha na geração do draft',
        description: typeof msg === 'string' ? msg : JSON.stringify(msg),
        variant: 'destructive',
      })
      if (respData?.suggestion) {
        toast({ title: 'Sugestão da IA', description: respData.suggestion })
      }
    }
  }

  // --- Publish the saved draft (commit) ---
  const handleSaveScale = async () => {
    if (!draftShifts.length) return
    setGenStatus('saving')
    try {
      const result: any = await commitShiftSchedule(
        selectedCycle,
        selectedSector,
        draftShifts.map((ds) => ({
          staff_profile: ds.staff_profile,
          sector: ds.sector || selectedSector,
          cycle: ds.cycle || selectedCycle,
          start_time: ds.start_time,
          end_time: ds.end_time,
          // Pass the draft_id so the commit endpoint can associate the
          // published shifts with their generation draft (if it supports it).
          draft: draftId || ds.draft || undefined,
          generation_run: runId || ds.generation_run || undefined,
        })),
        false, // never auto-publish
      )
      toast({
        title: 'Escala Salva',
        description:
          result?.warnings?.length > 0
            ? `Escala salva com ${result.warnings.length} aviso(s).`
            : 'Os plantões foram validados e persistidos.',
      })
      setIsDraftMode(false)
      setDraftShifts([])
      setRawDraft([])
      setDraftIteration(1)
      setGenStatus('idle')
    } catch (err: any) {
      const response = err?.response
      const details = response?.violations
      toast({
        title: 'Escala não salva',
        description:
          Array.isArray(details) && details.length
            ? details.slice(0, 4).join(' • ')
            : response?.error || err.message,
        variant: 'destructive',
      })
      setGenStatus('error')
    }
  }

  const dailyStaffing = useMemo(() => {
    if (!cycleObj || !selectedSector || !isDraftMode) return []
    if (!sectorObj) return []

    try {
      const start = new Date(cycleObj.start_date.split(' ')[0])
      const end = new Date(cycleObj.end_date.split(' ')[0])

      const days: Date[] = []
      const curr = new Date(start)
      while (curr <= end) {
        days.push(new Date(curr))
        curr.setDate(curr.getDate() + 1)
      }

      return days.map((d) => {
        const dateStr = d.toISOString().split('T')[0]
        const count = draftShifts.filter((s) => {
          const st = s.start_time || ''
          return st.startsWith(dateStr) || st.startsWith(dateStr.replace(/-/g, '-'))
        }).length

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
  }, [draftShifts, cycleObj, selectedSector, sectorObj, isDraftMode])

  const draftAlerts = dailyStaffing.filter((d) => d.status !== 'optimal')

  const statusLabel: Record<GenStatus, string> = {
    idle: '',
    validating: 'Validando pré-requisitos...',
    generating: 'Gerando com IA...',
    saving: 'Salvando rascunho...',
    success: 'Rascunho gerado com sucesso',
    error: 'Falha na geração',
  }

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
            um rascunho de escala para revisão. O resultado é salvo como rascunho e nunca publicado
            automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ciclo Alvo</label>
              <Select
                value={selectedCycle}
                onValueChange={setSelectedCycle}
                disabled={isDraftMode || cyclesStatus === 'loading'}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      cyclesStatus === 'loading'
                        ? 'Carregando ciclos...'
                        : cyclesStatus === 'error'
                          ? 'Erro ao carregar ciclos'
                          : cycles.length === 0
                            ? 'Nenhum ciclo cadastrado'
                            : 'Selecione o ciclo...'
                    }
                  />
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
              {cyclesStatus === 'error' && (
                <div className="flex items-center gap-2 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  <span>{cyclesError}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-xs"
                    onClick={loadCycles}
                  >
                    Tentar novamente
                  </Button>
                </div>
              )}
              {cyclesStatus === 'success' && cycles.length === 0 && (
                <p className="text-xs text-amber-600">
                  Nenhum ciclo cadastrado. Crie um ciclo na aba "Ciclos" antes de gerar.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Setor Específico</label>
              <Select
                value={selectedSector}
                onValueChange={setSelectedSector}
                disabled={isDraftMode || sectorsStatus === 'loading'}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      sectorsStatus === 'loading'
                        ? 'Carregando setores...'
                        : sectorsStatus === 'error'
                          ? 'Erro ao carregar setores'
                          : sectors.length === 0
                            ? 'Nenhum setor cadastrado'
                            : 'Selecione o setor...'
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
              {sectorsStatus === 'error' && (
                <div className="flex items-center gap-2 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  <span>{sectorsError}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-xs"
                    onClick={loadSectors}
                  >
                    Tentar novamente
                  </Button>
                </div>
              )}
              {sectorsStatus === 'success' && sectors.length === 0 && (
                <p className="text-xs text-amber-600">
                  Nenhum setor cadastrado. Crie um setor na aba "Setores" antes de gerar.
                </p>
              )}
            </div>
          </div>

          {/* Generation status banner */}
          {(genStatus === 'validating' ||
            genStatus === 'generating' ||
            genStatus === 'saving' ||
            genStatus === 'success' ||
            genStatus === 'error') && (
            <div
              className={cn(
                'flex items-center gap-3 p-3 rounded-md border text-sm',
                genStatus === 'error'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : genStatus === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-blue-50 border-blue-200 text-blue-700',
              )}
            >
              {(genStatus === 'validating' ||
                genStatus === 'generating' ||
                genStatus === 'saving') && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
              {genStatus === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
              {genStatus === 'error' && <XCircle className="h-4 w-4 shrink-0" />}
              <span className="font-medium">{statusLabel[genStatus]}</span>
              {genStatus === 'error' && genError && (
                <span className="text-xs text-red-600 truncate">— {genError}</span>
              )}
              {/* Origin badge (AI / Fallback) on success. */}
              {genStatus === 'success' && genSource && <SourceBadge source={genSource} />}
            </div>
          )}

          {genDiagnostics && <DiagnosticsPanel diagnostics={genDiagnostics} />}

          {/* Run metrics + validation issues (collapsible). Shown whenever a
              run was created (fresh generation or an existing-draft open). */}
          {runId && (
            <div className="space-y-2">
              <GenerationMetricsPanel metrics={runMetrics} />
              <GenerationIssuesPanel issues={validationIssues} />
            </div>
          )}

          {genSuggestion && (
            <div className="flex items-start gap-2 p-3 rounded-md border bg-indigo-50 border-indigo-200 text-sm text-indigo-800">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Sugestão do Escala Expert</p>
                <p className="text-xs mt-1">{genSuggestion}</p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-white/50 border-t py-4 flex flex-col items-start gap-4">
          {!isDraftMode ? (
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <Button
                onClick={() => handleGenerateDraft(false, false)}
                disabled={!canGenerate}
                className="w-full sm:w-auto gap-2 transition-all bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
              >
                {genStatus === 'validating' || genStatus === 'generating' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                Gerar com IA
              </Button>
              {!canGenerate && selectedCycle && selectedSector && (
                <p className="text-xs text-slate-500">
                  Aguarde o carregamento dos dados ou resolva os pendentes acima.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full bg-emerald-50 p-3 rounded-lg border border-emerald-200 shadow-sm">
              <Info className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800">
                  Modo Rascunho Ativo (Versão {draftIteration})
                </p>
                <p className="text-xs text-emerald-600">
                  O rascunho já está salvo. Refine abaixo ou publique a escala definitiva.
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
                  setGenStatus('idle')
                }}
                disabled={genStatus === 'generating' || genStatus === 'saving'}
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-100"
              >
                Descartar Rascunho
              </Button>
            </div>
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
                  Não Publicado
                </Badge>
              </CardTitle>
              <Button
                size="sm"
                onClick={handleSaveScale}
                disabled={genStatus === 'saving' || genStatus === 'generating'}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto shadow-sm"
              >
                {genStatus === 'saving' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Publicar Escala Definitiva
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
                Utilize linguagem natural para solicitar ajustes. A IA considerará este rascunho
                como base e o rascunho será substituído.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: Troque o plantão do João com a Maria no dia 15, ou garanta mais uma folga para Pedro."
                  value={refinementPrompt}
                  onChange={(e) => setRefinementPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && refinementPrompt.trim()) {
                      e.preventDefault()
                      handleGenerateDraft(true, true)
                    }
                  }}
                  disabled={genStatus === 'generating' || genStatus === 'saving'}
                  className="bg-white border-emerald-200 focus-visible:ring-emerald-500"
                />
                <Button
                  onClick={() => handleGenerateDraft(true, true)}
                  disabled={
                    !refinementPrompt.trim() || genStatus === 'generating' || genStatus === 'saving'
                  }
                  className="gap-2 shrink-0 bg-slate-800 hover:bg-slate-900 text-white"
                >
                  {genStatus === 'generating' ? (
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

      {/* Idempotency dialog: existing draft for cycle+sector */}
      <Dialog open={!!draftExists} onOpenChange={(o) => !o && setDraftExists(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rascunho existente</DialogTitle>
            <DialogDescription>
              Já existem <strong>{draftExists?.existing_count}</strong> plantões salvos como
              rascunho para este ciclo e setor. Deseja abrir o rascunho existente ou substituí-lo
              por uma nova geração?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setDraftExists(null)}>
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                if (!draftExists) return
                // Load the existing draft shifts for display.
                try {
                  const existing = await pb.collection('shifts').getFullList({
                    filter: `cycle="${draftExists.cycle_id}" && sector="${draftExists.sector_id}"`,
                    expand: 'staff_profile,sector',
                    sort: 'start_time',
                  })
                  setDraftShifts(existing)
                  setRawDraft(
                    existing.map((s: any) => ({
                      staff_profile: s.staff_profile,
                      name: s.expand?.staff_profile?.name,
                      sector: s.sector,
                      cycle: s.cycle,
                      start_time: s.start_time,
                      end_time: s.end_time,
                      draft: s.draft,
                      generation_run: s.generation_run,
                    })),
                  )
                  setIsDraftMode(true)
                  setDraftIteration(1)
                  setGenStatus('idle')
                  // Carry over the run/draft tracking from the existing shifts
                  // so metrics + issues are visible in draft mode too.
                  const firstDraft = existing[0]?.draft || draftExists.existing_draft_id || ''
                  const firstRun = existing[0]?.generation_run || draftExists.existing_run_id || ''
                  setDraftId(firstDraft)
                  setRunId(firstRun)
                  if (firstRun) {
                    loadRunTracking(firstRun, firstDraft)
                  }
                  setDraftExists(null)
                  toast({
                    title: 'Rascunho carregado',
                    description: `${existing.length} plantões.`,
                  })
                } catch (err: any) {
                  toast({
                    title: 'Erro',
                    description: err.message || 'Falha ao carregar o rascunho.',
                    variant: 'destructive',
                  })
                }
              }}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Abrir existente
            </Button>
            <Button
              onClick={() => {
                if (!draftExists) return
                const ce = draftExists
                setDraftExists(null)
                handleGenerateDraft(false, true)
                void ce
              }}
              className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Substituir
            </Button>
          </DialogFooter>
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
