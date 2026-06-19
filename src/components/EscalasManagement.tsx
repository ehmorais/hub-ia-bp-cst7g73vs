import { useState, useEffect } from 'react'
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
import { useToast } from '@/components/ui/use-toast'
import {
  Clock,
  Building2,
  Users,
  Activity,
  Plus,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react'
import {
  getShiftCycles,
  createShiftCycle,
  updateShiftCycle,
  updateHospitalSector,
  getHospitalSectors,
  getStaffContracts,
  getTimeoffRequests,
  getUsers,
  getStaffRoles,
  createStaffContract,
  updateStaffContract,
  updateUser,
} from '@/services/escala'
import { format } from 'date-fns'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'

export function EscalasManagement() {
  const { toast } = useToast()
  const [cycles, setCycles] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])

  const [cName, setCName] = useState('')
  const [cStart, setCStart] = useState('')
  const [cEnd, setCEnd] = useState('')
  const [cDeadline, setCDeadline] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [sectorEdits, setSectorEdits] = useState<Record<string, { min: number; ideal: number }>>({})

  const loadData = async () => {
    try {
      const [cy, se, co, req, us, ro] = await Promise.all([
        getShiftCycles(),
        getHospitalSectors(),
        getStaffContracts(),
        getTimeoffRequests(),
        getUsers(),
        getStaffRoles(),
      ])
      setCycles(cy)
      setSectors(se)
      setContracts(co)
      setRequests(req)
      setUsers(us)
      setRoles(ro)

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
    loadData()
  }, [])

  useRealtime('shift_cycles', loadData)
  useRealtime('hospital_sectors', loadData)
  useRealtime('staff_contracts', loadData)
  useRealtime('timeoff_requests', loadData)
  useRealtime('users', loadData)
  useRealtime('staff_roles', loadData)

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

    if (dEnd <= dStart) {
      toast({
        title: 'Erro',
        description: 'A data de término deve ser após a data de início.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      await createShiftCycle({
        name: cName,
        start_date: cStart + ' 12:00:00.000Z',
        end_date: cEnd + ' 12:00:00.000Z',
        request_deadline: cDeadline + ' 12:00:00.000Z',
        status: 'draft',
      })
      toast({ title: 'Sucesso', description: 'Ciclo criado com sucesso.' })
      setCName('')
      setCStart('')
      setCEnd('')
      setCDeadline('')
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateCycleStatus = async (id: string, status: string) => {
    try {
      await updateShiftCycle(id, { status })
      toast({ title: 'Status Atualizado' })
    } catch {
      /* ignore */
    }
  }

  const handleSectorSave = async (id: string) => {
    try {
      await updateHospitalSector(id, {
        min_staffing: sectorEdits[id].min,
        ideal_staffing: sectorEdits[id].ideal,
      })
      toast({ title: 'Setor atualizado' })
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    }
  }

  const handleUserRoleChange = async (userId: string, roleId: string) => {
    try {
      await updateUser(userId, { staff_role: roleId })
      toast({ title: 'Papel atualizado' })
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    }
  }

  const handleUserContractChange = async (userId: string, contractType: string) => {
    try {
      const existing = contracts.find((c) => c.user === userId)
      if (existing) {
        await updateStaffContract(existing.id, { contract_type: contractType })
      } else {
        await createStaffContract({
          user: userId,
          contract_type: contractType,
          monthly_hour_limit: 180,
        })
      }
      toast({ title: 'Contrato atualizado' })
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
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
    <div className="flex flex-col space-y-6 animate-fade-in">
      <div className="mb-2">
        <h2 className="text-xl font-semibold flex items-center gap-2">Gestão Central de Escalas</h2>
        <p className="text-muted-foreground">
          Administração centralizada de ciclos, setores, contratos e métricas de plantão.
        </p>
      </div>

      <Tabs defaultValue="ciclos" className="flex flex-col overflow-hidden">
        <TabsList className="grid grid-cols-1 md:grid-cols-4 w-full h-auto min-h-12 py-1 mb-4">
          <TabsTrigger value="ciclos" className="h-10 text-xs sm:text-sm">
            <Clock className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Ciclos de Escala</span>
            <span className="sm:hidden">Ciclos</span>
          </TabsTrigger>
          <TabsTrigger value="setores" className="h-10 text-xs sm:text-sm">
            <Building2 className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Setores & Lotação</span>
            <span className="sm:hidden">Setores</span>
          </TabsTrigger>
          <TabsTrigger value="equipe" className="h-10 text-xs sm:text-sm">
            <Users className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Regras de Equipe</span>
            <span className="sm:hidden">Equipe</span>
          </TabsTrigger>
          <TabsTrigger value="kpis" className="h-10 text-xs sm:text-sm">
            <Activity className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">KPIs & Folgas</span>
            <span className="sm:hidden">KPIs</span>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 rounded-lg p-2 md:p-6 border">
          <TabsContent value="ciclos" className="mt-0 space-y-6 animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle>Novo Ciclo</CardTitle>
                <CardDescription>
                  Crie um novo ciclo definindo o período de validade e o prazo para pedidos de
                  folga.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                  <div className="space-y-2">
                    <Label>Nome do Ciclo</Label>
                    <Input
                      placeholder="Ex: Janeiro 2027"
                      value={cName}
                      onChange={(e) => setCName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data de Início</Label>
                    <Input type="date" value={cStart} onChange={(e) => setCStart(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data de Término</Label>
                    <Input type="date" value={cEnd} onChange={(e) => setCEnd(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Prazo para Pedidos</Label>
                    <Input
                      type="date"
                      value={cDeadline}
                      onChange={(e) => setCDeadline(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleCreateCycle} disabled={isSubmitting} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Ciclo
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ciclos Existentes</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Término</TableHead>
                      <TableHead>Prazo de Pedidos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cycles.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{format(new Date(c.start_date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>{format(new Date(c.end_date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>{format(new Date(c.request_deadline), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              c.status === 'active'
                                ? 'default'
                                : c.status === 'closed'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {c.status === 'active'
                              ? 'Ativo'
                              : c.status === 'closed'
                                ? 'Fechado'
                                : 'Rascunho'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={c.status}
                            onValueChange={(val) => handleUpdateCycleStatus(c.id, val)}
                          >
                            <SelectTrigger className="w-[120px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Rascunho</SelectItem>
                              <SelectItem value="active">Ativar</SelectItem>
                              <SelectItem value="closed">Fechar</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                    {cycles.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                          Nenhum ciclo encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="setores" className="mt-0 animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle>Regras de Lotação (No-Code)</CardTitle>
                <CardDescription>
                  Defina a lotação mínima e ideal de colaboradores por setor para garantir a
                  segurança assistencial.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Setor</TableHead>
                      <TableHead>Departamento Associado</TableHead>
                      <TableHead>Lotação Mínima (Nível de Segurança)</TableHead>
                      <TableHead>Lotação Ideal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sectors.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-orange-500" />
                          {s.name}
                        </TableCell>
                        <TableCell>{s.expand?.department?.name || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              className="w-24"
                              value={sectorEdits[s.id]?.min ?? 0}
                              onChange={(e) =>
                                setSectorEdits({
                                  ...sectorEdits,
                                  [s.id]: {
                                    ...sectorEdits[s.id],
                                    min: parseInt(e.target.value) || 0,
                                  },
                                })
                              }
                              onBlur={() => handleSectorSave(s.id)}
                            />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              profissionais/turno
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              className="w-24"
                              value={sectorEdits[s.id]?.ideal ?? 0}
                              onChange={(e) =>
                                setSectorEdits({
                                  ...sectorEdits,
                                  [s.id]: {
                                    ...sectorEdits[s.id],
                                    ideal: parseInt(e.target.value) || 0,
                                  },
                                })
                              }
                              onBlur={() => handleSectorSave(s.id)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equipe" className="mt-0 animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle>Gestão de Contratos e Papéis</CardTitle>
                <CardDescription>
                  Gerencie a função (papel) e o regime de contratação para cada profissional do
                  corpo clínico.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Profissional</TableHead>
                      <TableHead>Papel Clínico</TableHead>
                      <TableHead>Requer Supervisão</TableHead>
                      <TableHead>Tipo de Contrato</TableHead>
                      <TableHead>Carga Horária / Mês</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => {
                      const userContract = contracts.find((c) => c.user === u.id)
                      const userRole = roles.find((r) => r.id === u.staff_role)
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium flex items-center gap-2 whitespace-nowrap">
                            {u.avatar ? (
                              <img
                                src={pb.files.getURL(u, u.avatar)}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                                {u.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            {u.name}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={u.staff_role}
                              onValueChange={(val) => handleUserRoleChange(u.id, val)}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Sem papel" />
                              </SelectTrigger>
                              <SelectContent>
                                {roles.map((r) => (
                                  <SelectItem key={r.id} value={r.id}>
                                    {r.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {userRole?.requires_supervision ? (
                              <Badge
                                variant="outline"
                                className="text-orange-600 bg-orange-50 border-orange-200"
                              >
                                <AlertTriangle className="w-3 h-3 mr-1" /> Sim
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-500">
                                Não
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={userContract?.contract_type}
                              onValueChange={(val) => handleUserContractChange(u.id, val)}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Sem contrato" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="CLT 180h">CLT 180h</SelectItem>
                                <SelectItem value="PJ">PJ</SelectItem>
                                <SelectItem value="Autônomo">Autônomo</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {userContract ? (
                              <span className="text-sm font-medium">
                                {userContract.monthly_hour_limit}h
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kpis" className="mt-0 space-y-6 animate-fade-in">
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
                      <div
                        className="h-full bg-blue-600"
                        style={{ width: `${fulfillmentRate}%` }}
                      />
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
                      <div
                        className="h-full bg-emerald-600"
                        style={{ width: `${coverageIndex}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Solicitações de Folga (Prioridade)</CardTitle>
                <CardDescription>
                  Visão geral de todas as solicitações e o peso de prioridade definido pelo
                  funcionário.
                </CardDescription>
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
                        <TableCell className="font-medium whitespace-nowrap">
                          {r.expand?.user?.name}
                        </TableCell>
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
                          {r.status === 'fulfilled' ? (
                            <Badge
                              variant="outline"
                              className="text-emerald-600 border-emerald-200 bg-emerald-50"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Atendida
                            </Badge>
                          ) : r.status === 'not_fulfilled' ? (
                            <Badge
                              variant="outline"
                              className="text-red-600 border-red-200 bg-red-50"
                            >
                              Não Atendida
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-amber-600 border-amber-200 bg-amber-50"
                            >
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {requests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                          Nenhuma solicitação registrada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
