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
  ChevronRight,
  Bed,
  AlertTriangle,
} from 'lucide-react'

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
    <div className="space-y-8 animate-in fade-in duration-500 pb-8 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="bg-primary/5 rounded-2xl p-6 md:p-8 border border-primary/10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Activity className="w-48 h-48 text-primary" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="outline"
              size="icon"
              asChild
              className="bg-background/80 backdrop-blur border-primary/20 hover:bg-primary/10 text-primary shrink-0"
            >
              <Link to="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-primary tracking-tight">
                {department.name}
              </h1>
              <p className="text-muted-foreground mt-2 text-lg max-w-3xl leading-relaxed">
                {department.description}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-6">
            <Badge
              variant="secondary"
              className="bg-background/80 backdrop-blur px-3 py-1.5 text-sm font-medium border-primary/10 text-foreground"
            >
              <Users className="w-4 h-4 mr-2 text-primary" />
              {sectors.length} Setores
            </Badge>
            <Badge
              variant="secondary"
              className="bg-background/80 backdrop-blur px-3 py-1.5 text-sm font-medium border-primary/10 text-foreground"
            >
              <Cpu className="w-4 h-4 mr-2 text-primary" />
              {departmentTools.length} Modelos de IA
            </Badge>
            <Badge
              variant="secondary"
              className="bg-background/80 backdrop-blur px-3 py-1.5 text-sm font-medium border-primary/10 text-foreground"
            >
              <FolderKanban className="w-4 h-4 mr-2 text-primary" />
              {projects.length} Projetos
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* LEFT COLUMN: IA TOOLS & PROJECTS */}
        <div className="xl:col-span-2 space-y-8">
          {/* IA TOOLS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-primary tracking-tight">
                  Modelos Disponíveis
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {departmentTools.map((tool) => (
                <Card
                  key={tool.id}
                  className="group hover:shadow-md transition-all duration-200 border-primary/10 flex flex-col"
                >
                  <CardHeader className="pb-3 flex-1">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {tool.name}
                      </CardTitle>
                      <Badge
                        className={
                          tool.status === 'active'
                            ? 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary shadow-none shrink-0'
                            : 'shrink-0'
                        }
                        variant={tool.status === 'active' ? 'outline' : 'secondary'}
                      >
                        {tool.status}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2 mt-1 text-sm">
                      {tool.description}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="pt-0">
                    <Button
                      asChild
                      className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                      variant={tool.status === 'active' ? 'default' : 'secondary'}
                    >
                      <Link to={(tool as any).path || `/ai/${tool.id}`}>
                        Acessar Ferramenta
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
              {departmentTools.length === 0 && (
                <div className="col-span-full p-8 text-center text-muted-foreground bg-muted/30 border border-dashed rounded-xl">
                  Nenhuma ferramenta de IA associada a este departamento.
                </div>
              )}
            </div>
          </div>

          {/* PROJECTS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-primary tracking-tight">
                  Projetos em Andamento
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((proj) => (
                <Card
                  key={proj.id}
                  className="group hover:shadow-md transition-all duration-200 flex flex-col"
                >
                  <CardHeader className="pb-3 flex-1">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {proj.name}
                      </CardTitle>
                      <Badge
                        className={
                          proj.status === 'active'
                            ? 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary shadow-none shrink-0'
                            : 'shrink-0'
                        }
                        variant={proj.status === 'active' ? 'outline' : 'secondary'}
                      >
                        {proj.status}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2 mt-1 text-sm">
                      {proj.description}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="pt-0">
                    <Button
                      asChild
                      variant="outline"
                      className="w-full border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors"
                    >
                      <Link to={`/project/${proj.id}`}>
                        Acessar Projeto
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
              {projects.length === 0 && (
                <div className="col-span-full p-8 text-center text-muted-foreground bg-muted/30 border border-dashed rounded-xl">
                  Nenhum projeto associado a este departamento.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SECTORS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-primary tracking-tight">Setores</h2>
            </div>
          </div>

          <div className="space-y-3">
            {sectors.map((sector) => (
              <Card
                key={sector.id}
                className="border-l-4 border-l-primary hover:shadow-md transition-shadow"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-base font-bold text-foreground leading-tight">
                      {sector.name}
                    </CardTitle>
                    {sector.is_critical && (
                      <Badge
                        variant="destructive"
                        className="shrink-0 flex items-center gap-1 shadow-none"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Crítico
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex flex-col gap-2 mt-3">
                    <div className="flex items-center justify-between text-sm border-b pb-1.5 border-border/50">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Bed className="w-4 h-4 text-primary/70" /> Capacidade
                      </span>
                      <span className="font-semibold text-foreground">
                        {sector.bed_capacity || 0} leitos
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm border-b pb-1.5 border-border/50">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-primary/70" /> Equipe Ideal
                      </span>
                      <span className="font-semibold text-foreground">
                        {sector.ideal_staffing || 0} prof.
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-primary/70" /> Equipe Mínima
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
              <div className="p-8 text-center text-muted-foreground bg-muted/30 border border-dashed rounded-xl">
                Nenhum setor registrado neste departamento.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
