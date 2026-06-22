import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { Activity, Zap, FolderKanban, BrainCircuit } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { getIcon } from '@/lib/icons'
import { SystemChecklistModal } from '@/components/SystemChecklistModal'
import { ToolUsageChart } from '@/components/ToolUsageChart'

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth()
  const name = user?.name || user?.email?.split('@')[0] || 'Usuário'

  const [tools, setTools] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])

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

      const fiveDaysAgo = new Date()
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
      const l = await pb.collection('audit_logs').getFullList({
        filter: `created >= '${fiveDaysAgo.toISOString()}'`,
        sort: '-created',
      })
      setLogs(l)
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
  useRealtime('audit_logs', () => loadData(), isAuthenticated)

  const userProjectDepts = new Set<string>()
  projects.forEach((p) => {
    if (p.members?.includes(user?.id)) {
      if (p.department) userProjectDepts.add(p.department)
      p.associated_departments?.forEach((d: string) => userProjectDepts.add(d))
    }
  })

  const filteredTools =
    user?.role === 'Admin'
      ? tools
      : tools.filter((t) => t.associated_departments?.some((d: string) => userProjectDepts.has(d)))

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-10 max-w-7xl animate-fade-in-up bg-white">
      <SystemChecklistModal tools={filteredTools} />

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-heading">
          Olá, {name}. Bem-vindo(a).
        </h1>
        <p className="text-muted-foreground text-lg font-sans">
          Acompanhamento de uso, módulos e performance dos projetos.
        </p>
      </div>

      {/* Global KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-lg border-l-[6px] border-l-primary shadow-sm bg-white hover:bg-slate-50 transition-colors flex flex-col justify-center min-h-[120px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-interactive font-medium text-slate-600 uppercase tracking-wider">
              Modelos Ativos
            </CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-slate-800 font-metrics">
              {tools.filter((t) => t.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-lg border-l-[6px] border-l-primary shadow-sm bg-white hover:bg-slate-50 transition-colors flex flex-col justify-center min-h-[120px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-interactive font-medium text-slate-600 uppercase tracking-wider">
              Projetos em Andamento
            </CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-slate-800 font-metrics">
              {projects.filter((p) => p.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-lg border-l-[6px] border-l-primary shadow-sm bg-white hover:bg-slate-50 transition-colors flex flex-col justify-center min-h-[120px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-interactive font-medium text-slate-600 uppercase tracking-wider">
              Departamentos
            </CardTitle>
            <FolderKanban className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-slate-800 font-metrics">
              {departments.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-slate-800 font-heading">
          Ferramentas de IA
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTools.map((tool) => (
            <Card
              key={tool.id}
              className="rounded-lg border-t-[6px] border-t-primary shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col justify-between aspect-square"
            >
              <CardHeader className="pb-2 flex-none">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800 font-heading">
                  <BrainCircuit className="h-5 w-5 text-primary" />
                  <span className="truncate">{tool.name}</span>
                </CardTitle>
                <div className="text-sm text-slate-500 line-clamp-2 mt-1 min-h-[40px] font-sans">
                  {tool.description || 'Sem descrição.'}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 min-h-0">
                <div className="text-xs font-interactive font-medium text-slate-600 mb-1 uppercase tracking-wider">
                  Uso nos últimos 5 dias
                </div>
                <div className="flex-1 min-h-0 w-full">
                  <ToolUsageChart tool={tool} logs={logs} />
                </div>
                <div className="mt-4 pt-4 border-t flex justify-end flex-none">
                  <Link
                    to={`/ai/${tool.id}`}
                    className="text-sm font-interactive font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Acessar Ferramenta &rarr;
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredTools.length === 0 && (
            <div className="col-span-full text-muted-foreground text-sm py-8 text-center bg-white rounded-lg border border-dashed">
              Nenhuma ferramenta disponível.
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-slate-800 font-heading">
          Módulos & Departamentos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {departments.map((dept) => {
            const deptProjects = projects.filter(
              (p) => p.associated_departments?.includes(dept.id) || p.department === dept.id,
            )
            const deptTools = tools.filter((t) => t.associated_departments?.includes(dept.id))
            const Icon = getIcon(dept.icon)

            return (
              <Card
                key={dept.id}
                className="rounded-lg border-t-[6px] border-t-primary shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col justify-between group aspect-square"
              >
                <CardHeader className="pb-3 pt-5 px-5 flex flex-col items-start gap-3 space-y-0 border-b border-slate-100 flex-none">
                  <div className="p-3 rounded-lg bg-primary/10 text-primary shrink-0 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg font-heading font-bold leading-tight line-clamp-2 text-slate-800">
                    {dept.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-4 flex flex-col flex-1 justify-between">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-sm px-3 py-2 bg-slate-50 rounded-md">
                      <span className="text-slate-600 flex items-center gap-2 font-interactive font-medium">
                        <Activity className="h-4 w-4 text-primary" /> Projetos
                      </span>
                      <span className="font-bold text-slate-800 text-lg font-metrics">
                        {deptProjects.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm px-3 py-2 bg-slate-50 rounded-md">
                      <span className="text-slate-600 flex items-center gap-2 font-interactive font-medium">
                        <Zap className="h-4 w-4 text-primary" /> Modelos IA
                      </span>
                      <span className="font-bold text-slate-800 text-lg font-metrics">
                        {deptTools.length}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t text-right">
                    <Link
                      to={`/department/${dept.id}`}
                      className="text-sm font-interactive font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      Ver detalhes &rarr;
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {departments.length === 0 && (
            <div className="col-span-full text-muted-foreground text-sm py-8 text-center bg-white rounded-lg border border-dashed">
              Nenhum departamento cadastrado.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
