import { useEffect, useState, useMemo, useCallback, Fragment } from 'react'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { format, subDays, addDays, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AgentDialog } from '@/components/AgentDialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Card } from '@/components/ui/card'
import { AlertCircle, CalendarRange, Download, ShieldCheck, UserCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const SHIFT_TYPES = ['Day 1', 'Day 2', 'Night 1', 'Night 2', 'Off', '']
const SHIFT_COLORS: Record<string, string> = {
  'Day 1': 'bg-sky-100 text-sky-800 border-sky-200',
  'Day 2': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'Night 1': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'Night 2': 'bg-violet-100 text-violet-800 border-violet-200',
  Off: 'bg-slate-100 text-slate-800 border-slate-200',
}
const SHIFT_LABELS: Record<string, string> = {
  'Day 1': 'D1',
  'Day 2': 'D2',
  'Night 1': 'N1',
  'Night 2': 'N2',
  Off: 'F',
}

export default function EscalaManagement() {
  const [staff, setStaff] = useState<any[]>([])
  const [shifts, setShifts] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const { toast } = useToast()

  const loadData = useCallback(async () => {
    try {
      const [staffData, shiftsData, deptsData] = await Promise.all([
        pb.collection('hospital_staff').getFullList({ sort: 'department,name' }),
        pb.collection('shifts').getFullList({}),
        pb.collection('departments').getFullList({ sort: 'sort_order,name' }),
      ])
      setStaff(staffData)
      setShifts(shiftsData)
      setDepartments(deptsData)
    } catch (e) {
      console.error(e)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao carregar dados da escala.',
      })
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('shifts', loadData)
  useRealtime('hospital_staff', loadData)
  useRealtime('departments', loadData)

  const days = useMemo(() => {
    const today = startOfDay(new Date())
    let y = today.getFullYear()
    let m = today.getMonth()
    if (today.getDate() < 26) {
      m -= 1
      if (m < 0) {
        m = 11
        y -= 1
      }
    }
    const start = new Date(y, m, 26)
    const arr = []
    for (let i = 0; i < 31; i++) {
      const d = addDays(start, i)
      if (i > 27 && d.getDate() === 26) break
      arr.push(d)
    }
    return arr
  }, [])

  const getShift = useCallback(
    (staffId: string, dateStr: string) =>
      shifts.find((s) => s.staff_id === staffId && s.date.startsWith(dateStr)),
    [shifts],
  )

  const isViolation = useCallback(
    (staffId: string, dateStr: string) => {
      const s = staff.find((st) => st.id === staffId)
      if (s?.contract_type !== '12x36') return false
      const yest = format(subDays(new Date(dateStr), 1), 'yyyy-MM-dd')
      const t = getShift(staffId, dateStr)
      const y = getShift(staffId, yest)
      return !!(t && y && t.shift_type !== 'Off' && y.shift_type !== 'Off' && t.shift_type !== '')
    },
    [staff, getShift],
  )

  const isNurseMissing = useCallback(
    (deptId: string, dateStr: string) => {
      const ds = shifts.filter(
        (s) =>
          s.department_id === deptId &&
          s.date.startsWith(dateStr) &&
          s.shift_type &&
          s.shift_type !== 'Off',
      )
      const hasTech = ds.some(
        (s) => staff.find((st) => st.id === s.staff_id)?.role === 'Technician',
      )
      const hasNurse = ds.some((s) => staff.find((st) => st.id === s.staff_id)?.role === 'Nurse')
      return hasTech && !hasNurse
    },
    [shifts, staff],
  )

  const handleCellClick = async (staffId: string, dateStr: string, current: any) => {
    const cType = current?.shift_type || ''
    const next = SHIFT_TYPES[(SHIFT_TYPES.indexOf(cType) + 1) % SHIFT_TYPES.length]
    try {
      if (!next) {
        if (current?.id) await pb.collection('shifts').delete(current.id)
      } else {
        if (current?.id) {
          await pb.collection('shifts').update(current.id, { shift_type: next })
        } else {
          const dept = staff.find((s) => s.id === staffId)?.department
          await pb.collection('shifts').create({
            staff_id: staffId,
            date: `${dateStr} 12:00:00.000Z`,
            shift_type: next,
            status: 'Draft',
            department_id: dept,
          })
        }
      }
    } catch (e) {
      console.error(e)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível salvar o turno.',
      })
    }
  }

  const publishAll = async () => {
    try {
      const drafts = shifts.filter((s) => s.status === 'Draft')
      if (drafts.length === 0) {
        toast({ title: 'Aviso', description: 'Nenhum turno em rascunho para publicar.' })
        return
      }
      for (const d of drafts) {
        await pb.collection('shifts').update(d.id, { status: 'Published' })
      }
      toast({ title: 'Sucesso', description: 'Escala publicada com sucesso!' })
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao publicar a escala.' })
    }
  }

  const relevantDepts = useMemo(() => {
    return departments.filter((d) => {
      const hasStaff = staff.some((s) => s.department === d.id)
      const isCore = [
        'PSI',
        'PSA',
        'PSRIO',
        'SETOR DE IMAGEM',
        'UTI PED',
        '2º ANDAR',
        '3º ANDAR',
        '4º ANDAR',
        '5º ANDAR',
      ].includes(d.name.toUpperCase())
      return hasStaff || isCore
    })
  }, [departments, staff])

  return (
    <div className="p-4 md:p-8 max-w-full overflow-hidden space-y-6 animate-fade-in-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarRange className="h-8 w-8 text-primary" /> Gestão de Escalas
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">
            Período: {format(days[0], 'dd/MM/yyyy')} a {format(days[days.length - 1], 'dd/MM/yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Exportar para RH
          </Button>
          <AgentDialog />
          <Button
            onClick={publishAll}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <ShieldCheck className="h-4 w-4" /> Publicar Escala
          </Button>
        </div>
      </div>

      <Card className="border shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-100 text-slate-700 border-b">
              <tr>
                <th className="p-4 font-semibold sticky left-0 bg-slate-100 z-10 min-w-[220px] shadow-[1px_0_0_0_#e2e8f0]">
                  Colaborador
                </th>
                <th
                  className="p-3 font-semibold text-center border-l w-16"
                  title="Alertas de Regra"
                >
                  <AlertCircle className="h-4 w-4 mx-auto text-slate-400" />
                </th>
                {days.map((d) => (
                  <th
                    key={d.toISOString()}
                    className="p-2 font-semibold text-center min-w-[50px] border-l whitespace-nowrap"
                  >
                    <div className="text-xs text-slate-500 font-medium uppercase">
                      {format(d, 'eee', { locale: ptBR })}
                    </div>
                    <div
                      className={cn(
                        'text-base',
                        d.getDay() === 0 || d.getDay() === 6 ? 'text-primary' : '',
                      )}
                    >
                      {format(d, 'dd')}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {relevantDepts.map((dept) => {
                const deptStaff = staff.filter((s) => s.department === dept.id)
                return (
                  <Fragment key={dept.id}>
                    <tr>
                      <td
                        colSpan={days.length + 2}
                        className="bg-slate-50 p-3 font-bold text-slate-800 border-y"
                      >
                        {dept.name}
                      </td>
                    </tr>
                    {deptStaff.length === 0 ? (
                      <tr>
                        <td
                          colSpan={days.length + 2}
                          className="p-3 text-center text-sm text-slate-400 italic bg-white"
                        >
                          Nenhum colaborador alocado neste setor
                        </td>
                      </tr>
                    ) : (
                      deptStaff.map((st) => (
                        <tr
                          key={st.id}
                          className="border-b hover:bg-slate-50/50 transition-colors group"
                        >
                          <td className="p-3 sticky left-0 bg-white group-hover:bg-slate-50/50 z-10 shadow-[1px_0_0_0_#e2e8f0] flex items-center gap-3">
                            <div className="bg-slate-100 p-2 rounded-full shrink-0">
                              <UserCircle2 className="h-5 w-5 text-slate-500" />
                            </div>
                            <div className="min-w-0">
                              <div
                                className="font-semibold text-slate-900 truncate"
                                title={st.name}
                              >
                                {st.name}
                              </div>
                              <div className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
                                <span>{st.role}</span>
                                <span>•</span>
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                  {st.contract_type}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-2 border-l text-center align-middle bg-white group-hover:bg-slate-50/50">
                            {days.some((d) => isViolation(st.id, format(d, 'yyyy-MM-dd'))) && (
                              <AlertCircle
                                className="h-4 w-4 text-orange-500 mx-auto"
                                title="Violação de Descanso (36h)"
                              />
                            )}
                          </td>
                          {days.map((d) => {
                            const dStr = format(d, 'yyyy-MM-dd')
                            const shift = getShift(st.id, dStr)
                            const viol = isViolation(st.id, dStr)
                            const nurseMiss =
                              st.role === 'Technician' && isNurseMissing(st.department, dStr)

                            return (
                              <td
                                key={d.toISOString()}
                                className={cn(
                                  'p-1 border-l text-center cursor-pointer transition-colors relative h-[52px]',
                                  'hover:bg-slate-100',
                                  viol ? 'bg-orange-50/80 hover:bg-orange-100' : '',
                                  nurseMiss ? 'bg-red-50/80 hover:bg-red-100' : '',
                                )}
                                onClick={() => handleCellClick(st.id, dStr, shift)}
                                title={
                                  viol
                                    ? 'Violação de Descanso'
                                    : nurseMiss
                                      ? 'Falta Enfermeiro (Mínimo Técnico)'
                                      : 'Clique para alterar turno'
                                }
                              >
                                {shift?.shift_type && (
                                  <div
                                    className={cn(
                                      'text-xs font-bold w-full h-full flex items-center justify-center rounded border',
                                      SHIFT_COLORS[shift.shift_type] ||
                                        'bg-slate-100 text-slate-800 border-slate-200',
                                    )}
                                  >
                                    {SHIFT_LABELS[shift.shift_type] || shift.shift_type}
                                  </div>
                                )}
                                {shift?.status === 'Draft' && (
                                  <div
                                    className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-400 rounded-full"
                                    title="Rascunho"
                                  />
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
