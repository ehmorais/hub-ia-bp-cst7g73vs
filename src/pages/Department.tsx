import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useParams, Link } from 'react-router-dom'
import { RECENT_HISTORY } from '@/lib/mock-data'
import { Card, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Play, History, BrainCircuit, Folder, Blocks, Building2 } from 'lucide-react'
import { useRealtime } from '@/hooks/use-realtime'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
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
          <div className="p-3 rounded-xl hidden sm:block bg-primary/10 text-primary">
            <Folder className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{department.name}</h1>
            <p className="text-muted-foreground">{department.description}</p>
          </div>
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
              className="flex flex-col bg-white border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
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
              className="flex flex-col bg-white border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
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

      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2 border-b pb-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Setores do Departamento</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {sectors.map((sector) => (
            <Card
              key={sector.id}
              className="bg-white border-slate-200 hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start mb-2">
                  <Badge
                    variant="outline"
                    className={
                      sector.is_critical
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }
                  >
                    {sector.is_critical ? 'Crítico' : 'Normal'}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{sector.name}</CardTitle>
                <CardDescription>Capacidade: {sector.bed_capacity || 0} leitos</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Staff Mínimo:</span>
                  <span className="font-medium">{sector.min_staffing || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Staff Ideal:</span>
                  <span className="font-medium">{sector.ideal_staffing || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ratio:</span>
                  <span className="font-medium">{sector.staffing_ratio || 0}</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {sectors.length === 0 && (
            <div className="col-span-full p-8 text-center text-muted-foreground border rounded-lg bg-slate-50">
              Nenhum setor associado.
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2 border-b pb-2">
          <History className="h-5 w-5 text-slate-500" />
          <h2 className="text-xl font-semibold">Histórico Recente</h2>
        </div>
        <Card className="border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="w-[180px]">Data e Hora</TableHead>
                <TableHead className="w-[250px]">Ferramenta</TableHead>
                <TableHead>Resumo do Contexto</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RECENT_HISTORY.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm font-medium text-slate-600">
                    {format(new Date(item.date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal bg-slate-100">
                      {item.tool}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600 truncate max-w-[300px]">
                    {item.summary}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary hover:bg-primary/10"
                    >
                      Ver Detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
