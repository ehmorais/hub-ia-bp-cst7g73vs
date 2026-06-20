import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useParams, Link } from 'react-router-dom'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useRealtime } from '@/hooks/use-realtime'
import {
  ArrowLeft,
  Activity,
  FolderKanban,
  Cpu,
  Users,
  Bed,
  AlertTriangle,
  History,
  Clock,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function Department() {
  const { id } = useParams()
  const [department, setDepartment] = useState<any>(null)
  const [departmentTools, setDepartmentTools] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])

  useEffect(() => {
    if (id) {
      pb.collection('departments')
        .getOne(id)
        .then(setDepartment)
        .catch((e) => console.error('Error loading department:', e))

      pb.collection('ia_tools')
        .getFullList({ filter: `associated_departments~"${id}"`, sort: 'name' })
        .then(setDepartmentTools)
        .catch((e) => {
          console.error('Error loading tools:', e)
          setDepartmentTools([])
        })

      pb.collection('projects')
        .getFullList({
          filter: `department="${id}" || associated_departments~"${id}"`,
          sort: 'sort_order,name',
        })
        .then(setProjects)
        .catch((e) => {
          console.error('Error loading projects:', e)
          setProjects([])
        })

      pb.collection('hospital_sectors')
        .getFullList({ filter: `department="${id}"`, sort: 'name' })
        .then(setSectors)
        .catch((e) => {
          console.error('Error loading sectors:', e)
          setSectors([])
        })
    }
  }, [id])

  useEffect(() => {
    if (id && department?.name) {
      pb.collection('audit_logs')
        .getList(1, 15, {
          filter: `department="${department.name}" || department="${id}"`,
          sort: '-created',
          expand: 'user',
        })
        .then((res) => setAuditLogs(res.items))
        .catch((e) => {
          console.error('Error loading audit logs:', e)
        })
    }
  }, [id, department?.name])

  useRealtime('projects', () => {
    if (id)
      pb.collection('projects')
        .getFullList({
          filter: `department="${id}" || associated_departments~"${id}"`,
          sort: 'sort_order,name',
        })
        .then(setProjects)
        .catch((e) => console.error('Error on projects realtime:', e))
  })

  useRealtime('hospital_sectors', () => {
    if (id)
      pb.collection('hospital_sectors')
        .getFullList({ filter: `department="${id}"`, sort: 'name' })
        .then(setSectors)
        .catch((e) => console.error('Error on sectors realtime:', e))
  })

  useRealtime('ia_tools', () => {
    if (id)
      pb.collection('ia_tools')
        .getFullList({ filter: `associated_departments~"${id}"`, sort: 'name' })
        .then(setDepartmentTools)
        .catch((e) => console.error('Error on tools realtime:', e))
  })

  useRealtime('audit_logs', () => {
    if (id && department?.name) {
      pb.collection('audit_logs')
        .getList(1, 15, {
          filter: `department="${department.name}" || department="${id}"`,
          sort: '-created',
          expand: 'user',
        })
        .then((res) => setAuditLogs(res.items))
        .catch((e) => console.error('Error on audit logs realtime:', e))
    }
  })

  if (!department) return null

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-12 max-w-[85rem] mx-auto">
      {/* HEADER SECTION */}
      <div className="relative overflow-hidden rounded-2xl bg-card border border-border/50 shadow-soft p-8 md:p-10 flex flex-col gap-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex items-center gap-5">
            <Button
              variant="outline"
              size="icon"
              asChild
              className="rounded-full shadow-sm hover:bg-secondary border-border/50 shrink-0 h-10 w-10"
            >
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              {department.name}
            </h1>
          </div>

          {department.description && (
            <p className="text-muted-foreground text-lg max-w-4xl leading-relaxed md:pl-[3.75rem]">
              {department.description}
            </p>
          )}

          <div className="flex flex-wrap gap-3 md:pl-[3.75rem]">
            <Badge
              variant="secondary"
              className="bg-secondary/60 hover:bg-secondary/80 text-secondary-foreground border-transparent px-3 py-1.5 font-medium rounded-lg shadow-sm transition-colors"
            >
              <Users className="w-4 h-4 mr-2 text-primary" />
              {sectors.length} Setores
            </Badge>
            <Badge
              variant="secondary"
              className="bg-secondary/60 hover:bg-secondary/80 text-secondary-foreground border-transparent px-3 py-1.5 font-medium rounded-lg shadow-sm transition-colors"
            >
              <Cpu className="w-4 h-4 mr-2 text-primary" />
              {departmentTools.length} Modelos
            </Badge>
            <Badge
              variant="secondary"
              className="bg-secondary/60 hover:bg-secondary/80 text-secondary-foreground border-transparent px-3 py-1.5 font-medium rounded-lg shadow-sm transition-colors"
            >
              <FolderKanban className="w-4 h-4 mr-2 text-primary" />
              {projects.length} Projetos
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        {/* LEFT COLUMN: IA TOOLS & PROJECTS */}
        <div className="xl:col-span-2 space-y-12">
          {/* IA TOOLS */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Cpu className="w-5 h-5 text-primary" />
                </div>
                Modelos de IA
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {departmentTools.map((tool) => (
                <Card
                  key={tool.id}
                  className="group hover:shadow-soft transition-all duration-300 border-border/60 bg-card flex flex-col overflow-hidden rounded-xl"
                >
                  <CardHeader className="p-6 pb-4 flex-1">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <CardTitle className="text-lg font-semibold text-foreground leading-tight">
                        {tool.name}
                      </CardTitle>
                      <Badge
                        className={cn(
                          'shrink-0 font-medium rounded-md px-2.5 py-0.5 shadow-none',
                          tool.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50 hover:bg-emerald-50'
                            : 'bg-muted text-muted-foreground border-transparent',
                        )}
                        variant="outline"
                      >
                        {tool.status}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {tool.description}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="p-6 pt-0">
                    <Button
                      asChild
                      className={cn(
                        'w-full transition-all duration-300 shadow-sm rounded-lg',
                        tool.status === 'active'
                          ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                          : '',
                      )}
                      variant={tool.status === 'active' ? 'default' : 'secondary'}
                    >
                      <Link to={(tool as any).path || `/ai/${tool.id}`}>Acessar Ferramenta</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
              {departmentTools.length === 0 && (
                <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-card border border-border/40 rounded-2xl shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                    <Cpu className="w-6 h-6 text-primary/60" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-1">
                    Nenhum modelo associado
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Este departamento ainda não possui ferramentas de IA disponíveis.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* PROJECTS */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FolderKanban className="w-5 h-5 text-primary" />
                </div>
                Projetos
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {projects.map((proj) => (
                <Card
                  key={proj.id}
                  className="group hover:shadow-soft transition-all duration-300 border-border/60 bg-card flex flex-col rounded-xl"
                >
                  <CardHeader className="p-6 pb-4 flex-1">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <CardTitle className="text-lg font-semibold text-foreground leading-tight">
                        {proj.name}
                      </CardTitle>
                      <Badge
                        className={cn(
                          'shrink-0 font-medium rounded-md px-2.5 py-0.5 shadow-none',
                          proj.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50 hover:bg-emerald-50'
                            : 'bg-muted text-muted-foreground border-transparent',
                        )}
                        variant="outline"
                      >
                        {proj.status}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {proj.description}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="p-6 pt-0">
                    <Button
                      asChild
                      variant="outline"
                      className="w-full border-border/60 hover:bg-secondary hover:text-primary transition-colors shadow-sm rounded-lg"
                    >
                      <Link to={`/project/${proj.id}`}>Acessar Projeto</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
              {projects.length === 0 && (
                <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-card border border-border/40 rounded-2xl shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                    <FolderKanban className="w-6 h-6 text-primary/60" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-1">
                    Nenhum projeto associado
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Não há projetos em andamento vinculados a este departamento.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: SECTORS */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="w-5 h-5 text-primary" />
              </div>
              Setores
            </h2>
          </div>

          <div className="space-y-4">
            {sectors.map((sector) => (
              <Card
                key={sector.id}
                className="border-border/60 hover:shadow-soft transition-all duration-300 overflow-hidden bg-card rounded-xl"
              >
                <div className="h-1.5 w-full bg-gradient-to-r from-primary/80 to-primary/30" />
                <CardHeader className="p-5 pb-3">
                  <div className="flex justify-between items-start gap-3">
                    <CardTitle className="text-base font-semibold text-foreground leading-tight">
                      {sector.name}
                    </CardTitle>
                    {sector.is_critical && (
                      <Badge
                        variant="destructive"
                        className="shrink-0 flex items-center gap-1.5 shadow-none bg-red-50 text-red-700 border-red-200 hover:bg-red-50 px-2 py-0.5 rounded-md"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Crítico
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-5 pt-1">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Bed className="w-4 h-4 text-muted-foreground/70" /> Capacidade
                      </span>
                      <span className="font-semibold text-foreground">
                        {sector.bed_capacity || 0} leitos
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground/70" /> Equipe Ideal
                      </span>
                      <span className="font-semibold text-foreground">
                        {sector.ideal_staffing || 0} prof.
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Activity className="w-4 h-4 text-muted-foreground/70" /> Equipe Mínima
                      </span>
                      <span className="font-semibold text-foreground">
                        {sector.min_staffing || 0} prof.
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {sectors.length === 0 && (
              <div className="py-16 flex flex-col items-center justify-center text-center bg-card border border-border/40 rounded-2xl shadow-sm">
                <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-primary/60" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-1">
                  Nenhum setor registrado
                </h3>
                <p className="text-sm text-muted-foreground max-w-[200px]">
                  Não há setores configurados para este departamento.
                </p>
              </div>
            )}
          </div>

          {/* USAGE HISTORY */}
          <div className="flex items-center justify-between mt-10 mb-4">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <History className="w-5 h-5 text-primary" />
              </div>
              Histórico de Uso de IA
            </h2>
          </div>

          <div className="relative">
            {auditLogs.length > 0 && (
              <div className="absolute top-0 bottom-0 left-4 w-0.5 bg-border/60 z-0"></div>
            )}
            <div className="space-y-4">
              {auditLogs.length > 0 ? (
                auditLogs.map((log) => (
                  <div key={log.id} className="relative flex items-start gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-background bg-card shadow-sm shrink-0 z-10 mt-1">
                      <Avatar className="w-7 h-7">
                        <AvatarImage
                          src={
                            log.expand?.user?.avatar
                              ? `${import.meta.env.VITE_POCKETBASE_URL}/api/files/users/${log.expand.user.id}/${log.expand.user.avatar}`
                              : undefined
                          }
                        />
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                          {log.expand?.user?.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    <Card className="flex-1 p-3.5 shadow-sm border-border/40 hover:border-primary/20 transition-colors bg-card z-10">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-foreground truncate">
                            {log.expand?.user?.name || 'Usuário'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-snug">{log.action}</p>
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
                            <Clock className="w-3 h-3" />
                            {new Date(log.created).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          {log.token_usage > 0 && (
                            <Badge
                              variant="secondary"
                              className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-transparent text-[10px] px-1.5 py-0 h-5"
                            >
                              <Zap className="w-3 h-3 mr-1" />
                              {log.token_usage}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                ))
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center bg-card border border-border/40 rounded-2xl shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                    <History className="w-6 h-6 text-primary/60" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-1">Nenhum registro</h3>
                  <p className="text-sm text-muted-foreground max-w-[200px]">
                    O histórico de uso de IA aparecerá aqui.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
