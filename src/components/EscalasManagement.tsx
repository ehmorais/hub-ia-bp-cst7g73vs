import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Clock, Building2, Users, Activity, FileText, CalendarOff } from 'lucide-react'
import { ShiftCycles } from './escala/ShiftCycles'
import { Sectors } from './escala/Sectors'
import { StaffContracts } from './escala/StaffContracts'
import { StaffRoles } from './escala/StaffRoles'
import { Timeoff } from './escala/Timeoff'
import { Indicators } from './escala/Indicators'

export interface EscalasManagementProps {
  departmentId?: string
}

export function EscalasManagement({ departmentId }: EscalasManagementProps) {
  return (
    <div className="flex flex-col space-y-6 animate-fade-in">
      <div className="mb-2">
        <h2 className="text-xl font-semibold flex items-center gap-2">Gestão Central de Escalas</h2>
        <p className="text-muted-foreground">
          Administração unificada de ciclos, setores, colaboradores e indicadores de plantão.
        </p>
      </div>

      <Tabs defaultValue="ciclos" className="flex flex-col overflow-hidden">
        <TabsList className="grid grid-cols-2 md:grid-cols-6 w-full h-auto min-h-12 py-1 mb-4 gap-1">
          <TabsTrigger value="ciclos" className="h-10 text-xs sm:text-sm">
            <Clock className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="inline">Ciclos</span>
          </TabsTrigger>
          <TabsTrigger value="setores" className="h-10 text-xs sm:text-sm">
            <Building2 className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="inline">Setores</span>
          </TabsTrigger>
          <TabsTrigger value="colaboradores" className="h-10 text-xs sm:text-sm">
            <Users className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="inline">Colaboradores</span>
          </TabsTrigger>
          <TabsTrigger value="funcao" className="h-10 text-xs sm:text-sm">
            <FileText className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="inline">Função</span>
          </TabsTrigger>
          <TabsTrigger value="folgas" className="h-10 text-xs sm:text-sm">
            <CalendarOff className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="inline">Folgas</span>
          </TabsTrigger>
          <TabsTrigger value="indicadores" className="h-10 text-xs sm:text-sm">
            <Activity className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="inline">Indicadores</span>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 rounded-lg p-2 md:p-6 border">
          <TabsContent value="ciclos" className="mt-0">
            <ShiftCycles />
          </TabsContent>
          <TabsContent value="setores" className="mt-0">
            <Sectors departmentId={departmentId} />
          </TabsContent>
          <TabsContent value="colaboradores" className="mt-0">
            <StaffContracts />
          </TabsContent>
          <TabsContent value="funcao" className="mt-0">
            <StaffRoles />
          </TabsContent>
          <TabsContent value="folgas" className="mt-0">
            <Timeoff />
          </TabsContent>
          <TabsContent value="indicadores" className="mt-0">
            <Indicators />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
