import { useEffect, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CheckItem, INITIAL_CHECKS, runSystemChecks } from '@/lib/system-checks'

interface SystemChecklistModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SystemChecklistModal({ open, onOpenChange }: SystemChecklistModalProps) {
  const [checks, setChecks] = useState<CheckItem[]>(INITIAL_CHECKS)
  const [isRunning, setIsRunning] = useState(false)

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
    if (open) {
      runChecks()
    }
  }, [open, runChecks])

  const allPassed = checks.every((c) => c.status === 'pass')
  const anyLoading = checks.some((c) => c.status === 'loading')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {allPassed ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : anyLoading ? (
              <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
            ) : (
              <XCircle className="h-5 w-5 text-orange-500" />
            )}
            Verificação do Sistema
          </DialogTitle>
          <DialogDescription>
            {allPassed
              ? 'Todos os sistemas estão operacionais.'
              : anyLoading
                ? 'Verificando sistemas...'
                : 'Alguns sistemas precisam de atenção.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {checks.map((check) => (
            <div
              key={check.id}
              className="flex items-center justify-between py-2 px-3 rounded-md bg-slate-50 border border-slate-100"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
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
                  <span className="text-xs text-orange-500 ml-6 line-clamp-2">{check.message}</span>
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
                    : '...'}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={runChecks}
            disabled={isRunning}
            className="gap-2"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRunning && 'animate-spin')} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
