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
import { ArrowLeft, Activity, FolderKanban, Cpu, Users, Bed, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Department() {
  const { id } = useParams()
  const [department, setDepartment] = useState<any>(null)
  const [departmentTools, setDepartmentTools] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])

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

  if (!department) return null

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-12 max-w-6xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="text-muted-foreground hover:text-foreground shrink-0 rounded-full"
          >
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              {department.name}
            </h1>
          </div>
        </div>

        {department.description && (
          <p className="text-muted-foreground text-lg max-w-3xl leading-relaxed pl-14">
            {department.description}
          </p>
        )}

        <div className="flex flex-wrap gap-3 pl-14">
          <Badge
            variant="secondary"
            className="bg-card hover:bg-card border border-border/50 px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-sm"
          >
            <Users className="w-4 h-4 mr-2 text-primary" />
            {sectors.length} Setores
          </Badge>
          <Badge
            variant="secondary"
            className="bg-card hover:bg-card border border-border/50 px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-sm"
          >
            <Cpu className="w-4 h-4 mr-2 text-primary" />
            {departmentTools.length} Modelos de IA
          </Badge>
          <Badge
            variant="secondary"
            className="bg-card hover:bg-card border border-border/50 px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-sm"
          >
            <FolderKanban className="w-4 h-4 mr-2 text-primary" />
            {projects.length} Projetos
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 pl-0 md:pl-14">
        {/* LEFT COLUMN: IA TOOLS & PROJECTS */}
        <div className="xl:col-span-2 space-y-12">
          {/* IA TOOLS */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
                <Cpu className="w-5 h-5 text-primary" />
                Modelos Disponíveis
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {departmentTools.map((tool) => (
                <Card
                  key={tool.id}
                  className="group hover:shadow-elevation transition-all duration-300 border-border/40 bg-card flex flex-col overflow-hidden"
                >
                  <CardHeader className="pb-4 flex-1">
                    <div className="flex justify-between items-start gap-3">
                      <CardTitle className="text-lg font-semibold text-foreground leading-tight">
                        {tool.name}
                      </CardTitle>
                      <Badge
                        className={cn(
                          'shrink-0 font-medium rounded-full px-2.5 shadow-none',
                          tool.status === 'active'
                            ? 'bg-secondary text-primary border-primary/20 hover:bg-secondary'
                            : 'bg-muted text-muted-foreground border-transparent',
                        )}
                        variant="outline"
                      >
                        {tool.status}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2 mt-2 text-sm leading-relaxed">
                      {tool.description}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="pt-0 pb-5 px-6">
                    <Button
                      asChild
                      className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-sm"
                      variant={tool.status === 'active' ? 'default' : 'secondary'}
                    >
                      <Link to={(tool as any).path || `/ai/${tool.id}`}>Acessar Ferramenta</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
              {departmentTools.length === 0 && (
                <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 border border-dashed rounded-xl">
                  Nenhuma ferramenta de IA associada a este departamento.
                </div>
              )}
            </div>
          </section>

          {/* PROJECTS */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-primary" />
                Projetos em Andamento
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {projects.map((proj) => (
                <Card
                  key={proj.id}
                  className="group hover:shadow-elevation transition-all duration-300 border-border/40 bg-card flex flex-col"
                >
                  <CardHeader className="pb-4 flex-1">
                    <div className="flex justify-between items-start gap-3">
                      <CardTitle className="text-lg font-semibold text-foreground leading-tight">
                        {proj.name}
                      </CardTitle>
                      <Badge
                        className={cn(
                          'shrink-0 font-medium rounded-full px-2.5 shadow-none',
                          proj.status === 'active'
                            ? 'bg-secondary text-primary border-primary/20 hover:bg-secondary'
                            : 'bg-muted text-muted-foreground border-transparent',
                        )}
                        variant="outline"
                      >
                        {proj.status}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2 mt-2 text-sm leading-relaxed">
                      {proj.description}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="pt-0 pb-5 px-6">
                    <Button
                      asChild
                      variant="outline"
                      className="w-full border-border/60 hover:bg-secondary hover:text-primary transition-colors shadow-sm"
                    >
                      <Link to={`/project/${proj.id}`}>Acessar Projeto</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
              {projects.length === 0 && (
                <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 border border-dashed rounded-xl">
                  Nenhum projeto associado a este departamento.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: SECTORS */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Setores
            </h2>
          </div>

          <div className="space-y-4">
            {sectors.map((sector) => (
              <Card
                key={sector.id}
                className="border-border/40 hover:shadow-subtle transition-shadow overflow-hidden bg-card"
              >
                <div className="h-1 w-full bg-primary/20" />
                <CardHeader className="p-5 pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-base font-semibold text-foreground leading-tight">
                      {sector.name}
                    </CardTitle>
                    {sector.is_critical && (
                      <Badge
                        variant="destructive"
                        className="shrink-0 flex items-center gap-1 shadow-none bg-red-50 text-red-700 border-red-200 hover:bg-red-50"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Crítico
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <div className="flex flex-col gap-3 mt-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Bed className="w-4 h-4" /> Capacidade
                      </span>
                      <span className="font-medium text-foreground">
                        {sector.bed_capacity || 0} leitos
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Users className="w-4 h-4" /> Equipe Ideal
                      </span>
                      <span className="font-medium text-foreground">
                        {sector.ideal_staffing || 0} prof.
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Equipe Mínima
                      </span>
                      <span className="font-medium text-foreground">
                        {sector.min_staffing || 0} prof.
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {sectors.length === 0 && (
              <div className="py-12 text-center text-muted-foreground bg-muted/20 border border-dashed rounded-xl">
                Nenhum setor registrado.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
