import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useParams, Link } from 'react-router-dom'
import { RECENT_HISTORY } from '@/lib/mock-data'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
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
import { ArrowLeft, Play, History, BrainCircuit, Folder, Blocks } from 'lucide-react'
import { useRealtime } from '@/hooks/use-realtime'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

export default function Department() {
  const { id } = useParams()
  const [department, setDepartment] = useState<any>(null)
  const [departmentTools, setDepartmentTools] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])

  useEffect(() => {
    if (id) {
      pb.collection('departments').getOne(id).then(setDepartment).catch(console.error)

      pb.collection('ia_tools')
        .getFullList({ sort: 'name' })
        .then(setDepartmentTools)
        .catch(console.error)

      pb.collection('projects')
        .getFullList({ filter: `department="${id}"`, sort: 'sort_order,name' })
        .then(setProjects)
        .catch(console.error)
    }
  }, [id])

  useRealtime('projects', () => {
    if (id) {
      pb.collection('projects')
        .getFullList({ filter: `department="${id}"`, sort: 'sort_order,name' })
        .then(setProjects)
        .catch(console.error)
    }
  })

  if (!department) return null

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-7xl animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="shrink-0 bg-white">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl hidden sm:block bg-blue-100 text-blue-700">
            <Folder className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{department.name}</h1>
            <p className="text-muted-foreground">{department.description}</p>
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b pb-2">
          <BrainCircuit className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Modelos Disponíveis</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
                      'bg-slate-50 uppercase text-[10px]',
                      tool.status === 'active'
                        ? 'text-primary border-primary/20'
                        : 'text-amber-600 border-amber-200',
                    )}
                  >
                    {tool.status === 'active' ? 'Ativo' : tool.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono bg-slate-100 px-2 py-0.5 rounded">
                    {tool.model_alias}
                  </span>
                </div>
                <CardTitle className="text-xl">{tool.name}</CardTitle>
                <CardDescription className="line-clamp-2 h-10">{tool.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Uso nos últimos 7 dias
                  </p>
                  <div className="h-[80px] w-full mt-2">
                    <ChartContainer
                      config={{ calls: { label: 'Interações', color: 'hsl(var(--primary))' } }}
                      className="h-full w-full"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={
                            tool.usageData || [
                              { day: 'Seg', calls: 10 },
                              { day: 'Ter', calls: 15 },
                              { day: 'Qua', calls: 8 },
                              { day: 'Qui', calls: 20 },
                              { day: 'Sex', calls: 25 },
                              { day: 'Sab', calls: 5 },
                              { day: 'Dom', calls: 2 },
                            ]
                          }
                          margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                        >
                          <XAxis dataKey="day" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis fontSize={10} tickLine={false} axisLine={false} hide />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar
                            dataKey="calls"
                            fill="var(--color-calls)"
                            radius={[2, 2, 0, 0]}
                            opacity={0.8}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-4 border-t bg-slate-50/50">
                <Button className="w-full gap-2 font-medium" asChild>
                  <Link to={(tool as any).path || `/ai/${tool.id}`}>
                    <Play className="h-4 w-4" fill="currentColor" />
                    Acessar Ferramenta
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      {/* History Table */}
      {/* Projects Grid */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2 border-b pb-2">
          <Blocks className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Projetos</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200',
                    )}
                  >
                    {proj.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{proj.name}</CardTitle>
                <CardDescription className="line-clamp-2 h-10 mt-1">
                  {proj.description || 'Sem descrição'}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2 border-t bg-slate-50/50 mt-auto">
                <Button className="w-full gap-2 font-medium" variant="secondary" asChild>
                  <Link to={`/dashboard`}>Acessar Projeto</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
          {projects.length === 0 && (
            <div className="col-span-full p-8 text-center text-muted-foreground border rounded-lg bg-slate-50">
              Nenhum projeto associado a este departamento.
            </div>
          )}
        </div>
      </div>

      {/* History Table */}
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
