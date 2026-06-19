import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { getUsers, getHospitalSectors, updateUser } from '@/services/escala'
import { useRealtime } from '@/hooks/use-realtime'
import { TimeoffRequestDialog } from './TimeoffRequestDialog'
import { useAuth } from '@/hooks/use-auth'
import { Badge } from '@/components/ui/badge'

export function DepartmentStaffList({ departmentId }: { departmentId: string }) {
  const [users, setUsers] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const { user: authUser } = useAuth()
  const isAdmin = authUser?.role === 'Admin'

  const loadData = async () => {
    Promise.all([getUsers(), getHospitalSectors(departmentId)]).then(([u, s]) => {
      setUsers(u.filter((user: any) => user.expand?.staff_role))
      setSectors(s)
    })
  }

  useEffect(() => {
    loadData()
  }, [departmentId])
  useRealtime('users', loadData)

  const handleAssignSector = async (userId: string, sectorId: string) => {
    try {
      await updateUser(userId, { default_sector: sectorId === 'none' ? null : sectorId })
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Gerenciar Colaboradores</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead>Colaborador</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Setor Padrão</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium text-slate-700">{u.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="font-normal text-xs uppercase bg-slate-100"
                    >
                      {u.expand?.staff_role?.name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.default_sector || 'none'}
                      onValueChange={(val) => handleAssignSector(u.id, val)}
                      disabled={!isAdmin}
                    >
                      <SelectTrigger className="w-[200px] h-8 text-xs bg-white">
                        <SelectValue placeholder="Atribuir Setor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem setor</SelectItem>
                        {sectors.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <TimeoffRequestDialog user={u} departmentId={departmentId} />
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                    Nenhum colaborador encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
