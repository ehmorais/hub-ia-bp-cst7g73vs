import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Clock,
  Building2,
  Users,
  Activity,
  FileText,
  CalendarOff,
  Settings,
  Wand2,
  Calendar,
  Layers,
  FileSignature,
  Briefcase,
} from 'lucide-react'
import { ShiftCycles } from './escala/ShiftCycles'
import { Sectors } from './escala/Sectors'
import { StaffContracts } from './escala/StaffContracts'
import { StaffRoles } from './escala/StaffRoles'
import { ShiftTypes } from './escala/ShiftTypes'
import { Timeoff } from './escala/Timeoff'
import { Indicators } from './escala/Indicators'
import { ShiftRules } from './escala/ShiftRules'
import { StaffProfiles } from './escala/StaffProfiles'
import { AutoGenerate } from './escala/AutoGenerate'
import { ScalePlanner } from './escala/ScalePlanner'
import { DepartmentStaffList } from './escala/DepartmentStaffList'
import { cn } from '@/lib/utils'

export interface EscalasManagementProps {
  departmentId?: string
  projectId?: string
}

export function EscalasManagement({ departmentId, projectId }: EscalasManagementProps) {
  const currentDay = new Date().getDate()

  const phases = [
    {
      name: 'Coleta de Folgas',
      desc: 'Até dia 10',
      active: currentDay <= 10,
      past: currentDay > 10,
    },
    {
      name: 'Elaboração',
      desc: 'Dias 11 a 22',
      active: currentDay >= 11 && currentDay <= 22,
      past: currentDay > 22,
    },
    { name: 'Entrega RH', desc: 'Dia 23', active: currentDay === 23, past: currentDay > 23 },
    {
      name: 'Divulgação',
      desc: 'Dias 24 e 25',
      active: currentDay >= 24 && currentDay <= 25,
      past: currentDay > 25,
    },
    { name: 'Execução', desc: 'Dia 26 em diante', active: currentDay >= 26, past: false },
  ]

  const activeIndex = phases.findIndex((p) => p.active)
  const progressWidth = activeIndex >= 0 ? (activeIndex / (phases.length - 1)) * 100 : 100

  return (
    <div className="flex flex-col space-y-6 animate-fade-in">
      <div className="mb-2">
        <h2 className="text-xl font-semibold flex items-center gap-2">Gestão Central de Escalas</h2>
        <p className="text-muted-foreground">
          Administração unificada de ciclos, setores, colaboradores e geração automática com IA.
        </p>
      </div>

      <div className="p-4 border rounded-xl bg-white shadow-sm flex flex-col gap-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 bg-primary h-full" />
        <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Ciclo Operacional Vigente (26 a 25)
        </div>
        <div className="flex items-center justify-between w-full relative px-2 md:px-8">
          <div className="absolute top-[8px] left-0 md:left-8 right-0 md:right-8 h-1 bg-slate-100 rounded-full overflow-hidden z-0">
            <div
              className="h-full bg-primary transition-all duration-1000 ease-out"
              style={{ width: `${progressWidth}%` }}
            />
          </div>
          {phases.map((p) => (
            <div
              key={p.name}
              className="z-10 flex flex-col items-center gap-2 relative group cursor-default"
            >
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-[3px] transition-colors duration-500',
                  p.past
                    ? 'bg-primary border-primary'
                    : p.active
                      ? 'bg-white border-primary ring-4 ring-primary/20 shadow-sm'
                      : 'bg-white border-slate-200',
                )}
              />
              <div className="flex flex-col items-center absolute top-7 w-24">
                <span
                  className={cn(
                    'text-[11px] font-semibold text-center leading-tight transition-colors',
                    p.active ? 'text-primary' : p.past ? 'text-slate-700' : 'text-slate-400',
                  )}
                >
                  {p.name}
                </span>
                <span
                  className={cn(
                    'text-[9px] text-center mt-0.5',
                    p.active ? 'text-slate-600' : 'text-slate-400',
                  )}
                >
                  {p.desc}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="h-10" /> {/* Spacer for absolute text */}
      </div>

      <Tabs defaultValue="ciclos" className="flex flex-col overflow-hidden">
        <TabsList className="flex flex-wrap w-full h-auto min-h-12 py-1 mb-4 gap-1 justify-start">
          <TabsTrigger value="ciclos" className="h-10 text-xs sm:text-sm flex-1 sm:flex-none">
            <Clock className="h-4 w-4 mr-1 sm:mr-2 hidden sm:block" />
            <span className="inline">Ciclos</span>
          </TabsTrigger>
          <TabsTrigger value="tipos" className="h-10 text-xs sm:text-sm flex-1 sm:flex-none">
            <Layers className="h-4 w-4 mr-1 sm:mr-2 hidden sm:block" />
            <span className="inline">Tipos</span>
          </TabsTrigger>
          <TabsTrigger value="setores" className="h-10 text-xs sm:text-sm flex-1 sm:flex-none">
            <Building2 className="h-4 w-4 mr-1 sm:mr-2 hidden sm:block" />
            <span className="inline">Setores</span>
          </TabsTrigger>
          <TabsTrigger
            value="colaboradores"
            className="h-10 text-xs sm:text-sm flex-1 sm:flex-none"
          >
            <Users className="h-4 w-4 mr-1 sm:mr-2 hidden sm:block" />
            <span className="inline">Colaboradores</span>
          </TabsTrigger>
          <TabsTrigger value="contratos" className="h-10 text-xs sm:text-sm flex-1 sm:flex-none">
            <FileSignature className="h-4 w-4 mr-1 sm:mr-2 hidden sm:block" />
            <span className="inline">Contratos</span>
          </TabsTrigger>
          <TabsTrigger value="funcao" className="h-10 text-xs sm:text-sm flex-1 sm:flex-none">
            <Briefcase className="h-4 w-4 mr-1 sm:mr-2 hidden sm:block" />
            <span className="inline">Função</span>
          </TabsTrigger>
          <TabsTrigger value="folgas" className="h-10 text-xs sm:text-sm flex-1 sm:flex-none">
            <CalendarOff className="h-4 w-4 mr-1 sm:mr-2 hidden sm:block" />
            <span className="inline">Folgas</span>
          </TabsTrigger>
          <TabsTrigger value="regras" className="h-10 text-xs sm:text-sm flex-1 sm:flex-none">
            <Settings className="h-4 w-4 mr-1 sm:mr-2 hidden sm:block" />
            <span className="inline">Regras</span>
          </TabsTrigger>
          <TabsTrigger value="perfis" className="h-10 text-xs sm:text-sm flex-1 sm:flex-none">
            <Users className="h-4 w-4 mr-1 sm:mr-2 hidden sm:block" />
            <span className="inline">Perfis</span>
          </TabsTrigger>
          <TabsTrigger
            value="planejamento"
            className="h-10 text-xs sm:text-sm flex-1 sm:flex-none bg-primary/5 text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Calendar className="h-4 w-4 mr-1 sm:mr-2 hidden sm:block" />
            <span className="inline">Montar Escala</span>
          </TabsTrigger>
          <TabsTrigger
            value="gerar_ia"
            className="h-10 text-xs sm:text-sm flex-1 sm:flex-none bg-indigo-50 text-indigo-700 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            <Wand2 className="h-4 w-4 mr-1 sm:mr-2 hidden sm:block" />
            <span className="inline">Gerar com IA</span>
          </TabsTrigger>
          <TabsTrigger value="indicadores" className="h-10 text-xs sm:text-sm flex-1 sm:flex-none">
            <Activity className="h-4 w-4 mr-1 sm:mr-2 hidden sm:block" />
            <span className="inline">Indicadores</span>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 rounded-lg p-2 md:p-6 border">
          <TabsContent value="ciclos" className="mt-0">
            <ShiftCycles />
          </TabsContent>
          <TabsContent value="tipos" className="mt-0">
            <ShiftTypes />
          </TabsContent>
          <TabsContent value="setores" className="mt-0">
            <Sectors departmentId={departmentId} projectId={projectId} />
          </TabsContent>
          <TabsContent value="colaboradores" className="mt-0">
            <DepartmentStaffList departmentId={departmentId} projectId={projectId} />
          </TabsContent>
          <TabsContent value="contratos" className="mt-0">
            <StaffContracts departmentId={departmentId} projectId={projectId} />
          </TabsContent>
          <TabsContent value="funcao" className="mt-0">
            <StaffRoles />
          </TabsContent>
          <TabsContent value="folgas" className="mt-0">
            <Timeoff />
          </TabsContent>
          <TabsContent value="regras" className="mt-0">
            <ShiftRules departmentId={departmentId} readOnly={true} />
          </TabsContent>
          <TabsContent value="perfis" className="mt-0">
            <StaffProfiles departmentId={departmentId} projectId={projectId} />
          </TabsContent>
          <TabsContent value="planejamento" className="mt-0">
            <ScalePlanner departmentId={departmentId} projectId={projectId} />
          </TabsContent>
          <TabsContent value="gerar_ia" className="mt-0">
            <AutoGenerate departmentId={departmentId} projectId={projectId} />
          </TabsContent>
          <TabsContent value="indicadores" className="mt-0">
            <Indicators />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
