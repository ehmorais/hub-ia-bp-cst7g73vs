import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Circle, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SystemItem {
  id: string
  name: string
  type: 'project' | 'tool'
  checkStatus: 'pending' | 'checking' | 'success' | 'error'
}

export default function SystemCheck() {
  const [items, setItems] = useState<SystemItem[]>([])
  const [globalStatus, setGlobalStatus] = useState<'loading' | 'checking' | 'all-go' | 'error'>(
    'loading',
  )
  const [finished, setFinished] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const from = location.state?.from || '/'

  useEffect(() => {
    async function initCheck() {
      try {
        const [toolsRecords, projectsRecords] = await Promise.all([
          pb.collection('ia_tools').getFullList({ sort: 'name' }),
          pb.collection('projects').getFullList({ sort: 'name' }),
        ])

        const mappedProjects = projectsRecords.map((r) => ({
          id: r.id,
          name: r.name,
          type: 'project' as const,
          checkStatus: 'pending' as const,
        }))

        const mappedTools = toolsRecords.map((r) => ({
          id: r.id,
          name: r.name,
          type: 'tool' as const,
          checkStatus: 'pending' as const,
        }))

        const combined = [...mappedProjects, ...mappedTools]

        if (combined.length === 0) {
          setItems([])
          setGlobalStatus('all-go')
          setFinished(true)
          return
        }

        setItems(combined)
        setGlobalStatus('checking')
      } catch (error) {
        setGlobalStatus('error')
      }
    }
    initCheck()
  }, [])

  useEffect(() => {
    if (globalStatus !== 'checking' || items.length === 0) return

    let currentIdx = 0

    const interval = setInterval(() => {
      setItems((prev) => {
        const next = [...prev]

        if (currentIdx > 0 && currentIdx <= next.length) {
          const prevItem = next[currentIdx - 1]
          prevItem.checkStatus = 'success'
        }

        if (currentIdx < next.length) {
          next[currentIdx].checkStatus = 'checking'
        }

        return next
      })

      if (currentIdx >= items.length) {
        clearInterval(interval)
        setFinished(true)
      }

      currentIdx++
    }, 300) // Delay for visual effect

    return () => clearInterval(interval)
  }, [globalStatus, items.length])

  useEffect(() => {
    if (finished && globalStatus !== 'error') {
      setGlobalStatus('all-go')
    }
  }, [finished, globalStatus])

  async function handleProceed() {
    try {
      if (from === '/') {
        const depts = await pb.collection('departments').getFullList({
          filter: 'name ~ "Projetos Gerais"',
        })
        if (depts.length > 0) {
          navigate(`/department/${depts[0].id}`, { replace: true })
          return
        }
      }
      navigate(from, { replace: true })
    } catch {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      <Card className="w-full max-w-lg shadow-xl border-[#06402B]/10 rounded-xl overflow-hidden">
        <CardHeader className="text-center pb-5 bg-white border-b border-slate-100">
          <CardTitle className="text-2xl font-bold tracking-tight text-[#06402B]">
            All Systems Go
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1">Verificação de Integridade dos Sistemas</p>
        </CardHeader>

        <CardContent className="p-0">
          <div className="p-6 max-h-[50vh] overflow-y-auto space-y-4 bg-slate-50/50">
            {globalStatus === 'loading' && (
              <div className="flex items-center space-x-2 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Estabelecendo conexão...</span>
              </div>
            )}

            {items.map((item, idx) => (
              <div
                key={`${item.type}-${item.id}`}
                className={`flex justify-between items-center transition-all duration-300 ${
                  item.checkStatus === 'pending' ? 'opacity-40' : 'opacity-100'
                }`}
              >
                <div className="flex items-center space-x-3 overflow-hidden pr-2">
                  {item.checkStatus === 'pending' && (
                    <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  )}
                  {item.checkStatus === 'checking' && (
                    <Loader2 className="w-4 h-4 text-[#06402B] animate-spin flex-shrink-0" />
                  )}
                  {item.checkStatus === 'success' && (
                    <CheckCircle2 className="w-4 h-4 text-[#06402B] flex-shrink-0" />
                  )}
                  {item.checkStatus === 'error' && (
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  )}
                  <span
                    className={`text-sm font-medium truncate ${item.checkStatus === 'success' ? 'text-[#06402B]' : 'text-slate-600'}`}
                  >
                    {item.name}
                  </span>
                </div>

                <div className="font-bold text-sm whitespace-nowrap flex-shrink-0">
                  {item.checkStatus === 'checking' && (
                    <span className="text-slate-400 animate-pulse">verificando</span>
                  )}
                  {item.checkStatus === 'success' && <span className="text-[#06402B]">... Go</span>}
                  {item.checkStatus === 'error' && <span className="text-red-500">... Fail</span>}
                </div>
              </div>
            ))}

            {globalStatus === 'all-go' && (
              <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-700">
                <div className="bg-[#06402B]/10 p-3 rounded-full mb-4">
                  <CheckCircle2 className="w-8 h-8 text-[#06402B]" />
                </div>
                <p className="text-xl font-bold text-[#06402B] tracking-tight">
                  We are Go for Launch
                </p>
              </div>
            )}

            {globalStatus === 'error' && (
              <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col items-center animate-in fade-in">
                <div className="bg-red-100 p-3 rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <p className="text-xl font-bold text-red-600 tracking-tight">System Check Failed</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-white flex justify-center border-t border-slate-100">
            {globalStatus === 'all-go' ? (
              <Button
                onClick={handleProceed}
                className="w-full bg-[#06402B] hover:bg-[#06402B]/90 text-white font-medium h-11 text-base transition-all shadow-sm"
              >
                Proceed
              </Button>
            ) : (
              <Button
                disabled
                variant="outline"
                className="w-full h-11 text-base text-slate-400 border-slate-200"
              >
                {globalStatus === 'error' ? 'Launch Aborted' : 'Awaiting Go...'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
