import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { Activity, Clock, Zap, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { getIcon } from '@/lib/icons'

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth()
  const name = user?.name || user?.email?.split('@')[0] || 'Usuário'

  const [tools, setTools] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])

  const loadData = async () => {
    try {
      const t = await pb.collection('ia_tools').getFullList({ sort: 'name' })
      setTools(t)
      const d = await pb.collection('departments').getFullList({ sort: 'sort_order,name' })
      setDepartments(d)
      const p = await pb
        .collection('projects')
        .getFullList({ sort: 'sort_order,name', expand: 'associated_departments' })
      setProjects(p)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (isAuthenticated) loadData()
  }, [isAuthenticated])

  useRealtime('ia_tools', () => loadData(), isAuthenticated)
  useRealtime('departments', () => loadData(), isAuthenticated)
  useRealtime('projects', () => loadData(), isAuthenticated)

  const topTools = tools.slice(0, 3)

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-7xl animate-fade-in-up">
      {/* Welcome Section */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Olá, {name}. Bem-vindo(a) ao All Systems Go.
        </h1>
        <p className="text-muted-foreground text-lg">
          Visão consolidada da operação e saúde dos projetos.
        </p>
      </div>

      {/* Global KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Modelos Ativos
            </CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tools.filter((t) => t.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Projetos em Andamento
            </CardTitle>
            <Zap className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {projects.filter((p) => p.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Departamentos
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departments.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-[1fr_300px]">
        {/* Main Area: Departments Macro View */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold tracking-tight">Visão Macro por Departamento</h2>
          <div className="grid grid-cols-1 gap-6">
            {departments.map((dept) => {
              const deptProjects = projects.filter(
                (p) => p.associated_departments?.includes(dept.id) || p.department === dept.id,
              )
              const Icon = getIcon(dept.icon)

              return (
                <Card
                  key={dept.id}
                  className="overflow-hidden border-slate-200 bg-white shadow-sm"
                  style={{ borderTop: `4px solid ${dept.color || 'hsl(var(--primary))'}` }}
                >
                  <CardHeader className="pb-3 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2 rounded-lg bg-white shadow-sm"
                        style={{ color: dept.color || 'inherit' }}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl" style={{ color: dept.color || 'inherit' }}>
                          {dept.name}
                        </CardTitle>
                        {dept.description && <CardDescription>{dept.description}</CardDescription>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    {deptProjects.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {deptProjects.map((proj) => (
                          <div
                            key={proj.id}
                            className="p-3 border rounded-md bg-white flex flex-col justify-between hover:border-primary/50 transition-colors"
                          >
                            <div>
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-semibold text-slate-800 text-sm truncate pr-2">
                                  {proj.name}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-[10px] uppercase',
                                    proj.status === 'active'
                                      ? 'text-green-600 border-green-200 bg-green-50'
                                      : 'text-amber-600 border-amber-200 bg-amber-50',
                                  )}
                                >
                                  {proj.status === 'active' ? 'Ativo' : 'Inativo'}
                                </Badge>
                              </div>
                              {proj.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {proj.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic px-2">
                        Nenhum projeto associado.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
            {departments.length === 0 && (
              <div className="text-muted-foreground text-sm py-4">
                Nenhum departamento cadastrado.
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Area: Quick Access */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Ferramentas IA</h2>
          <div className="flex flex-col gap-3">
            {topTools.map((tool) => (
              <Card key={tool.id} className="bg-white border-slate-200">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-sm font-bold leading-tight">{tool.name}</CardTitle>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] uppercase px-1.5 py-0',
                        tool.status === 'active'
                          ? 'text-primary border-primary/30'
                          : 'text-amber-600 border-amber-300',
                      )}
                    >
                      {tool.status === 'active' ? 'Ativo' : tool.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs mt-1 truncate">
                    {tool.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 mt-3">
                  <Button size="sm" className="w-full text-xs h-8 group" asChild>
                    <Link to={`/ai/${tool.id}`}>
                      Acessar{' '}
                      <ArrowRight className="ml-2 h-3 w-3 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
