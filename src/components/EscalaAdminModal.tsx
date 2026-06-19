import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EscalasManagement } from '@/components/EscalasManagement'

export interface EscalaAdminModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: any
}

export function EscalaAdminModal({ open, onOpenChange, project }: EscalaAdminModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-white">
          <DialogTitle>
            Administração de Escalas {project?.name ? `- ${project.name}` : ''}
          </DialogTitle>
          <DialogDescription>
            Gestão completa de ciclos, setores, contratos e folgas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          <EscalasManagement />
        </div>
      </DialogContent>
    </Dialog>
  )
}
