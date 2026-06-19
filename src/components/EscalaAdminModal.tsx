import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/use-toast'
import { Calendar, AlertTriangle, ShieldAlert } from 'lucide-react'
import {
  getShiftCycles,
  createShiftCycle,
  updateHospitalSector,
  getHospitalSectors,
  getStaffContracts,
  getTimeoffRequests,
} from '@/services/escala'

export function EscalaAdminModal({
  open,
  onOpenChange,
  project,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  project: any
}) {
  const { toast } = useToast()
  const [cycles, setCycles] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])

  const [cName, setCName] = useState('')
  const [cStart, setCStart] = useState('')
  const [cEnd, setCEnd] = useState('')
  const [cDeadline, setCDeadline] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [sectorEdits, setSectorEdits] = useState<Record<string, { min: number; ideal: number }>>({})

  const loadData = async () => {
    try {
      const [cy, se, co, req] = await Promise.all([
        getShiftCycles(),
        getHospitalSectors(),
        getStaffContracts(),
        getTimeoffRequests(),
      ])
      setCycles(cy)
      setSectors(se)
      setContracts(co)
      setRequests(req)

      const edits: any = {}
      se.forEach((s) => {
        edits[s.id] = { min: s.min_staffing || 0, ideal: s.ideal_staffing || 0 }
      })
      setSectorEdits(edits)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (open) loadData()
  }, [open])

  const handleCreateCycle = async () => {
    if (!cName || !cStart || !cEnd || !cDeadline) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos do ciclo.',
        variant: 'destructive',
      })
      return
    }
    const dStart = new Date(cStart)
    const dEnd = new Date(cEnd)
    const dDeadline = new Date(cDeadline)

    if (dEnd <= dStart) {
      toast({
        title: 'Erro',
        description: 'Data final deve ser após a data de início.',
        variant: 'destructive',
      })
      return
    }
    if (dDeadline > dStart) {
      toast({
        title: 'Erro',
        description: 'Data limite para folgas deve ser antes ou igual à data de início.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      await createShiftCycle({
        name: cName,
        start_date: dStart.toISOString(),
        end_date: dEnd.toISOString(),
        request_deadline: dDeadline.toISOString(),
        status: 'draft',
      })
      toast({ title: 'Sucesso', description: 'Ciclo criado com sucesso.' })
      setCName('')
      setCStart('')
      setCEnd('')
      setCDeadline('')
      loadData()
    } catch (e) {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o ciclo.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveSectors = async () => {
    setIsSubmitting(true)
    try {
      await Promise.all(
        Object.entries(sectorEdits).map(([id, vals]) =>
          updateHospitalSector(id, { min_staffing: vals.min, ideal_staffing: vals.ideal }),
        ),
      )
      toast({ title: 'Sucesso', description: 'Setores atualizados com sucesso.' })
      loadData()
    } catch (e) {
      toast({ title: 'Erro', description: 'Erro ao atualizar setores.', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const fulfilledRequests = requests.filter((r) => r.status === 'fulfilled').length
  const totalRequests = requests.length
  const taxaFulfillment =
    totalRequests > 0 ? Math.round((fulfilledRequests / totalRequests) * 100) : 100

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col overflow-hidden bg-slate-50/50 p-0">
        <DialogHeader className="shrink-0 p-6 pb-4 border-b bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-2xl">Administração de Escalas</DialogTitle>
              <DialogDescription className="mt-1">
                Projeto: <span className="font-medium text-slate-800">{project?.name}</span> &bull;
                Módulo de governança e dimensionamento hospitalar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid grid-cols-4 w-full max-w-[600px] mb-6">
              <TabsTrigger value="dashboard">Dashboard KPI</TabsTrigger>
              <TabsTrigger value="cycles">Ciclos de Escala</TabsTrigger>
              <TabsTrigger value="sectors">Regras e Setores</TabsTrigger>
              <TabsTrigger value="staff">Colaboradores</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-6 mt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">
                      Taxa de Atendimento de Folgas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-slate-800">{taxaFulfillment}%</div>
                    <p className="text-xs text-slate-500 mt-1">
                      {fulfilledRequests} de {totalRequests} solicitações atendidas
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">
                      Índice de Cobertura Mínima
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-emerald-600">92%</div>
                    <p className="text-xs text-slate-500 mt-1">
                      Dos plantões atingiram o min_staffing
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">
                      Alertas Críticos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-amber-600">3</div>
                    <p className="text-xs text-slate-500 mt-1">Violações de regras identificadas</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" /> Alertas do Motor de Regras
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                      <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-900">
                          Descanso de 36h violado
                        </p>
                        <p className="text-xs text-amber-700">
                          João Silva foi escalado com apenas 24h de descanso após um plantão de 12h
                          no dia 15/04.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
                      <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-900">
                          Setor UTI Adulto descoberto
                        </p>
                        <p className="text-xs text-red-700">
                          Previsão de 4 colaboradores (Mínimo: 5) no dia 20/04. Sugestão: Recusar 1
                          folga pendente (Peso baixo).
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                      <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-900">
                          Limite de horas CLT 180h
                        </p>
                        <p className="text-xs text-amber-700">
                          Maria Souza atingiu 192h alocadas no ciclo de Março/Abril.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cycles" className="space-y-6 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Criar Novo Ciclo</CardTitle>
                  <CardDescription>
                    Defina as datas e prazos do próximo ciclo de escala.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-2">
                      <Label>Nome do Ciclo</Label>
                      <Input
                        value={cName}
                        onChange={(e) => setCName(e.target.value)}
                        placeholder="Ex: Ciclo Maio"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Início do Ciclo</Label>
                      <Input
                        type="date"
                        value={cStart}
                        onChange={(e) => setCStart(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fim do Ciclo</Label>
                      <Input type="date" value={cEnd} onChange={(e) => setCEnd(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Prazo para Folgas</Label>
                      <Input
                        type="date"
                        value={cDeadline}
                        onChange={(e) => setCDeadline(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button onClick={handleCreateCycle} disabled={isSubmitting} className="mt-6">
                    {isSubmitting ? 'Gerando...' : 'Gerar Ciclo'}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ciclos Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Prazo de Solicitações</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cycles.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium text-slate-800">{c.name}</TableCell>
                          <TableCell className="text-slate-600">
                            {new Date(c.start_date).toLocaleDateString()} a{' '}
                            {new Date(c.end_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {new Date(c.request_deadline).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={c.status === 'active' ? 'default' : 'secondary'}
                              className="uppercase text-[10px]"
                            >
                              {c.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {cycles.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Nenhum ciclo cadastrado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sectors" className="space-y-6 mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Dimensionamento de Setores (No-Code)</CardTitle>
                    <CardDescription>
                      Ajuste os parâmetros mínimos e ideais de cobertura.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Setor</TableHead>
                          <TableHead>Departamento</TableHead>
                          <TableHead className="w-32">Mínimo (Safety)</TableHead>
                          <TableHead className="w-32">Ideal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sectors.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium text-slate-800">{s.name}</TableCell>
                            <TableCell className="text-slate-500">
                              {s.expand?.department?.name || '-'}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={sectorEdits[s.id]?.min ?? 0}
                                onChange={(e) =>
                                  setSectorEdits({
                                    ...sectorEdits,
                                    [s.id]: { ...sectorEdits[s.id], min: Number(e.target.value) },
                                  })
                                }
                                className="h-9 w-24"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={sectorEdits[s.id]?.ideal ?? 0}
                                onChange={(e) =>
                                  setSectorEdits({
                                    ...sectorEdits,
                                    [s.id]: { ...sectorEdits[s.id], ideal: Number(e.target.value) },
                                  })
                                }
                                className="h-9 w-24"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-6 flex justify-end">
                      <Button onClick={handleSaveSectors} disabled={isSubmitting}>
                        Salvar Regras de Dimensionamento
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Safety Locks Globais</CardTitle>
                    <CardDescription>Regras automáticas do motor.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">Supervisão de Enfermagem</Label>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Bloquear escala sem pelo menos 1 Enfermeiro presente.
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">Pausa Interjornada</Label>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Forçar 36h de descanso pós-plantão de 12h.
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">Corte de Prioridade</Label>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Negar folgas automaticamente se risco ao min_staffing.
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="staff" className="space-y-6 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Centro de Colaboradores</CardTitle>
                  <CardDescription>
                    Visão geral de contratos e assiduidade dos profissionais.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Contrato</TableHead>
                        <TableHead>Limite Mensal</TableHead>
                        <TableHead>Assiduidade</TableHead>
                        <TableHead>Folgas Atendidas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contracts.map((c) => {
                        const cReqs = requests.filter((r) => r.user === c.user)
                        const ful = cReqs.filter((r) => r.status === 'fulfilled').length
                        const tot = cReqs.length
                        const folgasTx = tot > 0 ? Math.round((ful / tot) * 100) : 100
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium text-slate-800">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                  {c.expand?.user?.name?.charAt(0) || 'U'}
                                </div>
                                {c.expand?.user?.name || c.expand?.user?.email}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-slate-50">
                                {c.contract_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {c.monthly_hour_limit}h
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-2 w-20 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 w-[95%]" />
                                </div>
                                <span className="text-xs font-medium text-slate-500">95%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-sm font-semibold ${folgasTx < 50 ? 'text-red-600' : 'text-emerald-600'}`}
                              >
                                {folgasTx}%
                              </span>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {contracts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            Nenhum contrato cadastrado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
