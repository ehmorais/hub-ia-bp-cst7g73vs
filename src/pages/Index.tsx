import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Building2, Activity, FileText, Bot, ArrowRight } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function Index() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    departments: 0,
    tools: 0,
    projects: 0,
  })
  const [activeTools, setActiveTools] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      pb.collection('departments').getList(1, 1),
      pb.collection('ia_tools').getList(1, 10, { filter: 'status="active"' }),
      pb.collection('projects').getList(1, 1, { filter: 'status="active"' }),
    ])
      .then(([deps, toolsRes, projects]) => {
        setStats({
          departments: deps.totalItems,
          tools: toolsRes.totalItems,
          projects: projects.totalItems,
        })
        setActiveTools(toolsRes.items)
      })
      .catch(console.error)
  }, [])

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Visão Geral</h1>
        <p className="text-muted-foreground">
          Bem-vindo ao portal corporativo,{' '}
          <span className="font-medium text-slate-700">{user?.name || 'Usuário'}</span>.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gestão de Escalas</CardTitle>
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800 mb-2">Rascunhos</div>
            <Button asChild className="w-full" size="sm">
              <Link to="/schedules/drafts">Gerenciar Rascunhos</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departamentos</CardTitle>
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-800">{stats.departments}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Departamentos registrados na instituição
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ferramentas de IA</CardTitle>
            <div className="p-2 bg-primary/10 rounded-lg">
              <Activity className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-800">{stats.tools}</div>
            <p className="text-xs text-muted-foreground mt-1">Ferramentas ativas para uso</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projetos</CardTitle>
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-800">{stats.projects}</div>
            <p className="text-xs text-muted-foreground mt-1">Projetos em andamento</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Suas Ferramentas de IA
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeTools.length === 0 ? (
            <div className="col-span-full py-12 text-center border rounded-lg bg-slate-50 border-dashed">
              <p className="text-muted-foreground">Nenhuma ferramenta de IA ativa no momento.</p>
            </div>
          ) : (
            activeTools.map((tool) => (
              <Card
                key={tool.id}
                className="flex flex-col group hover:border-primary/50 transition-colors"
              >
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Bot className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg line-clamp-1">{tool.name}</CardTitle>
                  </div>
                  <CardDescription className="line-clamp-2 h-10">
                    {tool.description ||
                      'Uma poderosa ferramenta de inteligência artificial para o seu dia a dia.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto pt-4 pb-6">
                  <Button asChild className="w-full group/btn">
                    <Link to={`/ai/${tool.id}`}>
                      Acessar Ferramenta
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
