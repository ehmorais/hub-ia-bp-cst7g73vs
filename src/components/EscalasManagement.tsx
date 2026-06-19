import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Clock, Building2, Users, Activity, FileText } from 'lucide-react'
import { ShiftCycles } from './escala/ShiftCycles'
import { Sectors } from './escala/Sectors'
import { StaffContracts } from './escala/StaffContracts'
import { StaffRoles } from './escala/StaffRoles'
import { Timeoff } from './escala/Timeoff'

export interface EscalasManagementProps {
  departmentId?: string
}

export function EscalasManagement({ departmentId }: EscalasManagementProps) {
  return (
    <div className="flex flex-col space-y-6 animate-fade-in">
      <div className="mb-2">
        <h2 className="text-xl font-semibold flex items-center gap-2">Gestão Central de Escalas</h2>
        <p className="text-muted-foreground">
          Administração unificada de ciclos, setores, contratos e métricas de plantão.
        </p>
      </div>

      <Tabs defaultValue="ciclos" className="flex flex-col overflow-hidden">
        <TabsList className="grid grid-cols-1 md:grid-cols-5 w-full h-auto min-h-12 py-1 mb-4">
          <TabsTrigger value="ciclos" className="h-10 text-xs sm:text-sm">
            <Clock className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Ciclos</span>
          </TabsTrigger>
          <TabsTrigger value="setores" className="h-10 text-xs sm:text-sm">
            <Building2 className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Setores</span>
          </TabsTrigger>
          <TabsTrigger value="contratos" className="h-10 text-xs sm:text-sm">
            <Users className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Contratos</span>
          </TabsTrigger>
          <TabsTrigger value="papeis" className="h-10 text-xs sm:text-sm">
            <FileText className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Papéis Clínicos</span>
          </TabsTrigger>
          <TabsTrigger value="kpis" className="h-10 text-xs sm:text-sm">
            <Activity className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Folgas & KPIs</span>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 rounded-lg p-2 md:p-6 border">
          <TabsContent value="ciclos" className="mt-0">
            <ShiftCycles />
          </TabsContent>
          <TabsContent value="setores" className="mt-0">
            <Sectors departmentId={departmentId} />
          </TabsContent>
          <TabsContent value="contratos" className="mt-0">
            <StaffContracts />
          </TabsContent>
          <TabsContent value="papeis" className="mt-0">
            <StaffRoles />
          </TabsContent>
          <TabsContent value="kpis" className="mt-0">
            <Timeoff />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
