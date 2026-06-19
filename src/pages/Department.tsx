import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useParams, Link } from 'react-router-dom'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
  CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Play,
  BrainCircuit,
  Folder,
  Blocks,
  Building2,
  Users,
  AlertCircle,
} from 'lucide-react'
import { useRealtime } from '@/hooks/use-realtime'
import { getIcon } from '@/lib/icons'
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
    <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-7xl animate-fade-in-up">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="shrink-0 bg-white">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div
            className="p-3 rounded-xl hidden sm:flex items-center justify-center text-white"
            style={{ backgroundColor: department.color || '#0f172a' }}
          >
            {getIcon(department.icon, <Folder className="h-6 w-6" />)}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{department.name}</h1>
            <p className="text-muted-foreground">{department.description}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2 border-b pb-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Setores do Departamento</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {sectors.map((sector) => (
            <Card
              key={sector.id}
              className={cn(
                'bg-white border-slate-200 hover:shadow-md transition-shadow flex flex-col h-full',
                sector.is_critical && 'border-red-200 shadow-sm shadow-red-100',
              )}
            >
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-2">
                  <Badge
                    variant={sector.is_critical ? 'destructive' : 'secondary'}
                    className={cn(
                      'flex items-center gap-1',
                      sector.is_critical
                        ? 'bg-red-100 text-red-700 hover:bg-red-200 border-transparent'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-transparent',
                    )}
                  >
                    {sector.is_critical && <AlertCircle className="w-3 h-3" />}
                    {sector.is_critical ? 'Crítico' : 'Normal'}
                  </Badge>
                  <div className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                    Ratio: {sector.staffing_ratio || 0}
                  </div>
                </div>
                <CardTitle className="text-lg">{sector.name}</CardTitle>
                <CardDescription className="flex items-center gap-1 mt-1">
                  <Users className="w-4 h-4" />
                  Capacidade: {sector.bed_capacity || 0} leitos
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Staff Mínimo
                    </p>
                    <p className="text-2xl font-bold text-slate-700">{sector.min_staffing || 0}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Staff Ideal
                    </p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {sector.ideal_staffing || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {sectors.length === 0 && (
            <div className="col-span-full p-8 text-center text-muted-foreground border rounded-lg bg-slate-50 flex flex-col items-center justify-center">
              <Building2 className="h-10 w-10 text-slate-300 mb-3" />
              <p>Nenhum setor associado a este departamento.</p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2 border-b pb-2">
          <BrainCircuit className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Modelos Disponíveis</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
          {departmentTools.map((tool) => (
            <Card
              key={tool.id}
              className="flex flex-col bg-white border-slate-200 overflow-hidden hover:shadow-md transition-shadow h-full"
            >
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'uppercase text-[10px]',
                      tool.status === 'active'
                        ? 'bg-primary/5 text-primary border-primary/20'
                        : 'bg-amber-50 text-amber-700 border-amber-200',
                    )}
                  >
                    {tool.status === 'active' ? 'Ativo' : tool.status}
                  </Badge>
                  <div className="flex gap-2">
                    {tool.version && (
                      <span className="text-xs text-muted-foreground font-mono bg-slate-100 px-2 py-0.5 rounded">
                        v{tool.version}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground font-mono bg-slate-100 px-2 py-0.5 rounded">
                      {tool.model_alias}
                    </span>
                  </div>
                </div>
                <CardTitle className="text-xl">{tool.name}</CardTitle>
                <CardDescription className="line-clamp-2 mt-1">
                  {tool.description || 'Sem descrição'}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-4 border-t bg-slate-50/50 mt-auto flex justify-start">
                <Button className="gap-2 font-medium" asChild>
                  <Link to={(tool as any).path || `/ai/${tool.id}`}>
                    <Play className="h-4 w-4" fill="currentColor" />
                    Acessar Ferramenta
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
          {departmentTools.length === 0 && (
            <div className="col-span-full p-8 text-center text-muted-foreground border rounded-lg bg-slate-50">
              Nenhuma ferramenta associada.
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2 border-b pb-2">
          <Blocks className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Projetos</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {projects.map((proj) => (
            <Card
              key={proj.id}
              className="flex flex-col bg-white border-slate-200 overflow-hidden hover:shadow-md transition-shadow h-full"
            >
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'uppercase text-[10px]',
                      proj.status === 'active'
                        ? 'bg-primary/5 text-primary border-primary/20'
                        : 'bg-amber-50 text-amber-700 border-amber-200',
                    )}
                  >
                    {proj.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{proj.name}</CardTitle>
                <CardDescription className="line-clamp-2 mt-1">
                  {proj.description || 'Sem descrição'}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-3 border-t bg-slate-50/50 mt-auto flex justify-start">
                <Button className="gap-2 font-medium" variant="secondary" asChild>
                  <Link to={`/project/${proj.id}`}>Acessar Projeto</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
          {projects.length === 0 && (
            <div className="col-span-full p-8 text-center text-muted-foreground border rounded-lg bg-slate-50">
              Nenhum projeto associado.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
