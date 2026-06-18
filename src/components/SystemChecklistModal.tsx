import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2, PlayCircle } from 'lucide-react'
import pb from '@/lib/pocketbase/client'

export function SystemChecklistModal({ tools }: { tools: any[] }) {
  const [open, setOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(0)
  const [hasInitialized, setHasInitialized] = useState(false)

  useEffect(() => {
    const hasShown = sessionStorage.getItem('system-checklist-shown')
    if (!hasShown && !hasInitialized) {
      setOpen(true)
      setHasInitialized(true)
      sessionStorage.setItem('system-checklist-shown', 'true')
    }
  }, [hasInitialized])

  useEffect(() => {
    if (open && tools.length > 0 && visibleCount < tools.length) {
      const timer = setTimeout(() => {
        setVisibleCount((v) => v + 1)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [open, tools, visibleCount])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">All Systems Go - Checklist</DialogTitle>
          <DialogDescription>
            Verificando integridade dos módulos de Inteligência Artificial...
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-4 max-h-[60vh] overflow-y-auto pr-2">
          {tools.length === 0 ? (
            <div className="text-center p-6 mt-2 bg-slate-50 text-slate-600 rounded-lg border border-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <p className="text-sm font-medium">Nenhuma ferramenta associada.</p>
            </div>
          ) : (
            <>
              {tools.map((tool, idx) => (
                <div
                  key={tool.id}
                  className={`flex items-center justify-between p-3 border rounded-lg transition-all duration-500 ease-in-out ${
                    idx < visibleCount ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  } ${tool.status === 'active' ? 'bg-slate-50' : 'bg-red-50/50 border-red-100'}`}
                >
                  <div className="flex items-center gap-3">
                    <PlayCircle className="h-5 w-5 text-primary" />
                    <span className="font-medium text-sm">{tool.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-600 font-mono tracking-wider font-semibold">
                      GO
                    </span>
                  </div>
                  {idx < visibleCount && (
                    <CheckCircle2
                      className={`h-5 w-5 animate-in zoom-in spin-in-12 duration-300 ${tool.status === 'active' ? 'text-green-500' : 'text-amber-500'}`}
                    />
                  )}
                </div>
              ))}
              {visibleCount === tools.length && tools.length > 0 && (
                <div className="text-center p-4 mt-2 bg-green-50 text-green-700 rounded-lg border border-green-200 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <p className="text-sm font-semibold flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    All Systems Go: Verified and operational
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter className="mt-4">
          <Button
            onClick={() => setOpen(false)}
            disabled={visibleCount < tools.length}
            className="w-full sm:w-auto"
          >
            Proceed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
