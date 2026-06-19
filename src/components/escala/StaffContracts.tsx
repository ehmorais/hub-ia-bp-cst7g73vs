import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
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
  getShiftTypes,
  updateUser,
  createStaffContract,
  updateStaffContract,
  deleteStaffContract,
} from '@/services/escala'
import { useRealtime } from '@/hooks/use-realtime'
import pb from '@/lib/pocketbase/client'

export function StaffContracts() {
  const [users, setUsers] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [shiftTypes, setShiftTypes] = useState<any[]>([])
  const { toast } = useToast()

  const loadData = async () => {
    Promise.all([getUsers(), getStaffContracts(), getStaffRoles(), getShiftTypes()]).then(
      ([us, co, ro, st]) => {
        setUsers(us)
        setContracts(co)
        setRoles(ro)
        setShiftTypes(st)
      },
    )
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('users', loadData)
  useRealtime('staff_contracts', loadData)
  useRealtime('staff_roles', loadData)
  useRealtime('shift_types', loadData)

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

  const handleShiftTypeChange = async (userId: string, shiftTypeId: string) => {
    try {
      const existing = contracts.find((c) => c.user === userId)
      if (existing) await updateStaffContract(existing.id, { shift_type: shiftTypeId })
      else
        await createStaffContract({
          user: userId,
          shift_type: shiftTypeId,
          monthly_hour_limit: 180,
        })
      toast({ title: 'Tipo de escala atualizado' })
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

  const handleDeleteContract = async (contractId: string) => {
    try {
      await deleteStaffContract(contractId)
      toast({ title: 'Contrato removido' })
    } catch {
      toast({ title: 'Erro', variant: 'destructive' })
    }
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle>Colaboradores</CardTitle>
        <CardDescription>
          Gerencie a função, tipo de escala e regime de contratação para cada profissional.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profissional</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Tipo de Escala</TableHead>
              <TableHead>Tipo de Contrato</TableHead>
              <TableHead>Carga Horária</TableHead>
              <TableHead className="text-right">Ações</TableHead>
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
                      <SelectTrigger className="w-[160px] h-8">
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
                      value={userContract?.shift_type}
                      onValueChange={(val) => handleShiftTypeChange(u.id, val)}
                    >
                      <SelectTrigger className="w-[160px] h-8">
                        <SelectValue placeholder="Sem tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {shiftTypes.map((st) => (
                          <SelectItem key={st.id} value={st.id}>
                            {st.name}
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
                      <SelectTrigger className="w-[120px] h-8">
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
                          className="w-16 h-8"
                        />
                        <span className="text-xs text-muted-foreground">h/mês</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {userContract && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteContract(userContract.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
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
