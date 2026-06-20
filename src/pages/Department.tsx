import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useParams, Link } from 'react-router-dom'
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useRealtime } from '@/hooks/use-realtime'
import { ArrowLeft } from 'lucide-react'

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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-primary">{department.name}</h1>
          <p className="text-muted-foreground">{department.description}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-primary">Setores do Departamento</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sectors.map((sector) => (
            <Card key={sector.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{sector.name}</CardTitle>
                  {sector.is_critical && <Badge variant="destructive">Crítico</Badge>}
                </div>
                <CardDescription>Capacidade: {sector.bed_capacity || 0} leitos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  <p>Staff Mínimo: {sector.min_staffing || 0}</p>
                  <p>Staff Ideal: {sector.ideal_staffing || 0}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {sectors.length === 0 && (
            <div className="col-span-3 p-4 text-center text-muted-foreground border rounded-md">
              Nenhum setor associado.
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-primary">Modelos Disponíveis</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {departmentTools.map((tool) => (
            <Card key={tool.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{tool.name}</CardTitle>
                  <Badge
                    className={
                      tool.status === 'active'
                        ? 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary shadow-none'
                        : ''
                    }
                    variant={tool.status === 'active' ? 'outline' : 'secondary'}
                  >
                    {tool.status}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2">{tool.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="secondary" className="w-full">
                  <Link to={(tool as any).path || `/ai/${tool.id}`}>Acessar Ferramenta</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
          {departmentTools.length === 0 && (
            <div className="col-span-3 p-4 text-center text-muted-foreground border rounded-md">
              Nenhuma ferramenta associada.
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-primary">Projetos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {projects.map((proj) => (
            <Card key={proj.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{proj.name}</CardTitle>
                  <Badge
                    className={
                      proj.status === 'active'
                        ? 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary shadow-none'
                        : ''
                    }
                    variant={proj.status === 'active' ? 'outline' : 'secondary'}
                  >
                    {proj.status}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2">{proj.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link to={`/project/${proj.id}`}>Acessar Projeto</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
          {projects.length === 0 && (
            <div className="col-span-3 p-4 text-center text-muted-foreground border rounded-md">
              Nenhum projeto associado.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
