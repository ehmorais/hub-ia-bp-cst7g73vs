import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, Circle, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ToolStatus {
  id: string
  name: string
  status: string
  checkStatus: 'pending' | 'checking' | 'success' | 'error'
}

export default function SystemCheck() {
  const [tools, setTools] = useState<ToolStatus[]>([])
  const [globalStatus, setGlobalStatus] = useState<'loading' | 'checking' | 'all-go' | 'error'>(
    'loading',
  )
  const [progress, setProgress] = useState(0)
  const [finished, setFinished] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    async function initCheck() {
      try {
        const records = await pb.collection('ia_tools').getFullList({
          sort: 'name',
        })
        if (records.length === 0) {
          setTools([])
          setGlobalStatus('all-go')
          setTimeout(() => redirectAfterSuccess(), 1500)
          return
        }

        const mapped = records.map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          checkStatus: 'pending' as const,
        }))
        setTools(mapped)
        setGlobalStatus('checking')
      } catch (error) {
        setGlobalStatus('error')
      }
    }
    initCheck()
  }, [])

  useEffect(() => {
    if (globalStatus !== 'checking' || tools.length === 0) return

    let currentIdx = 0

    const interval = setInterval(() => {
      setTools((prev) => {
        const next = [...prev]

        if (currentIdx > 0 && currentIdx <= next.length) {
          const prevTool = next[currentIdx - 1]
          prevTool.checkStatus = prevTool.status === 'active' ? 'success' : 'error'
        }

        if (currentIdx < next.length) {
          next[currentIdx].checkStatus = 'checking'
        }

        return next
      })

      setProgress(Math.round(((currentIdx + 1) / tools.length) * 100))

      if (currentIdx >= tools.length) {
        clearInterval(interval)
        setFinished(true)
      }

      currentIdx++
    }, 400)

    return () => clearInterval(interval)
  }, [globalStatus, tools.length])

  useEffect(() => {
    if (finished) {
      const hasError = tools.some((t) => t.status !== 'active')
      setGlobalStatus(hasError ? 'error' : 'all-go')

      if (!hasError) {
        const timer = setTimeout(() => {
          redirectAfterSuccess()
        }, 1500)
        return () => clearTimeout(timer)
      }
    }
  }, [finished])

  async function redirectAfterSuccess() {
    try {
      const depts = await pb.collection('departments').getFullList({
        filter: 'name ~ "Projetos Gerais"',
      })
      if (depts.length > 0) {
        navigate(`/department/${depts[0].id}`)
      } else {
        navigate('/')
      }
    } catch {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold text-primary tracking-tight">
            HUB IA BPSCS
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Verificação de Sistemas</p>
        </CardHeader>
        <CardContent className="space-y-6 mt-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Progresso</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {tools.map((tool) => (
              <div
                key={tool.id}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-100/50"
              >
                <span className="text-sm font-medium text-slate-700">{tool.name}</span>
                <div className="flex items-center">
                  {tool.checkStatus === 'pending' && <Circle className="h-5 w-5 text-slate-300" />}
                  {tool.checkStatus === 'checking' && (
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  )}
                  {tool.checkStatus === 'success' && (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  )}
                  {tool.checkStatus === 'error' && (
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 text-center min-h-[100px] flex items-center justify-center">
            {globalStatus === 'loading' && (
              <p className="text-sm text-slate-500">Iniciando verificação...</p>
            )}
            {globalStatus === 'checking' && (
              <p className="text-sm text-primary font-medium animate-pulse">
                Verificando ferramentas de IA...
              </p>
            )}

            {globalStatus === 'all-go' && (
              <div className="flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-primary/10 p-2 rounded-full">
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                </div>
                <p className="text-lg font-bold text-primary">All Systems Go</p>
                <p className="text-sm text-primary/80">Redirecionando para o painel...</p>
              </div>
            )}

            {globalStatus === 'error' && (
              <div className="flex flex-col items-center gap-3 animate-in fade-in duration-500 w-full">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="h-6 w-6" />
                  <p className="text-base font-bold">Atenção Necessária</p>
                </div>
                <p className="text-sm text-amber-600/80">
                  Algumas ferramentas não estão ativas no momento.
                </p>
                <Button onClick={() => redirectAfterSuccess()} className="mt-2 w-full">
                  Continuar para o Dashboard
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
