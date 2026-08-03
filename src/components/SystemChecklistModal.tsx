import { useEffect, useState, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
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

interface CheckItem {
  id: string
  label: string
  status: 'pass' | 'fail' | 'loading'
}

interface SystemChecklistModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const INITIAL_CHECKS: CheckItem[] = [
  { id: 'db', label: 'Banco de Dados', status: 'loading' },
  { id: 'tools', label: 'Ferramentas de IA', status: 'loading' },
  { id: 'cycles', label: 'Ciclos de Escala', status: 'loading' },
  { id: 'users', label: 'Usuários', status: 'loading' },
  { id: 'contracts', label: 'Contratos de Staff', status: 'loading' },
  { id: 'departments', label: 'Departamentos', status: 'loading' },
  { id: 'projects', label: 'Projetos', status: 'loading' },
]

export function SystemChecklistModal({ open, onOpenChange }: SystemChecklistModalProps) {
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
      console.error('[SystemChecklistModal] DB health check failed:', err)
      updateCheck('db', 'fail')
    }

    try {
      const tools = await pb.collection('ia_tools').getList(1, 1, { filter: 'status = "active"' })
      updateCheck('tools', tools.items.length > 0 ? 'pass' : 'fail')
    } catch (err) {
      console.error('[SystemChecklistModal] IA tools check failed:', err)
      updateCheck('tools', 'fail')
    }

    try {
      const cycles = await pb
        .collection('shift_cycles')
        .getList(1, 1, { filter: 'status = "active"' })
      updateCheck('cycles', cycles.items.length > 0 ? 'pass' : 'fail')
    } catch (err) {
      console.error('[SystemChecklistModal] Shift cycles check failed:', err)
      updateCheck('cycles', 'fail')
    }

    try {
      await pb.collection('users').getList(1, 1)
      updateCheck('users', 'pass')
    } catch (err) {
      console.error('[SystemChecklistModal] Users check failed:', err)
      updateCheck('users', 'fail')
    }

    try {
      await pb.collection('staff_contracts').getList(1, 1)
      updateCheck('contracts', 'pass')
    } catch (err) {
      console.error('[SystemChecklistModal] Staff contracts check failed:', err)
      updateCheck('contracts', 'fail')
    }

    try {
      await pb.collection('departments').getList(1, 1)
      updateCheck('departments', 'pass')
    } catch (err) {
      console.error('[SystemChecklistModal] Departments check failed:', err)
      updateCheck('departments', 'fail')
    }

    try {
      await pb.collection('projects').getList(1, 1)
      updateCheck('projects', 'pass')
    } catch (err) {
      console.error('[SystemChecklistModal] Projects check failed:', err)
      updateCheck('projects', 'fail')
    }

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
              <span
                className={cn(
                  'text-xs font-semibold',
                  check.status === 'pass'
                    ? 'text-green-600'
                    : check.status === 'fail'
                      ? 'text-orange-600'
                      : 'text-slate-400',
                )}
              >
                {check.status === 'pass' ? 'OK' : check.status === 'fail' ? 'Atenção' : '...'}
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
