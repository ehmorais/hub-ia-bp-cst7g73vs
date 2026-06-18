import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { Activity, Zap, FolderKanban } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { getIcon } from '@/lib/icons'
import { SystemChecklistModal } from '@/components/SystemChecklistModal'

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
    <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-7xl animate-fade-in-up">
      <SystemChecklistModal tools={filteredTools} />
      {/* Welcome Section */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Olá, {name}. Bem-vindo(a) ao HUB de IA BP.
        </h1>
        <p className="text-muted-foreground text-lg">
          Visão consolidada da operação e saúde dos projetos.
        </p>
      </div>

      {/* Global KPIs */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Modelos Ativos
            </CardTitle>
            <Zap className="h-4 w-4 text-primary" />
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
            <Activity className="h-4 w-4 text-amber-500" />
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
            <FolderKanban className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departments.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Departamentos</h2>
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
                className="border-green-100/60 hover:border-green-400 hover:shadow-lg hover:shadow-green-500/10 transition-all bg-white rounded-2xl overflow-hidden group"
              >
                <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-center gap-3 space-y-0 bg-green-50/40 border-b border-green-50/50">
                  <div
                    className="p-2.5 rounded-xl bg-green-100/60 text-green-700 flex shrink-0 group-hover:scale-110 group-hover:bg-green-200 transition-all duration-300"
                    style={{ color: dept.color || 'inherit' }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-[15px] font-bold leading-tight line-clamp-2 text-slate-800">
                    {dept.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-sm px-3 py-2.5 bg-slate-50/80 rounded-xl group-hover:bg-green-50/50 transition-colors">
                      <span className="text-slate-600 flex items-center gap-2 font-medium">
                        <Activity className="h-4 w-4 text-green-600" /> Projetos
                      </span>
                      <span className="font-bold text-slate-800 text-base">
                        {deptProjects.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm px-3 py-2.5 bg-slate-50/80 rounded-xl group-hover:bg-green-50/50 transition-colors">
                      <span className="text-slate-600 flex items-center gap-2 font-medium">
                        <Zap className="h-4 w-4 text-green-600" /> Modelos de IA
                      </span>
                      <span className="font-bold text-slate-800 text-base">{deptTools.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {departments.length === 0 && (
            <div className="col-span-full text-muted-foreground text-sm py-8 text-center bg-white rounded-2xl border border-dashed">
              Nenhum departamento cadastrado.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
