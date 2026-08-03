import { useEffect, useState, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Loader2, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { setChecklistCompleted } from '@/lib/checklist-state'

interface CheckItem {
  id: string
  label: string
  description: string
  status: 'pass' | 'fail' | 'loading'
}

const INITIAL_CHECKS: CheckItem[] = [
  {
    id: 'db',
    label: 'Conectividade do Banco de Dados',
    description: 'Verifica se o banco de dados está acessível',
    status: 'loading',
  },
  {
    id: 'tools',
    label: 'Ferramentas de IA Ativas',
    description: 'Verifica se existem ferramentas de IA ativas',
    status: 'loading',
  },
  {
    id: 'cycles',
    label: 'Ciclos de Escala Ativos',
    description: 'Verifica se existem ciclos de escala ativos',
    status: 'loading',
  },
  {
    id: 'users',
    label: 'Coleção de Usuários',
    description: 'Verifica se a coleção de usuários está acessível',
    status: 'loading',
  },
  {
    id: 'contracts',
    label: 'Contratos de Staff',
    description: 'Verifica se a coleção de contratos está acessível',
    status: 'loading',
  },
  {
    id: 'departments',
    label: 'Departamentos',
    description: 'Verifica se a coleção de departamentos está acessível',
    status: 'loading',
  },
  {
    id: 'projects',
    label: 'Projetos',
    description: 'Verifica se a coleção de projetos está acessível',
    status: 'loading',
  },
]

const CHECK_TIMEOUT_MS = 10000
const GLOBAL_TIMEOUT_MS = 15000
const REDIRECT_DELAY_MS = 1500

export function SystemChecklistGate({ onComplete }: { onComplete: () => void }) {
  const [checks, setChecks] = useState<CheckItem[]>(INITIAL_CHECKS)
  const [isRunning, setIsRunning] = useState(true)

  const updateCheck = useCallback((id: string, status: 'pass' | 'fail') => {
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))
  }, [])

  const runCheckWithFallback = useCallback(
    async (id: string, checkFn: () => Promise<boolean>) => {
      try {
        const result = await Promise.race([
          checkFn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS),
          ),
        ])
        updateCheck(id, result ? 'pass' : 'fail')
      } catch {
        updateCheck(id, 'fail')
      }
    },
    [updateCheck],
  )

  const runChecks = useCallback(async () => {
    setIsRunning(true)
    setChecks(INITIAL_CHECKS.map((c) => ({ ...c, status: 'loading' as const })))

    await Promise.allSettled([
      runCheckWithFallback('db', async () => {
        await pb.health.check()
        return true
      }),
      runCheckWithFallback('tools', async () => {
        const tools = await pb.collection('ia_tools').getList(1, 1, { filter: 'status = "active"' })
        return tools.items.length > 0
      }),
      runCheckWithFallback('cycles', async () => {
        const cycles = await pb
          .collection('shift_cycles')
          .getList(1, 1, { filter: 'status = "active"' })
        return cycles.items.length > 0
      }),
      runCheckWithFallback('users', async () => {
        await pb.collection('users').getList(1, 1)
        return true
      }),
      runCheckWithFallback('contracts', async () => {
        await pb.collection('staff_contracts').getList(1, 1)
        return true
      }),
      runCheckWithFallback('departments', async () => {
        await pb.collection('departments').getList(1, 1)
        return true
      }),
      runCheckWithFallback('projects', async () => {
        await pb.collection('projects').getList(1, 1)
        return true
      }),
    ])

    setIsRunning(false)
  }, [runCheckWithFallback])

  useEffect(() => {
    runChecks()
  }, [runChecks])

  useEffect(() => {
    const timer = setTimeout(() => {
      setChecks((prev) =>
        prev.map((c) => (c.status === 'loading' ? { ...c, status: 'fail' as const } : c)),
      )
      setIsRunning(false)
    }, GLOBAL_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [])

  const allPassed = checks.every((c) => c.status === 'pass')
  const anyLoading = checks.some((c) => c.status === 'loading')

  useEffect(() => {
    if (!isRunning && !anyLoading) {
      setChecklistCompleted()
      const timer = setTimeout(() => {
        onComplete()
      }, REDIRECT_DELAY_MS)
      return () => clearTimeout(timer)
    }
  }, [isRunning, anyLoading, onComplete])

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex items-center justify-center">
      <div className="max-w-3xl w-full space-y-6 animate-fade-in">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary flex items-center justify-center gap-2 font-heading">
            <ShieldCheck className="h-7 w-7" />
            All Systems Go
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verificação de integridade do sistema
          </p>
        </div>

        <Card
          className={cn(
            'border-t-[6px]',
            allPassed
              ? 'border-t-green-500'
              : anyLoading
                ? 'border-t-slate-300'
                : 'border-t-orange-500',
          )}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {allPassed ? (
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              ) : anyLoading ? (
                <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
              ) : (
                <XCircle className="h-6 w-6 text-orange-500" />
              )}
              Status do Sistema
            </CardTitle>
            <CardDescription>
              {allPassed
                ? 'Todos os sistemas estão operacionais.'
                : anyLoading
                  ? 'Verificando sistemas...'
                  : 'Alguns sistemas precisam de atenção.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {checks.map((check) => (
                <Badge
                  key={check.id}
                  variant="outline"
                  className={cn(
                    'text-xs',
                    check.status === 'pass'
                      ? 'text-green-600 border-green-200 bg-green-50'
                      : check.status === 'fail'
                        ? 'text-orange-600 border-orange-200 bg-orange-50'
                        : 'text-slate-500 border-slate-200 bg-slate-50',
                  )}
                >
                  {check.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {checks.map((check) => (
            <Card key={check.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {check.status === 'pass' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  ) : check.status === 'fail' ? (
                    <XCircle className="h-5 w-5 text-orange-500 shrink-0" />
                  ) : (
                    <Loader2 className="h-5 w-5 text-slate-400 animate-spin shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-slate-800">{check.label}</p>
                    <p className="text-xs text-muted-foreground">{check.description}</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    check.status === 'pass'
                      ? 'text-green-600 border-green-200 bg-green-50'
                      : check.status === 'fail'
                        ? 'text-orange-600 border-orange-200 bg-orange-50'
                        : 'text-slate-500 border-slate-200 bg-slate-50',
                  )}
                >
                  {check.status === 'pass' ? 'OK' : check.status === 'fail' ? 'Atenção' : '...'}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
