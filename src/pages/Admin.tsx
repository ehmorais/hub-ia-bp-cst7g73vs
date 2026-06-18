import { useEffect, useState } from 'react'
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
import {
  Search,
  Download,
  Plus,
  ShieldCheck,
  Settings2,
  Users,
  Building2,
  Trash2,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import {
  getAuditLogs,
  getIaTools,
  getUsers,
  createIaTool,
  getDepartments,
  createDepartment,
  deleteDepartment,
} from '@/services/admin'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { useRealtime } from '@/hooks/use-realtime'
import { cn } from '@/lib/utils'

export default function Admin() {
  const { toast } = useToast()

  const [logs, setLogs] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [tools, setTools] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])

  const [toolName, setToolName] = useState('')
  const [toolModel, setToolModel] = useState('fast')
  const [toolDesc, setToolDesc] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [depName, setDepName] = useState('')
  const [depDesc, setDepDesc] = useState('')
  const [isSubmittingDep, setIsSubmittingDep] = useState(false)
  const [editingDep, setEditingDep] = useState<any>(null)

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

  useEffect(() => {
    loadLogs()
    loadUsers()
    loadTools()
    loadDepartments()
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

  const handleSaveDep = async () => {
    setIsSubmittingDep(true)
    try {
      if (editingDep) {
        await updateDepartment(editingDep.id, { name: depName, description: depDesc })
        toast({ title: 'Sucesso', description: 'Departamento atualizado com sucesso.' })
      } else {
        await createDepartment({ name: depName, description: depDesc })
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
  }

  const handleCancelEditDep = () => {
    setEditingDep(null)
    setDepName('')
    setDepDesc('')
  }

  const handleDeleteDep = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este departamento?')) {
      try {
        await deleteDepartment(id)
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
    <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-7xl animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          Painel de Administração
        </h1>
        <p className="text-muted-foreground text-lg">
          Governança, controle de acessos e auditoria de modelos de IA da BP.
        </p>
      </div>

      <Tabs defaultValue="audit" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl mb-8">
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
            value="projects"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Projetos IA
          </TabsTrigger>
          <TabsTrigger
            value="departments"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Departamentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="departments" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-slate-200 bg-white md:col-span-1 h-fit">
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
                <div className="flex flex-col gap-2">
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

            <Card className="border-slate-200 md:col-span-2">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((dep) => (
                    <TableRow key={dep.id}>
                      <TableCell className="font-semibold text-slate-800">{dep.name}</TableCell>
                      <TableCell className="text-slate-500">{dep.description || '-'}</TableCell>
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
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
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
            <Button
              variant="outline"
              className="gap-2 text-primary border-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Download className="h-4 w-4" /> Exportar PDF (LGPD)
            </Button>
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
                  <TableHead className="text-right">Tokens Úteis</TableHead>
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

        <TabsContent value="projects" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-slate-200 bg-white">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings2 className="h-5 w-5" /> Configurar Nova Ferramenta IA
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
                    {fieldErrors.model_alias && (
                      <p className="text-sm text-red-500">{fieldErrors.model_alias}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Temperatura (Criatividade)</Label>
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
                  {fieldErrors.description && (
                    <p className="text-sm text-red-500">{fieldErrors.description}</p>
                  )}
                </div>
                <Button onClick={handleCreateTool} disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Salvando...' : 'Salvar e Homologar'}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Projetos Ativos</h3>
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
                    Nenhum projeto ativo.
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
