import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
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
import * as Icons from 'lucide-react'
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
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import {
  getAuditLogs,
  getIaTools,
  getUsers,
  createIaTool,
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
  const { toast } = useToast()
  const { user } = useAuth()

  const [logs, setLogs] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [tools, setTools] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])

  const [toolName, setToolName] = useState('')
  const [toolModel, setToolModel] = useState('fast')
  const [toolDesc, setToolDesc] = useState('')
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
  const [projDep, setProjDep] = useState('')
  const [projSort, setProjSort] = useState(0)
  const [projStatus, setProjStatus] = useState('active')
  const [projMembers, setProjMembers] = useState<string[]>([])
  const [editingProj, setEditingProj] = useState<any>(null)
  const [isSubmittingProj, setIsSubmittingProj] = useState(false)

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
      const depName = p.expand?.department?.name || '-'
      const members = (p.expand?.members || []).map((m: any) => m.name || m.email).join(' | ')
      return `"${p.name}","${p.status}","${depName}","${members}"`
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
      const depNameStr = departments.find((d) => d.id === projDep)?.name || 'Desconhecido'
      if (editingProj) {
        await updateProject(
          editingProj.id,
          {
            name: projName,
            description: projDesc,
            department: projDep,
            sort_order: projSort,
            status: projStatus,
            members: projMembers,
          },
          user?.id,
          depNameStr,
        )
        toast({ title: 'Sucesso', description: 'Projeto atualizado com sucesso.' })
      } else {
        await createProject(
          {
            name: projName,
            description: projDesc,
            department: projDep,
            sort_order: projSort,
            status: projStatus,
            members: projMembers,
          },
          user?.id,
          depNameStr,
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
    setProjDep(proj.department)
    setProjSort(proj.sort_order || 0)
    setProjStatus(proj.status || 'active')
    setProjMembers(proj.members || [])
  }

  const handleCancelEditProj = () => {
    setEditingProj(null)
    setProjName('')
    setProjDesc('')
    setProjDep('')
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

  const handleCreateTool = async () => {
    setFieldErrors({})
    setIsSubmitting(true)
    try {
      await createIaTool({
        name: toolName,
        model_alias: toolModel,
        description: toolDesc,
        status: 'active',
        version: 'v1.0.0',
      })
      toast({ title: 'Sucesso', description: 'Ferramenta IA configurada com sucesso.' })
      setToolName('')
      setToolDesc('')
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

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-[1400px] animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          Painel de Administração
        </h1>
        <p className="text-muted-foreground text-lg">
          Governança, controle de acessos e auditoria de modelos de IA da BP.
        </p>
      </div>

      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-6 max-w-5xl mb-8">
          <TabsTrigger
            value="performance"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Performance
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Auditoria
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Usuários
          </TabsTrigger>
          <TabsTrigger
            value="ia_tools"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Ferramentas IA
          </TabsTrigger>
          <TabsTrigger
            value="departments"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Departamentos
          </TabsTrigger>
          <TabsTrigger
            value="projects"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Projetos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5" /> Performance Dashboard
            </h2>
            <Button onClick={handleExportCSV} className="gap-2">
              <Download className="h-4 w-4" /> Exportar Relatório (CSV)
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map((dep) => {
              const depProjs = projects.filter((p) => p.department === dep.id)
              const total = depProjs.length
              const active = depProjs.filter((p) => p.status === 'active').length
              const activePercent = total > 0 ? Math.round((active / total) * 100) : 0
              const depColorHex = dep.color || 'hsl(var(--primary))'

              return (
                <Card key={dep.id} className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle
                      className="text-lg flex items-center gap-2"
                      style={{ color: dep.color || 'inherit' }}
                    >
                      <div
                        className="p-2 rounded-lg bg-slate-100 flex items-center justify-center"
                        style={{ color: dep.color || 'inherit' }}
                      >
                        {(() => {
                          const Icon = (Icons as any)[dep.icon] || Icons.Folder
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
                        <span className="font-semibold text-green-600">
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
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="border-slate-200 bg-white lg:col-span-1 h-fit">
              <CardHeader className="bg-slate-50 border-b">
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
                    <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-slate-50">
                      {ICONS_LIST.map((icon) => {
                        const Icon = (Icons as any)[icon] || Icons.Folder
                        return (
                          <Button
                            key={icon}
                            type="button"
                            variant={depIcon === icon ? 'default' : 'outline'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDepIcon(icon)}
                          >
                            <Icon className="h-4 w-4" />
                          </Button>
                        )
                      })}
                    </div>
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

            <Card className="border-slate-200 lg:col-span-2">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Ícone & Cor</TableHead>
                    <TableHead>Ordem</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
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
                              const Icon = (Icons as any)[dep.icon] || Icons.Folder
                              return <Icon className="h-4 w-4" />
                            })()}
                          </div>
                          <span className="text-xs text-slate-500 uppercase">
                            {dep.color || '#000'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500">{dep.sort_order || 0}</TableCell>
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
                    </TableRow>
                  ))}
                  {departments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
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
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm mb-4">
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

          <Card className="border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Ação</TableHead>
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
                    <TableCell>{log.department || '-'}</TableCell>
                    <TableCell>{log.action}</TableCell>
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
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" /> Gestão de Acessos
            </h2>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Adicionar Usuário
            </Button>
          </div>
          <Card className="border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Nível de Acesso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-semibold text-slate-800">
                      {user.name || 'Sem nome'}
                    </TableCell>
                    <TableCell className="text-slate-500">{user.email}</TableCell>
                    <TableCell>{user.department || '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          user.role === 'Admin'
                            ? 'border-red-200 text-red-700 bg-red-50'
                            : 'border-slate-200 text-slate-700 bg-slate-50',
                        )}
                      >
                        {user.role || 'Operador'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="ia_tools" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-slate-200 bg-white h-fit">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings2 className="h-5 w-5" /> Nova Ferramenta IA
                </CardTitle>
                <CardDescription>
                  Defina os parâmetros do modelo para um novo projeto.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label>Nome do Projeto</Label>
                  <Input
                    value={toolName}
                    onChange={(e) => setToolName(e.target.value)}
                    placeholder="Ex: Análise de Prontuários"
                  />
                  {fieldErrors.name && <p className="text-sm text-red-500">{fieldErrors.name}</p>}
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
                    <Label>Temperatura</Label>
                    <Input type="number" step="0.1" defaultValue="0.2" max="1" min="0" />
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
                <Button onClick={handleCreateTool} disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Salvando...' : 'Salvar e Homologar'}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Ferramentas Ativas</h3>
              <div className="flex flex-col gap-3">
                {tools.map((tool) => (
                  <Card
                    key={tool.id}
                    className="p-4 flex items-center justify-between border-slate-200 shadow-sm"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">{tool.name}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        Modelo: {tool.model_alias} | Versão: {tool.version || 'N/A'}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        tool.status === 'active'
                          ? 'text-primary border-primary/30'
                          : 'text-amber-600 border-amber-300'
                      }
                    >
                      {tool.status}
                    </Badge>
                  </Card>
                ))}
                {tools.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4 border rounded-md bg-slate-50">
                    Nenhuma ferramenta ativa.
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="projects" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="border-slate-200 bg-white lg:col-span-1 h-fit">
              <CardHeader className="bg-slate-50 border-b">
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
                  <Label>Departamento</Label>
                  <Select value={projDep} onValueChange={setProjDep}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    disabled={isSubmittingProj || !projName || !projDep}
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

            <Card className="border-slate-200 lg:col-span-2">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Membros</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
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
                        {proj.expand?.department?.name || '-'}
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
                              ? 'text-green-600 border-green-200 bg-green-50'
                              : 'text-amber-600 border-amber-200 bg-amber-50'
                          }
                        >
                          {proj.status === 'active' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
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
                    </TableRow>
                  ))}
                  {projects.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum projeto cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
