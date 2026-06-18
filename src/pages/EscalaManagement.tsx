import { useEffect, useState, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { format, subDays, addDays } from 'date-fns'
import { AgentDialog } from '@/components/AgentDialog'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { Card } from '@/components/ui/card'
import { AlertCircle, CalendarRange, Download, ShieldCheck } from 'lucide-react'

const SHIFT_TYPES = ['Day 1', 'Day 2', 'Night 1', 'Night 2', 'Off', '']
const SHIFT_COLORS: Record<string, string> = {
  'Day 1': 'bg-blue-100 text-blue-800',
  'Day 2': 'bg-cyan-100 text-cyan-800',
  'Night 1': 'bg-indigo-100 text-indigo-800',
  'Night 2': 'bg-violet-100 text-violet-800',
  Off: 'bg-slate-100 text-slate-800',
}

export default function EscalaManagement() {
  const [staff, setStaff] = useState<any[]>([])
  const [shifts, setShifts] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])

  const loadData = async () => {
    try {
      setStaff(await pb.collection('hospital_staff').getFullList({ sort: 'department,name' }))
      setShifts(await pb.collection('shifts').getFullList({}))
      setDepartments(await pb.collection('departments').getFullList())
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('shifts', loadData)
  useRealtime('hospital_staff', loadData)

  const days = useMemo(() => {
    const today = new Date()
    let y = today.getFullYear(),
      m = today.getMonth()
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

  const getShift = (staffId: string, dateStr: string) =>
    shifts.find((s) => s.staff_id === staffId && s.date.startsWith(dateStr))

  const isViolation = (staffId: string, dateStr: string) => {
    const s = staff.find((st) => st.id === staffId)
    if (s?.contract_type !== '12x36') return false
    const yest = format(subDays(new Date(dateStr), 1), 'yyyy-MM-dd')
    const t = getShift(staffId, dateStr)
    const y = getShift(staffId, yest)
    return !!(t && y && t.shift_type !== 'Off' && y.shift_type !== 'Off' && t.shift_type !== '')
  }

  const isNurseMissing = (deptId: string, dateStr: string) => {
    const ds = shifts.filter(
      (s) =>
        s.department_id === deptId &&
        s.date.startsWith(dateStr) &&
        s.shift_type &&
        s.shift_type !== 'Off',
    )
    const hasTech = ds.some((s) => staff.find((st) => st.id === s.staff_id)?.role === 'Technician')
    const hasNurse = ds.some((s) => staff.find((st) => st.id === s.staff_id)?.role === 'Nurse')
    return hasTech && !hasNurse
  }

  const handleCellClick = async (staffId: string, dateStr: string, current: any) => {
    const cType = current?.shift_type || ''
    const next = SHIFT_TYPES[(SHIFT_TYPES.indexOf(cType) + 1) % SHIFT_TYPES.length]
    try {
      if (!next) {
        if (current?.id) await pb.collection('shifts').delete(current.id)
      } else {
        if (current?.id) await pb.collection('shifts').update(current.id, { shift_type: next })
        else {
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
    }
  }

  const publishAll = async () => {
    try {
      const drafts = shifts.filter((s) => s.status === 'Draft')
      for (const d of drafts) await pb.collection('shifts').update(d.id, { status: 'Published' })
      toast({ title: 'Sucesso', description: 'Escala publicada!' })
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao publicar.' })
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-full overflow-hidden space-y-6 animate-fade-in-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarRange className="h-7 w-7 text-primary" /> Gestão de Escalas
          </h1>
          <p className="text-muted-foreground mt-1">
            Período: 26/{days[0]?.getMonth() + 1} a 25/{days[days.length - 1]?.getMonth() + 1}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> RH Export
          </Button>
          <AgentDialog />
          <Button onClick={publishAll} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <ShieldCheck className="h-4 w-4" /> Publicar Escala
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 text-slate-600 border-b">
              <tr>
                <th className="p-3 font-semibold sticky left-0 bg-slate-50 z-10 w-48">
                  Colaborador
                </th>
                <th className="p-3 font-semibold">Regra</th>
                {days.map((d) => (
                  <th
                    key={d.toISOString()}
                    className="p-2 font-medium text-center min-w-[45px] border-l"
                  >
                    {format(d, 'dd')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => {
                const deptStaff = staff.filter((s) => s.department === dept.id)
                if (deptStaff.length === 0) return null
                return (
                  <tr key={dept.id}>
                    <td
                      colSpan={days.length + 2}
                      className="bg-slate-100 p-2 font-bold text-slate-700"
                    >
                      {dept.name}
                    </td>
                  </tr>
                )
              })}
              {staff.map((st) => (
                <tr key={st.id} className="border-b hover:bg-slate-50 transition-colors">
                  <td className="p-3 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[1px_0_0_0_#f1f5f9]">
                    <div className="font-medium text-slate-800 truncate" title={st.name}>
                      {st.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {st.role} • {st.contract_type}
                    </div>
                  </td>
                  <td className="p-2 border-l text-center">
                    {days.some((d) => isViolation(st.id, format(d, 'yyyy-MM-dd'))) && (
                      <AlertCircle
                        className="h-4 w-4 text-orange-500 mx-auto"
                        title="Violação de Descanso"
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
                        className={`p-1 border-l text-center cursor-pointer transition-colors hover:bg-slate-100 ${viol ? 'bg-orange-50' : ''} ${nurseMiss ? 'bg-red-50' : ''}`}
                        onClick={() => handleCellClick(st.id, dStr, shift)}
                      >
                        {shift?.shift_type && (
                          <div
                            className={`text-[10px] font-bold py-1 rounded ${SHIFT_COLORS[shift.shift_type] || 'bg-slate-200'}`}
                          >
                            {shift.shift_type === 'Off'
                              ? 'F'
                              : shift.shift_type.replace('Night', 'N').replace('Day', 'D')}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
