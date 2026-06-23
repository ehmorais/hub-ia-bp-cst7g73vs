import { Component, ReactNode, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useParams, Link, Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Blocks, AlertCircle } from 'lucide-react'
import { useRealtime } from '@/hooks/use-realtime'
import { EscalasManagement } from '@/components/EscalasManagement'

class ProjectErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Project ErrorBoundary caught an error', error, errorInfo)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-7xl animate-fade-in-up">
          <div className="p-8 text-center border rounded-lg bg-red-50 border-red-200 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-red-700">Erro Inesperado no Projeto</h2>
            <p className="text-red-600 max-w-md mb-6">Ocorreu um problema ao exibir os dados.</p>
            <Button
              variant="outline"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="border-red-200 text-red-700 hover:bg-red-100"
            >
              Tentar Novamente
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function ProjectContent() {
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

      {project.name === 'Gestão de Escalas' ? (
        <EscalasManagement />
      ) : (
        <div className="p-8 text-center border rounded-lg bg-white shadow-sm flex flex-col items-center justify-center min-h-[300px]">
          <Blocks className="h-12 w-12 text-slate-300 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Detalhes do Projeto</h2>
          <p className="text-muted-foreground max-w-md">
            O conteúdo específico deste projeto será disponibilizado em breve.
          </p>
        </div>
      )}
    </div>
  )
}

export default function Project() {
  return (
    <ProjectErrorBoundary>
      <ProjectContent />
    </ProjectErrorBoundary>
  )
}
