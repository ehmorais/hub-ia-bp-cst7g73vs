import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Blocks } from 'lucide-react'
import { useRealtime } from '@/hooks/use-realtime'
import { EscalasManagement } from '@/components/EscalasManagement'

export default function Project() {
  const { id } = useParams()
  const [project, setProject] = useState<any>(null)

  useEffect(() => {
    if (id) {
      pb.collection('projects')
        .getOne(id, { expand: 'department,associated_departments,members' })
        .then(setProject)
        .catch((e) => console.error('Error loading project:', e))
    }
  }, [id])

  useRealtime('projects', () => {
    if (id) {
      pb.collection('projects')
        .getOne(id, { expand: 'department,associated_departments,members' })
        .then(setProject)
        .catch((e) => console.error('Error on projects realtime:', e))
    }
  })

  if (!project) return null

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-7xl animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-4 border-b pb-4">
        <Button variant="outline" size="icon" asChild className="shrink-0 bg-white">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl hidden sm:block bg-blue-100 text-blue-700">
            <Blocks className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{project.name}</h1>
            <p className="text-muted-foreground">{project.description || 'Sem descrição'}</p>
          </div>
        </div>
      </div>

      <EscalasManagement projectId={project.id} departmentId={project.department} />
    </div>
  )
}
