import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { UserManagement } from '@/components/UserManagement'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Search,
  Download,
  Plus,
  ShieldCheck,
  Settings2,
  Users,
  Building2,
  Trash2,
  Activity,
  ChevronsUpDown,
  Check,
  X,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import pb from '@/lib/pocketbase/client'
import {
  getAuditLogs,
  getIaTools,
  getUsers,
  createIaTool,
  updateIaTool,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getProjects,
  createProject,
  updateProject,
  deleteProject,
} from '@/services/admin'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { useRealtime } from '@/hooks/use-realtime'
import { cn } from '@/lib/utils'
import { getIcon } from '@/lib/icons'
import { EscalasManagement } from '@/components/EscalasManagement'
import { useLocation } from 'react-router-dom'

const ICONS_LIST = [
  'Building2',
  'Users',
  'Activity',
  'ShieldCheck',
  'Stethoscope',
  'HeartPulse',
  'Microscope',
  'Briefcase',
  'Folder',
  'Settings',
  'Database',
  'Globe',
  'Zap',
  'Lightbulb',
]

export default function Admin() {
  const location = useLocation()
  const { user } = useAuth()

  if (user?.role !== 'Admin') {
    return (
      <div className="p-8 text-center text-red-500">Acesso negado. Apenas administradores.</div>
    )
  }

  if (location.hash === '#users') {
    return <UserManagement />
  }

  return (
    <div className="relative h-full w-full">
      <AdminContent />
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => (window.location.hash = '#users')}
          className="shadow-lg rounded-full px-6 h-12"
        >
          <Users className="w-5 h-5 mr-2" />
          Gerenciar Usuários
        </Button>
      </div>
    </div>
  )
}

function AdminContent() {
  const location = useLocation()
  const { toast } = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'

  const [logs, setLogs] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [tools, setTools] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])

  const [toolName, setToolName] = useState('')
  const [toolModel, setToolModel] = useState('fast')
  const [toolDesc, setToolDesc] = useState('')
  const [toolStatus, setToolStatus] = useState('active')
  const [toolDeps, setToolDeps] = useState<string[]>([])
  const [openToolDeps, setOpenToolDeps] = useState(false)
  const [editingTool, setEditingTool] = useState<any>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [depName, setDepName] = useState('')
  const [depDesc, setDepDesc] = useState('')
  const [depSortOrder, setDepSortOrder] = useState(0)
  const [depIcon, setDepIcon] = useState('Folder')
  const [depColor, setDepColor] = useState('#0f172a')
  const [isSubmittingDep, setIsSubmittingDep] = useState(false)
  const [editingDep, setEditingDep] = useState<any>(null)

  const [projName, setProjName] = useState('')
  const [projDesc, setProjDesc] = useState('')
  const [projDeps, setProjDeps] = useState<string[]>([])
  const [projSort, setProjSort] = useState(0)
  const [projStatus, setProjStatus] = useState('active')
  const [projMembers, setProjMembers] = useState<string[]>([])
  const [editingProj, setEditingProj] = useState<any>(null)
  const [isSubmittingProj, setIsSubmittingProj] = useState(false)
  const [openProjDeps, setOpenProjDeps] = useState(false)

  const [activeTab, setActiveTab] = useState(
    location.hash === '#escalas' ? 'escalas' : 'performance',
  )

  useEffect(() => {
    if (location.hash === '#escalas') {
      setActiveTab('escalas')
    } else if (location.pathname === '/admin' && !location.hash) {
      if (activeTab === 'escalas') setActiveTab('performance')
    }
  }, [location.hash, location.pathname])

  const loadLogs = async () => {
    try {
      setLogs(await getAuditLogs())
    } catch (e) {
      console.error(e)
    }
  }
  const loadUsers = async () => {
    try {
      setUsers(await getUsers())
    } catch (e) {
      console.error(e)
    }
  }
  const loadTools = async () => {
    try {
      setTools(await getIaTools())
    } catch (e) {
      console.error(e)
    }
  }
  const loadDepartments = async () => {
    try {
      setDepartments(await getDepartments())
    } catch (e) {
      console.error(e)
    }
  }
  const loadProjects = async () => {
    try {
      setProjects(await getProjects())
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadLogs()
    loadUsers()
    loadTools()
    loadDepartments()
    loadProjects()
  }, [])

  useRealtime('audit_logs', () => {
    loadLogs()
  })
  useRealtime('users', () => {
    loadUsers()
  })
  useRealtime('ia_tools', () => {
    loadTools()
  })
  useRealtime('departments', () => {
    loadDepartments()
  })
  useRealtime('projects', () => {
    loadProjects()
  })

  const handleExportCSV = () => {
    const header = ['Projeto', 'Status', 'Departamento', 'Membros'].join(',')
    const rows = projects.map((p) => {
      const depNames =
        p.expand?.associated_departments?.map((d: any) => d.name).join(' | ') ||
        p.expand?.department?.name ||
        '-'
      const members = (p.expand?.members || []).map((m: any) => m.name || m.email).join(' | ')
      return `"${p.name}","${p.status}","${depNames}","${members}"`
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'relatorio_projetos.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSaveDep = async () => {
    setIsSubmittingDep(true)
    try {
      if (editingDep) {
        await updateDepartment(
          editingDep.id,
          {
            name: depName,
            description: depDesc,
            sort_order: depSortOrder,
            icon: depIcon,
            color: depColor,
          },
          user?.id,
        )
        toast({ title: 'Sucesso', description: 'Departamento atualizado com sucesso.' })
      } else {
        await createDepartment(
          {
            name: depName,
            description: depDesc,
            sort_order: depSortOrder,
            icon: depIcon,
            color: depColor,
          },
          user?.id,
        )
        toast({ title: 'Sucesso', description: 'Departamento criado com sucesso.' })
      }
      handleCancelEditDep()
    } catch (err) {
      toast({ title: 'Erro', description: 'Erro ao salvar departamento.', variant: 'destructive' })
    } finally {
      setIsSubmittingDep(false)
    }
  }

  const handleEditDep = (dep: any) => {
    setEditingDep(dep)
    setDepName(dep.name)
    setDepDesc(dep.description || '')
    setDepSortOrder(dep.sort_order || 0)
    setDepIcon(dep.icon || 'Folder')
    setDepColor(dep.color || '#0f172a')
  }

  const handleCancelEditDep = () => {
    setEditingDep(null)
    setDepName('')
    setDepDesc('')
    setDepSortOrder(0)
    setDepIcon('Folder')
    setDepColor('#0f172a')
  }

  const handleSaveProj = async () => {
    setIsSubmittingProj(true)
    try {
      if (editingProj) {
        await updateProject(
          editingProj.id,
          {
            name: projName,
            description: projDesc,
            department: projDeps[0] || null,
            associated_departments: projDeps,
            sort_order: projSort,
            status: projStatus,
            members: projMembers,
          },
          user?.id,
          'Múltiplos',
        )
        toast({ title: 'Sucesso', description: 'Projeto atualizado com sucesso.' })
      } else {
        await createProject(
          {
            name: projName,
            description: projDesc,
            department: projDeps[0] || null,
            associated_departments: projDeps,
            sort_order: projSort,
            status: projStatus,
            members: projMembers,
          },
          user?.id,
          'Múltiplos',
        )
        toast({ title: 'Sucesso', description: 'Projeto criado com sucesso.' })
      }
      handleCancelEditProj()
    } catch (err) {
      toast({ title: 'Erro', description: 'Erro ao salvar projeto.', variant: 'destructive' })
    } finally {
      setIsSubmittingProj(false)
    }
  }

  const handleEditProj = (proj: any) => {
    setEditingProj(proj)
    setProjName(proj.name)
    setProjDesc(proj.description || '')
    setProjDeps(proj.associated_departments || (proj.department ? [proj.department] : []))
    setProjSort(proj.sort_order || 0)
    setProjStatus(proj.status || 'active')
    setProjMembers(proj.members || [])
  }

  const handleCancelEditProj = () => {
    setEditingProj(null)
    setProjName('')
    setProjDesc('')
    setProjDeps([])
    setProjSort(0)
    setProjStatus('active')
    setProjMembers([])
  }

  const handleDeleteProj = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este projeto?')) {
      try {
        const p = projects.find((x) => x.id === id)
        const depNameStr = departments.find((d) => d.id === p?.department)?.name || 'Desconhecido'
        await deleteProject(id, p?.name || '', user?.id, depNameStr)
        toast({ title: 'Sucesso', description: 'Projeto removido.' })
      } catch (err) {
        toast({ title: 'Erro', description: 'Erro ao remover projeto.', variant: 'destructive' })
      }
    }
  }

  const handleDeleteDep = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este departamento?')) {
      try {
        const d = departments.find((x) => x.id === id)
        await deleteDepartment(id, d?.name || '', user?.id)
        toast({ title: 'Sucesso', description: 'Departamento removido.' })
      } catch (err) {
        toast({ title: 'Erro', description: 'Erro ao remover.', variant: 'destructive' })
      }
    }
  }

  const handleSaveTool = async () => {
    setFieldErrors({})
    setIsSubmitting(true)
    try {
      const payload = {
        name: toolName,
        model_alias: toolModel,
        description: toolDesc,
        status: toolStatus,
        version: 'v1.0.0',
        associated_departments: toolDeps,
      }
      if (editingTool) {
        await updateIaTool(editingTool.id, payload)
        toast({ title: 'Sucesso', description: 'Ferramenta IA atualizada com sucesso.' })
      } else {
        await createIaTool(payload)
        toast({ title: 'Sucesso', description: 'Ferramenta IA configurada com sucesso.' })
      }
      handleCancelEditTool()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast({
        title: 'Erro',
        description: 'Verifique os campos e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditTool = (tool: any) => {
    setEditingTool(tool)
    setToolName(tool.name)
    setToolModel(tool.model_alias || 'fast')
    setToolDesc(tool.description || '')
    setToolStatus(tool.status || 'active')
    setToolDeps(tool.associated_departments || [])
  }

  const handleCancelEditTool = () => {
    setEditingTool(null)
    setToolName('')
    setToolModel('fast')
    setToolDesc('')
    setToolStatus('active')
    setToolDeps([])
    setFieldErrors({})
  }

  const handleDeleteTool = async (id: string) => {
    if (confirm('Tem certeza que deseja remover esta ferramenta?')) {
      try {
        await pb.collection('ia_tools').delete(id)
        toast({ title: 'Sucesso', description: 'Ferramenta removida.' })
      } catch (err) {
        toast({ title: 'Erro', description: 'Erro ao remover.', variant: 'destructive' })
      }
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-[1400px] animate-fade-in">
      <div className="flex flex-col gap-2 mb-2">
        <h1 className="text-4xl font-bold tracking-tight text-primary flex items-center gap-3">
          <ShieldCheck className="h-9 w-9 text-primary" />
          Painel de Administração
        </h1>
        <p className="text-muted-foreground text-lg max-w-3xl">
          Governança, controle de acessos e auditoria de modelos de IA da BP.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap w-full justify-start max-w-6xl mb-8 h-auto p-1.5 gap-1 bg-white/60 backdrop-blur-md border border-slate-200/60 shadow-sm rounded-2xl">
          <TabsTrigger
            value="performance"
            className="rounded-xl px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
          >
            Performance
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="rounded-xl px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
          >
            Auditoria
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="rounded-xl px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
          >
            Usuários
          </TabsTrigger>
          <TabsTrigger
            value="ia_tools"
            className="rounded-xl px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
          >
            Ferramentas IA
          </TabsTrigger>
          <TabsTrigger
            value="departments"
            className="rounded-xl px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
          >
            Departamentos
          </TabsTrigger>
          <TabsTrigger
            value="projects"
            className="rounded-xl px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
          >
            Projetos
          </TabsTrigger>
          <TabsTrigger
            value="escalas"
            className="rounded-xl px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
          >
            Gestão de Escalas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-primary">
              <Activity className="h-5 w-5" /> Performance Dashboard
            </h2>
            <Button onClick={handleExportCSV} className="gap-2 shadow-sm">
              <Download className="h-4 w-4" /> Exportar Relatório (CSV)
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map((dep) => {
              const depProjs = projects.filter(
                (p) => p.associated_departments?.includes(dep.id) || p.department === dep.id,
              )
              const total = depProjs.length
              const active = depProjs.filter((p) => p.status === 'active').length
              const activePercent = total > 0 ? Math.round((active / total) * 100) : 0
              const depColorHex = dep.color || 'hsl(var(--primary))'

              return (
                <Card
                  key={dep.id}
                  className="shadow-soft border-slate-200/60 transition-all hover:shadow-elevation"
                >
                  <CardHeader className="pb-2">
                    <CardTitle
                      className="text-lg flex items-center gap-3"
                      style={{ color: dep.color || 'inherit' }}
                    >
                      <div
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 shadow-sm flex items-center justify-center"
                        style={{ color: dep.color || 'inherit' }}
                      >
                        {(() => {
                          const Icon = getIcon(dep.icon)
                          return <Icon className="h-5 w-5" />
                        })()}
                      </div>
                      {dep.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 mt-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Projetos Totais</span>
                        <span className="font-semibold">{total}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Projetos Ativos</span>
                        <span className="font-semibold text-primary">
                          {active} ({activePercent}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{ width: `${activePercent}%`, backgroundColor: depColorHex }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
            {departments.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-8">
                Nenhum departamento cadastrado.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="departments" className="space-y-6">
          <div className={`grid gap-6 ${isAdmin ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
            {isAdmin && (
              <Card className="lg:col-span-1 h-fit shadow-soft border-slate-200/60">
                <CardHeader className="border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-5 w-5" />{' '}
                    {editingDep ? 'Editar Departamento' : 'Novo Departamento'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-2">
                    <Label>Nome do Departamento</Label>
                    <Input
                      value={depName}
                      onChange={(e) => setDepName(e.target.value)}
                      placeholder="Ex: Recursos Humanos"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input
                      value={depDesc}
                      onChange={(e) => setDepDesc(e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ordem de Exibição</Label>
                    <Input
                      type="number"
                      value={depSortOrder}
                      onChange={(e) => setDepSortOrder(Number(e.target.value))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label>Ícone</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start gap-2 h-10">
                            {(() => {
                              const Icon = getIcon(depIcon)
                              return <Icon className="h-4 w-4" />
                            })()}
                            {depIcon || 'Selecionar Ícone'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2">
                          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                            {ICONS_LIST.map((icon) => {
                              const Icon = getIcon(icon)
                              return (
                                <Button
                                  key={icon}
                                  type="button"
                                  variant={depIcon === icon ? 'default' : 'ghost'}
                                  size="icon"
                                  onClick={() => setDepIcon(icon)}
                                >
                                  <Icon className="h-4 w-4" />
                                </Button>
                              )
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Cor de Identificação</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="color"
                          value={depColor}
                          onChange={(e) => setDepColor(e.target.value)}
                          className="h-10 w-20 p-1 cursor-pointer"
                        />
                        <span className="text-sm text-muted-foreground uppercase">{depColor}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <Button
                      onClick={handleSaveDep}
                      disabled={isSubmittingDep || !depName}
                      className="w-full"
                    >
                      {isSubmittingDep
                        ? 'Salvando...'
                        : editingDep
                          ? 'Salvar Alterações'
                          : 'Criar Departamento'}
                    </Button>
                    {editingDep && (
                      <Button variant="outline" onClick={handleCancelEditDep} className="w-full">
                        Cancelar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card
              className={cn(
                isAdmin ? 'lg:col-span-2' : '',
                'shadow-soft border-slate-200/60 overflow-hidden',
              )}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Ícone & Cor</TableHead>
                    <TableHead>Ordem</TableHead>
                    {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((dep) => (
                    <TableRow key={dep.id}>
                      <TableCell className="font-semibold text-slate-800">
                        {dep.name}
                        {dep.description && (
                          <p className="text-xs text-slate-500 font-normal mt-0.5">
                            {dep.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="p-1.5 rounded bg-slate-100 flex items-center justify-center"
                            style={{ color: dep.color || 'inherit' }}
                          >
                            {(() => {
                              const Icon = getIcon(dep.icon)
                              return <Icon className="h-4 w-4" />
                            })()}
                          </div>
                          <span className="text-xs text-slate-500 uppercase">
                            {dep.color || '#000'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500">{dep.sort_order || 0}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditDep(dep)}>
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteDep(dep.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {departments.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={isAdmin ? 4 : 3}
                        className="text-center text-muted-foreground py-8"
                      >
                        Nenhum departamento cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-slate-200/60 shadow-soft mb-4">
            <div className="flex items-center gap-4 w-full max-w-lg">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por usuário, ação ou ID..." className="pl-8" />
              </div>
              <Select defaultValue="today">
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Últimos 7 dias</SelectItem>
                  <SelectItem value="month">Últimos 30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="shadow-soft border-slate-200/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Detalhes</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="font-medium text-sm text-slate-600">
                    <TableCell className="font-mono text-xs">{log.id.slice(0, 8)}</TableCell>
                    <TableCell>{new Date(log.created).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-slate-900">
                          {log.expand?.user?.name || log.expand?.user?.email || 'Sistema'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {log.expand?.user?.role || 'Usuário'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={log.details}>
                      {log.details || '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-primary">
                      {log.token_usage || 0}
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum registro de auditoria encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-primary">
              <Users className="h-5 w-5" /> Gestão de Acessos
            </h2>
            {isAdmin && (
              <Button className="gap-2 shadow-sm">
                <Plus className="h-4 w-4" /> Adicionar Usuário
              </Button>
            )}
          </div>
          <Card className="shadow-soft border-slate-200/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Nível de Acesso</TableHead>
                  {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-semibold text-slate-800">
                      {u.name || 'Sem nome'}
                    </TableCell>
                    <TableCell className="text-slate-500">{u.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          u.role === 'Admin'
                            ? 'border-red-200 text-red-700 bg-red-50'
                            : 'border-slate-200 text-slate-700 bg-slate-50',
                        )}
                      >
                        {u.role || 'Operador'}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          Editar
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="ia_tools" className="space-y-6">
          <div className={`grid gap-6 ${isAdmin ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
            {isAdmin && (
              <Card className="h-fit shadow-soft border-slate-200/60">
                <CardHeader className="border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings2 className="h-5 w-5" />{' '}
                    {editingTool ? 'Editar Ferramenta IA' : 'Nova Ferramenta IA'}
                  </CardTitle>
                  <CardDescription>Defina os parâmetros e associções do modelo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-2">
                    <Label>Nome da Ferramenta</Label>
                    <Input
                      value={toolName}
                      onChange={(e) => setToolName(e.target.value)}
                      placeholder="Ex: Análise de Prontuários"
                    />
                    {fieldErrors.name && <p className="text-sm text-red-500">{fieldErrors.name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Departamentos Associados</Label>
                    <Popover open={openToolDeps} onOpenChange={setOpenToolDeps}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openToolDeps}
                          className="w-full justify-between"
                        >
                          {toolDeps.length > 0
                            ? `${toolDeps.length} departamento(s) selecionado(s)`
                            : 'Selecione os departamentos...'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar departamento..." />
                          <CommandList>
                            <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                            <CommandGroup>
                              {departments.map((d) => (
                                <CommandItem
                                  key={d.id}
                                  value={d.name}
                                  onSelect={() => {
                                    setToolDeps(
                                      toolDeps.includes(d.id)
                                        ? toolDeps.filter((id) => id !== d.id)
                                        : [...toolDeps, d.id],
                                    )
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      toolDeps.includes(d.id) ? 'opacity-100' : 'opacity-0',
                                    )}
                                  />
                                  {d.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {toolDeps.map((id) => {
                        const d = departments.find((x) => x.id === id)
                        if (!d) return null
                        return (
                          <Badge
                            key={d.id}
                            variant="secondary"
                            className="flex items-center gap-1 pr-1 py-1"
                          >
                            {d.name}
                            <div
                              role="button"
                              tabIndex={0}
                              className="ml-1 rounded-full hover:bg-muted p-0.5 cursor-pointer"
                              onClick={() => setToolDeps(toolDeps.filter((x) => x !== d.id))}
                            >
                              <X className="h-3 w-3" />
                            </div>
                          </Badge>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Modelo Base</Label>
                      <Select value={toolModel} onValueChange={setToolModel}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fast">Fast</SelectItem>
                          <SelectItem value="reasoning">Reasoning</SelectItem>
                          <SelectItem value="embedding">Embedding</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={toolStatus} onValueChange={setToolStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="draft">Rascunho</SelectItem>
                          <SelectItem value="archived">Arquivado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>System Prompt / Descrição</Label>
                    <textarea
                      value={toolDesc}
                      onChange={(e) => setToolDesc(e.target.value)}
                      className="w-full min-h-[100px] p-3 text-sm border rounded-md focus:ring-1 focus:ring-primary focus:outline-none bg-slate-50 font-mono text-slate-600"
                      placeholder="Descrição e instruções do assistente..."
                    />
                  </div>
                  <div className="flex flex-col gap-2 pt-2">
                    <Button
                      onClick={handleSaveTool}
                      disabled={isSubmitting || !toolName}
                      className="w-full"
                    >
                      {isSubmitting
                        ? 'Salvando...'
                        : editingTool
                          ? 'Salvar Alterações'
                          : 'Salvar e Homologar'}
                    </Button>
                    {editingTool && (
                      <Button variant="outline" onClick={handleCancelEditTool} className="w-full">
                        Cancelar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Ferramentas Cadastradas</h3>
              <div className="flex flex-col gap-3">
                {tools.map((tool) => (
                  <Card
                    key={tool.id}
                    className="p-4 flex items-center justify-between shadow-sm border-slate-200/60"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800 truncate">{tool.name}</p>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] uppercase h-5 px-1.5',
                            tool.status === 'active'
                              ? 'text-primary border-primary/20 bg-primary/10'
                              : 'text-amber-600 border-amber-200 bg-amber-50',
                          )}
                        >
                          {tool.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-1 mb-2">
                        Modelo: {tool.model_alias} | Versão: {tool.version || 'N/A'}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {tool.associated_departments?.length > 0 ? (
                          tool.associated_departments.map((depId: string) => {
                            const d = departments.find((x) => x.id === depId)
                            return d ? (
                              <Badge key={depId} variant="secondary" className="text-[10px] px-1.5">
                                {d.name}
                              </Badge>
                            ) : null
                          })
                        ) : (
                          <span className="text-xs text-slate-400">Sem departamentos</span>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => handleEditTool(tool)}>
                          <Settings2 className="h-4 w-4 text-slate-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTool(tool.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
                {tools.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4 border rounded-md bg-slate-50">
                    Nenhuma ferramenta cadastrada.
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="projects" className="space-y-6">
          <div className={`grid gap-6 ${isAdmin ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
            {isAdmin && (
              <Card className="lg:col-span-1 h-fit shadow-soft border-slate-200/60">
                <CardHeader className="border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-5 w-5" />{' '}
                    {editingProj ? 'Editar Projeto' : 'Novo Projeto'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-2">
                    <Label>Nome do Projeto</Label>
                    <Input
                      value={projName}
                      onChange={(e) => setProjName(e.target.value)}
                      placeholder="Ex: Recrutamento AI"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input
                      value={projDesc}
                      onChange={(e) => setProjDesc(e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Departamentos Associados</Label>
                    <Popover open={openProjDeps} onOpenChange={setOpenProjDeps}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openProjDeps}
                          className="w-full justify-between"
                        >
                          {projDeps.length > 0
                            ? `${projDeps.length} departamento(s) selecionado(s)`
                            : 'Selecione os departamentos...'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar departamento..." />
                          <CommandList>
                            <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                            <CommandGroup>
                              {departments.map((d) => (
                                <CommandItem
                                  key={d.id}
                                  value={d.name}
                                  onSelect={() => {
                                    setProjDeps(
                                      projDeps.includes(d.id)
                                        ? projDeps.filter((id) => id !== d.id)
                                        : [...projDeps, d.id],
                                    )
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      projDeps.includes(d.id) ? 'opacity-100' : 'opacity-0',
                                    )}
                                  />
                                  {d.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {projDeps.map((id) => {
                        const d = departments.find((x) => x.id === id)
                        if (!d) return null
                        return (
                          <Badge
                            key={d.id}
                            variant="secondary"
                            className="flex items-center gap-1 pr-1 py-1"
                          >
                            {d.name}
                            <div
                              role="button"
                              tabIndex={0}
                              className="ml-1 rounded-full hover:bg-muted p-0.5 cursor-pointer"
                              onClick={() => setProjDeps(projDeps.filter((x) => x !== d.id))}
                            >
                              <X className="h-3 w-3" />
                            </div>
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ordem</Label>
                      <Input
                        type="number"
                        value={projSort}
                        onChange={(e) => setProjSort(Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={projStatus} onValueChange={setProjStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label>Membros Atribuídos</Label>
                    <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-3 bg-slate-50">
                      {users.length === 0 && (
                        <span className="text-xs text-muted-foreground">Nenhum usuário.</span>
                      )}
                      {users.map((u) => (
                        <div key={u.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`user-${u.id}`}
                            checked={projMembers.includes(u.id)}
                            onCheckedChange={(c) => {
                              if (c) setProjMembers([...projMembers, u.id])
                              else setProjMembers(projMembers.filter((id) => id !== u.id))
                            }}
                          />
                          <Label
                            htmlFor={`user-${u.id}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {u.name || u.email}{' '}
                            <span className="text-xs text-muted-foreground">
                              ({u.role || 'Operador'})
                            </span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <Button
                      onClick={handleSaveProj}
                      disabled={isSubmittingProj || !projName || projDeps.length === 0}
                      className="w-full"
                    >
                      {isSubmittingProj
                        ? 'Salvando...'
                        : editingProj
                          ? 'Salvar Alterações'
                          : 'Criar Projeto'}
                    </Button>
                    {editingProj && (
                      <Button variant="outline" onClick={handleCancelEditProj} className="w-full">
                        Cancelar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card
              className={cn(
                isAdmin ? 'lg:col-span-2' : '',
                'shadow-soft border-slate-200/60 overflow-hidden',
              )}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Membros</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((proj) => (
                    <TableRow key={proj.id}>
                      <TableCell className="font-semibold text-slate-800">
                        {proj.name}
                        {proj.description && (
                          <p className="text-xs text-slate-500 font-normal mt-0.5">
                            {proj.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        <div className="flex flex-col gap-1">
                          {proj.expand?.associated_departments?.map((d: any) => (
                            <Badge key={d.id} variant="outline" className="w-fit text-[10px]">
                              {d.name}
                            </Badge>
                          )) ||
                            (proj.expand?.department?.name && (
                              <Badge variant="outline" className="w-fit text-[10px]">
                                {proj.expand?.department?.name}
                              </Badge>
                            )) ||
                            '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {proj.expand?.members && proj.expand.members.length > 0 ? (
                            proj.expand.members.map((m: any) => (
                              <Badge
                                key={m.id}
                                variant="secondary"
                                className="text-[10px] font-normal px-1.5"
                              >
                                {m.name || m.email.split('@')[0]}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            proj.status === 'active'
                              ? 'text-primary border-primary/20 bg-primary/10'
                              : 'text-amber-600 border-amber-200 bg-amber-50'
                          }
                        >
                          {proj.status === 'active' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditProj(proj)}>
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteProj(proj.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {projects.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={isAdmin ? 5 : 4}
                        className="text-center text-muted-foreground py-8"
                      >
                        Nenhum projeto cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="escalas" className="space-y-6">
          <EscalasManagement />
        </TabsContent>
      </Tabs>
    </div>
  )
}
