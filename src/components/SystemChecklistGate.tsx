import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CheckItem, INITIAL_CHECKS, runSystemChecks } from '@/lib/system-checks'

interface SystemChecklistGateProps {
  onComplete: () => void
}

export function SystemChecklistGate({ onComplete }: SystemChecklistGateProps) {
  const [checks, setChecks] = useState<CheckItem[]>(INITIAL_CHECKS)
  const [isRunning, setIsRunning] = useState(true)
  const navigate = useNavigate()

  const updateCheck = useCallback((id: string, status: 'pass' | 'fail', message?: string) => {
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, status, message } : c)))
  }, [])

  const runChecks = useCallback(async () => {
    setIsRunning(true)
    setChecks(INITIAL_CHECKS.map((c) => ({ ...c, status: 'loading' as const })))
    await runSystemChecks(updateCheck)
    setIsRunning(false)
  }, [updateCheck])

  useEffect(() => {
    runChecks()
  }, [runChecks])

  const allResolved = checks.every((c) => c.status !== 'loading')
  const allPassed = checks.every((c) => c.status === 'pass')

  const handleEnter = () => {
    onComplete()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#06402B]/10">
            <ShieldCheck className="h-8 w-8 text-[#06402B]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Verificação do Sistema
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {isRunning
                ? 'Verificando sistemas...'
                : allResolved
                  ? 'Verificação concluída.'
                  : 'Alguns sistemas precisam de atenção.'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {checks.map((check) => (
            <div
              key={check.id}
              className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-white border border-slate-100 shadow-sm transition-all duration-300"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2.5">
                  {check.status === 'pass' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : check.status === 'fail' ? (
                    <XCircle className="h-4 w-4 text-orange-500 shrink-0" />
                  ) : (
                    <Loader2 className="h-4 w-4 text-slate-400 animate-spin shrink-0" />
                  )}
                  <span className="text-sm font-medium text-slate-700">{check.label}</span>
                </div>
                {check.message && check.status === 'fail' && (
                  <span className="text-xs text-orange-500 ml-7 line-clamp-2">{check.message}</span>
                )}
              </div>
              <span
                className={cn(
                  'text-xs font-semibold whitespace-nowrap ml-2',
                  check.status === 'pass'
                    ? 'text-green-600'
                    : check.status === 'fail'
                      ? 'text-orange-600'
                      : 'text-slate-400',
                )}
              >
                {check.status === 'pass'
                  ? 'OK'
                  : check.status === 'fail'
                    ? check.message
                      ? 'Atenção justificada'
                      : 'Atenção'
                    : 'Verificando...'}
              </span>
            </div>
          ))}
        </div>

        {allResolved && (
          <div className="animate-fade-in-up space-y-4">
            <p className="text-center text-sm text-slate-600">
              {allPassed
                ? 'Todos os sistemas estão operacionais.'
                : 'Alguns itens precisam de atenção, mas você pode continuar acessando o portal.'}
            </p>
            <Button
              onClick={handleEnter}
              className="w-full bg-[#06402B] hover:bg-[#06402B]/90 text-white font-medium h-12 text-base rounded-lg shadow-sm transition-all"
              size="lg"
            >
              Acessar o Portal
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
