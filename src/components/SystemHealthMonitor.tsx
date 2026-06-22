import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function SystemHealthMonitor() {
  const [status, setStatus] = useState<'go' | 'check' | 'loading'>('loading')

  useEffect(() => {
    async function checkHealth() {
      try {
        const [tools, cycles] = await Promise.all([
          pb.collection('ia_tools').getList(1, 1, { filter: 'status = "active"' }),
          pb.collection('shift_cycles').getList(1, 1, { filter: 'status = "active"' }),
        ])

        if (tools.items.length > 0 && cycles.items.length > 0) {
          setStatus('go')
        } else {
          setStatus('check')
        }
      } catch (error) {
        setStatus('check')
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200">
        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 animate-pulse shrink-0" />
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Verificando...
        </span>
      </div>
    )
  }

  const isGo = status === 'go'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link to="/all-systems-go" className="block focus:outline-none">
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 shadow-sm',
              isGo
                ? 'bg-green-50/50 border-green-200 hover:bg-green-100 text-green-700 hover:border-green-300'
                : 'bg-orange-50 border-orange-200 hover:bg-orange-100 text-orange-700 hover:border-orange-300',
            )}
          >
            <div className="relative flex h-2.5 w-2.5 shrink-0">
              {isGo && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 duration-1000"></span>
              )}
              <span
                className={cn(
                  'relative inline-flex rounded-full h-2.5 w-2.5',
                  isGo ? 'bg-green-500' : 'bg-orange-500',
                )}
              ></span>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
              {isGo ? 'All Systems Go' : 'Check Systems'}
            </span>
          </div>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" className="text-xs">
        <p>
          {isGo
            ? 'Todos os sistemas operacionais e conectividade OK.'
            : 'Atenção necessária: falha de conectividade ou configuração pendente.'}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
