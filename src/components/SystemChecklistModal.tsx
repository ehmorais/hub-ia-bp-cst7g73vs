import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckSquare, CheckCircle2, Circle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface SystemChecklistModalProps {
  tools: any[]
}

export function SystemChecklistModal({ tools }: SystemChecklistModalProps) {
  const activeTools = tools.filter((t) => t.status === 'active')
  const draftTools = tools.filter((t) => t.status !== 'active')
  const totalTools = tools.length
  const progress = totalTools > 0 ? Math.round((activeTools.length / totalTools) * 100) : 0

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-6 right-6 z-50 shadow-xl rounded-full gap-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-6"
        >
          <CheckSquare className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Checklist do Sistema</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Progresso de Implantação</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 font-medium">Status Geral</span>
              <span className="font-bold text-slate-800">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">Modelos Ativos</h4>
            {activeTools.length > 0 ? (
              <div className="space-y-2">
                {activeTools.map((tool) => (
                  <div key={tool.id} className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="text-sm text-slate-700 font-medium">{tool.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum modelo ativo no momento.</p>
            )}
          </div>

          {draftTools.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-900">Em Configuração</h4>
              <div className="space-y-2">
                {draftTools.map((tool) => (
                  <div key={tool.id} className="flex items-center gap-3">
                    <Circle className="h-4 w-4 text-slate-300 shrink-0" />
                    <span className="text-sm text-slate-500">{tool.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
