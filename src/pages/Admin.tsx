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
import { AUDIT_LOGS, USERS, TOOLS } from '@/lib/mock-data'
import { Search, Download, Plus, ShieldCheck, Settings2, Users } from 'lucide-react'

export default function Admin() {
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
        <TabsList className="grid w-full grid-cols-3 max-w-md mb-8">
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
        </TabsList>

        {/* AUDIT TAB */}
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
                  <TableHead>Ação / Modelo</TableHead>
                  <TableHead className="text-right">Tokens Úteis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {AUDIT_LOGS.map((log) => (
                  <TableRow key={log.id} className="font-medium text-sm text-slate-600">
                    <TableCell className="font-mono text-xs">{log.id}</TableCell>
                    <TableCell>{log.timestamp}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-slate-900">{log.user}</span>
                        <span className="text-xs text-muted-foreground">{log.role}</span>
                      </div>
                    </TableCell>
                    <TableCell>{log.department}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell className="text-right font-mono text-primary">
                      {log.tokens}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* USERS TAB */}
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
                {USERS.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-semibold text-slate-800">{user.name}</TableCell>
                    <TableCell className="text-slate-500">{user.email}</TableCell>
                    <TableCell>{user.department}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          user.role === 'Admin'
                            ? 'border-red-200 text-red-700 bg-red-50'
                            : user.role === 'Gerente'
                              ? 'border-blue-200 text-blue-700 bg-blue-50'
                              : 'border-slate-200 text-slate-700 bg-slate-50',
                        )}
                      >
                        {user.role}
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

        {/* PROJECTS TAB */}
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
                  <Input placeholder="Ex: Análise de Prontuários" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Modelo Base</Label>
                    <Select defaultValue="claude">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="claude">Claude 3.5 Sonnet</SelectItem>
                        <SelectItem value="gpt4">GPT-4o</SelectItem>
                        <SelectItem value="llama">Llama 3 (On-Premise)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Temperatura (Criatividade)</Label>
                    <Input type="number" step="0.1" defaultValue="0.2" max="1" min="0" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>System Prompt (Instruções Base)</Label>
                  <textarea
                    className="w-full min-h-[100px] p-3 text-sm border rounded-md focus:ring-1 focus:ring-primary focus:outline-none bg-slate-50 font-mono text-slate-600"
                    defaultValue={
                      'Você é um assistente médico especializado do Hospital BP. Suas respostas devem ser baseadas em evidências clínicas, curtas e objetivas. Nunca forneça diagnósticos definitivos.'
                    }
                  />
                </div>
                <Button className="w-full">Salvar e Homologar</Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Projetos Ativos</h3>
              <div className="flex flex-col gap-3">
                {TOOLS.map((tool) => (
                  <Card
                    key={tool.id}
                    className="p-4 flex items-center justify-between border-slate-200 shadow-sm"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">{tool.name}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        Modelo: {tool.model}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        tool.status === 'Ativo'
                          ? 'text-primary border-primary/30'
                          : 'text-amber-600 border-amber-300'
                      }
                    >
                      {tool.status}
                    </Badge>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
