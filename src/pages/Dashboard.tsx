import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Activity, Clock, Zap, ArrowRight } from 'lucide-react'
import { DEPARTMENTS, TOOLS } from '@/lib/mock-data'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'

export default function Dashboard() {
  const topTools = TOOLS.slice(0, 3)
  const { user } = useAuth()
  const name = user?.name || user?.email?.split('@')[0] || 'Usuário'

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-7xl">
      {/* Welcome Section */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Olá, {name}. Bem-vindo(a) ao Hub de IA da BP.
        </h1>
        <p className="text-muted-foreground text-lg">
          Aqui você encontra as ferramentas de inteligência artificial homologadas para o seu setor.
        </p>
      </div>

      {/* Global KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Modelos Ativos na Instituição
            </CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">17</div>
            <p className="text-xs text-muted-foreground mt-1">+2 em homologação este mês</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Interações Hoje (Global)
            </CardTitle>
            <Zap className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,482</div>
            <p className="text-xs text-muted-foreground mt-1">Economia estimada: 45 horas</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tempo Médio de Resposta
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.2s</div>
            <p className="text-xs text-muted-foreground mt-1">Sistemas operando normalmente</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-[1fr_300px]">
        {/* Main Area: Departments Grid */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Seus Departamentos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEPARTMENTS.map((dept) => {
              const Icon = dept.icon
              return (
                <Link to={`/department/${dept.id}`} key={dept.id} className="group">
                  <Card className="h-full border-slate-200 transition-all duration-200 hover:shadow-md hover:border-primary/50 bg-white">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className={cn('p-2.5 rounded-lg', dept.color)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <Badge
                          variant="secondary"
                          className="bg-slate-100 text-slate-600 font-medium"
                        >
                          {dept.modelsActive} Modelos
                        </Badge>
                      </div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        {dept.name}
                      </CardTitle>
                      <CardDescription className="line-clamp-2 mt-1 h-10">
                        {dept.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Sidebar Area: Quick Access */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Acesso Rápido</h2>
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
                        tool.status === 'Ativo'
                          ? 'text-primary border-primary/30'
                          : 'text-amber-600 border-amber-300',
                      )}
                    >
                      {tool.status}
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
