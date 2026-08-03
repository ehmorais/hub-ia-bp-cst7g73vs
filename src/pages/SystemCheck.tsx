import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2, RefreshCw, ArrowLeft, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

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
    description: 'Verifica se existem ferramentas de IA ativas no sistema',
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

export default function SystemCheck() {
  const [checks, setChecks] = useState<CheckItem[]>(INITIAL_CHECKS)
  const [isRunning, setIsRunning] = useState(false)

  const updateCheck = useCallback((id: string, status: 'pass' | 'fail') => {
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))
  }, [])

  const runChecks = useCallback(async () => {
    setIsRunning(true)
    setChecks(INITIAL_CHECKS.map((c) => ({ ...c, status: 'loading' as const })))

    try {
      await pb.health.check()
      updateCheck('db', 'pass')
    } catch (err) {
      console.error('[SystemCheck] DB health check failed:', err)
      updateCheck('db', 'fail')
    }

    try {
      const tools = await pb.collection('ia_tools').getList(1, 1, { filter: 'status = "active"' })
      updateCheck('tools', tools.items.length > 0 ? 'pass' : 'fail')
    } catch (err) {
      console.error('[SystemCheck] IA tools check failed:', err)
      updateCheck('tools', 'fail')
    }

    try {
      const cycles = await pb
        .collection('shift_cycles')
        .getList(1, 1, { filter: 'status = "active"' })
      updateCheck('cycles', cycles.items.length > 0 ? 'pass' : 'fail')
    } catch (err) {
      console.error('[SystemCheck] Shift cycles check failed:', err)
      updateCheck('cycles', 'fail')
    }

    try {
      await pb.collection('users').getList(1, 1)
      updateCheck('users', 'pass')
    } catch (err) {
      console.error('[SystemCheck] Users check failed:', err)
      updateCheck('users', 'fail')
    }

    try {
      await pb.collection('staff_contracts').getList(1, 1)
      updateCheck('contracts', 'pass')
    } catch (err) {
      console.error('[SystemCheck] Staff contracts check failed:', err)
      updateCheck('contracts', 'fail')
    }

    try {
      await pb.collection('departments').getList(1, 1)
      updateCheck('departments', 'pass')
    } catch (err) {
      console.error('[SystemCheck] Departments check failed:', err)
      updateCheck('departments', 'fail')
    }

    try {
      await pb.collection('projects').getList(1, 1)
      updateCheck('projects', 'pass')
    } catch (err) {
      console.error('[SystemCheck] Projects check failed:', err)
      updateCheck('projects', 'fail')
    }

    setIsRunning(false)
  }, [updateCheck])

  useEffect(() => {
    runChecks()
  }, [runChecks])

  const allPassed = checks.every((c) => c.status === 'pass')
  const anyLoading = checks.some((c) => c.status === 'loading')

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-primary flex items-center gap-2 font-heading">
                <ShieldCheck className="h-7 w-7" />
                All Systems Go
              </h1>
              <p className="text-sm text-muted-foreground">Verificação de integridade do sistema</p>
            </div>
          </div>
          <Button onClick={runChecks} disabled={isRunning} variant="outline" className="gap-2">
            <RefreshCw className={cn('h-4 w-4', isRunning && 'animate-spin')} />
            Atualizar
          </Button>
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
