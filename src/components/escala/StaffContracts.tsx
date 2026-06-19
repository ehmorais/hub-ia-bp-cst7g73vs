import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import {
  getUsers,
  getStaffContracts,
  getStaffRoles,
  updateUser,
  createStaffContract,
  updateStaffContract,
} from '@/services/escala'
import { useRealtime } from '@/hooks/use-realtime'
import pb from '@/lib/pocketbase/client'

export function StaffContracts() {
  const [users, setUsers] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const { toast } = useToast()

  const loadData = async () => {
    Promise.all([getUsers(), getStaffContracts(), getStaffRoles()]).then(([us, co, ro]) => {
      setUsers(us)
      setContracts(co)
      setRoles(ro)
    })
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('users', loadData)
  useRealtime('staff_contracts', loadData)
  useRealtime('staff_roles', loadData)

  const handleRoleChange = async (userId: string, roleId: string) => {
    try {
      await updateUser(userId, { staff_role: roleId })
      toast({ title: 'Função atualizada' })
    } catch {
      toast({ title: 'Erro', variant: 'destructive' })
    }
  }

  const handleContractChange = async (userId: string, type: string) => {
    try {
      const existing = contracts.find((c) => c.user === userId)
      if (existing) await updateStaffContract(existing.id, { contract_type: type })
      else await createStaffContract({ user: userId, contract_type: type, monthly_hour_limit: 180 })
      toast({ title: 'Contrato atualizado' })
    } catch {
      toast({ title: 'Erro', variant: 'destructive' })
    }
  }

  const handleHoursChange = async (contractId: string, hours: number) => {
    try {
      await updateStaffContract(contractId, { monthly_hour_limit: hours })
    } catch {
      toast({ title: 'Erro', variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Colaboradores</CardTitle>
        <CardDescription>
          Gerencie a função e o regime de contratação para cada profissional.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profissional</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Tipo de Contrato</TableHead>
              <TableHead>Carga Horária (mês)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const userContract = contracts.find((c) => c.user === u.id)
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium flex items-center gap-2 whitespace-nowrap">
                    {u.avatar ? (
                      <img
                        src={pb.files.getURL(u, u.avatar)}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                        {u.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    {u.name}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.staff_role}
                      onValueChange={(val) => handleRoleChange(u.id, val)}
                    >
                      <SelectTrigger className="w-[180px] h-8">
                        <SelectValue placeholder="Sem função" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={userContract?.contract_type}
                      onValueChange={(val) => handleContractChange(u.id, val)}
                    >
                      <SelectTrigger className="w-[150px] h-8">
                        <SelectValue placeholder="Sem contrato" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CLT 180h">CLT 180h</SelectItem>
                        <SelectItem value="PJ">PJ</SelectItem>
                        <SelectItem value="Autônomo">Autônomo</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {userContract ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          defaultValue={userContract.monthly_hour_limit}
                          onBlur={(e) => handleHoursChange(userContract.id, Number(e.target.value))}
                          className="w-20 h-8"
                        />
                        <span className="text-xs text-muted-foreground">horas</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
