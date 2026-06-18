import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { format, addMonths } from 'date-fns'
import { toast } from '@/components/ui/use-toast'
import { CalendarRange, Send, UserCircle } from 'lucide-react'

export default function EscalaPortal() {
  const { user } = useAuth()
  const [staffRecord, setStaffRecord] = useState<any>(null)
  const [shifts, setShifts] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [requestDate, setRequestDate] = useState('')

  useEffect(() => {
    if (!user) return
    const fetchMyData = async () => {
      try {
        const staff = await pb.collection('hospital_staff').getFirstListItem(`user_id="${user.id}"`)
        setStaffRecord(staff)
        setShifts(
          await pb
            .collection('shifts')
            .getFullList({ filter: `staff_id="${staff.id}" && status="Published"`, sort: 'date' }),
        )
        setRequests(
          await pb
            .collection('off_day_requests')
            .getFullList({ filter: `staff_id="${staff.id}"`, sort: '-created' }),
        )
      } catch (e) {
        console.log('Usuário não associado a um staff', e)
      }
    }
    fetchMyData()
  }, [user])

  const submitRequest = async () => {
    if (!requestDate || !staffRecord) return
    try {
      const nextMonth = format(addMonths(new Date(), 1), 'MM/yyyy')
      await pb.collection('off_day_requests').create({
        staff_id: staffRecord.id,
        requested_date: `${requestDate} 12:00:00.000Z`,
        month_reference: nextMonth,
        status: 'Pending',
      })
      toast({ title: 'Sucesso', description: 'Pretensão enviada!' })
      setRequests(
        await pb
          .collection('off_day_requests')
          .getFullList({ filter: `staff_id="${staffRecord.id}"`, sort: '-created' }),
      )
      setRequestDate('')
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao enviar.' })
    }
  }

  if (!staffRecord) {
    return (
      <div className="p-8 text-center text-muted-foreground animate-fade-in-up">
        <UserCircle className="h-16 w-16 mx-auto mb-4 text-slate-300" />
        <h2 className="text-xl font-medium text-slate-800">
          Seu usuário não está vinculado ao quadro de funcionários.
        </h2>
        <p>Contate o RH ou a Supervisão.</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
          <UserCircle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Portal do Colaborador</h1>
          <p className="text-muted-foreground">
            {staffRecord.name} • {staffRecord.role}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarRange className="h-5 w-5 text-primary" /> Meus Plantões Publicados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {shifts.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum plantão publicado.</p>
            ) : (
              <div className="space-y-3">
                {shifts.map((s) => (
                  <div
                    key={s.id}
                    className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border"
                  >
                    <span className="font-medium text-slate-700">
                      {format(new Date(s.date), 'dd/MM/yyyy')}
                    </span>
                    <span className="text-sm font-bold bg-white px-3 py-1 rounded shadow-sm text-primary">
                      {s.shift_type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Pretensões de Folga</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
              <label className="text-sm font-medium text-blue-900">
                Nova Pretensão (Mês Seguinte)
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={requestDate}
                  onChange={(e) => setRequestDate(e.target.value)}
                  className="flex-1 border-blue-200 rounded-md px-3 py-2 text-sm focus:ring-blue-500"
                />
                <Button onClick={submitRequest} className="bg-blue-600 hover:bg-blue-700">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3 mt-6">
              <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                Histórico
              </h4>
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="flex justify-between items-center text-sm p-3 border rounded-lg"
                >
                  <span>{format(new Date(r.requested_date), 'dd/MM/yyyy')}</span>
                  <span
                    className={`px-2 py-1 rounded-full text-[11px] font-bold uppercase ${r.status === 'Approved' ? 'bg-green-100 text-green-700' : r.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}
                  >
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
