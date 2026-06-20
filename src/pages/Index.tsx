import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Building2, Activity, FileText } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

export default function Index() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    departments: 0,
    tools: 0,
    projects: 0,
  })

  useEffect(() => {
    Promise.all([
      pb.collection('departments').getList(1, 1),
      pb.collection('ia_tools').getList(1, 1, { filter: 'status="active"' }),
      pb.collection('projects').getList(1, 1, { filter: 'status="active"' }),
    ]).then(([deps, tools, projects]) => {
      setStats({
        departments: deps.totalItems,
        tools: tools.totalItems,
        projects: projects.totalItems,
      })
    })
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
        <p className="text-muted-foreground">
          Bem-vindo ao portal corporativo, {user?.name || 'Usuário'}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departamentos</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.departments}</div>
            <p className="text-xs text-muted-foreground">Departamentos registrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ferramentas de IA</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tools}</div>
            <p className="text-xs text-muted-foreground">Ferramentas ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projetos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.projects}</div>
            <p className="text-xs text-muted-foreground">Projetos ativos</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
