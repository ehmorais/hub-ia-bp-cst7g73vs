import { ShiftRules } from '@/components/escala/ShiftRules'
import { Calendar, ShieldAlert } from 'lucide-react'

export default function RulesAdmin() {
  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-7xl animate-fade-in-up">
      <div className="flex items-center gap-3 border-b pb-4">
        <div className="p-3 rounded-xl bg-blue-100 text-blue-700">
          <Calendar className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Regras de Escala</h1>
          <p className="text-muted-foreground">
            Gerenciamento centralizado das restrições e regras da IA para geração de escalas.
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="flex flex-col gap-4">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-medium text-primary">Sobre as Regras Customizadas (IA)</h4>
              <p className="text-sm text-primary/80">
                Ao selecionar o tipo "Regra Customizada (IA)", você pode descrever restrições
                complexas em linguagem natural. O motor de Inteligência Artificial analisará essas
                instruções durante a geração automática da escala.
              </p>
            </div>
          </div>

          <ShiftRules />
        </div>
      </div>
    </div>
  )
}
