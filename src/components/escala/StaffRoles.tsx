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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Trash2, AlertTriangle, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { getStaffRoles, createStaffRole, updateStaffRole, deleteStaffRole } from '@/services/escala'
import { useRealtime } from '@/hooks/use-realtime'

export function StaffRoles() {
  const [roles, setRoles] = useState<any[]>([])
  const [name, setName] = useState('')
  const [rank, setRank] = useState(0)
  const [reqSup, setReqSup] = useState(false)
  const { toast } = useToast()

  const loadData = async () => getStaffRoles().then(setRoles)
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('staff_roles', loadData)

  const handleCreate = async () => {
    if (!name)
      return toast({ title: 'Erro', description: 'Nome obrigatório', variant: 'destructive' })
    try {
      await createStaffRole({ name, hierarchy_rank: rank, requires_supervision: reqSup })
      setName('')
      setRank(0)
      setReqSup(false)
      toast({ title: 'Função criada' })
    } catch {
      toast({ title: 'Erro', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteStaffRole(id)
      toast({ title: 'Removido' })
    } catch {
      toast({ title: 'Erro', variant: 'destructive' })
    }
  }

  const handleUpdate = async (id: string, field: string, val: any) => {
    try {
      await updateStaffRole(id, { [field]: val })
    } catch {
      toast({ title: 'Erro', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nova Função</CardTitle>
          <CardDescription>Crie uma função na hierarquia assistencial.</CardDescription>{' '}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Nome da Função</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Enfermeiro Júnior"
              />
            </div>
            <div className="space-y-2">
              <Label>Ranking Hierárquico</Label>
              <Input type="number" value={rank} onChange={(e) => setRank(Number(e.target.value))} />
            </div>
            <div className="flex items-center space-x-2 h-10">
              <Checkbox
                id="reqsup"
                checked={reqSup}
                onCheckedChange={(c) => setReqSup(c as boolean)}
              />
              <label htmlFor="reqsup" className="text-sm font-medium leading-none">
                Requer Supervisão
              </label>
            </div>
            <Button onClick={handleCreate} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Função
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Funções Existentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Ranking</TableHead>
                <TableHead>Supervisão</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Input
                      defaultValue={r.name}
                      onBlur={(e) => handleUpdate(r.id, 'name', e.target.value)}
                      className="w-48 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      defaultValue={r.hierarchy_rank}
                      onBlur={(e) => handleUpdate(r.id, 'hierarchy_rank', Number(e.target.value))}
                      className="w-20 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    {r.requires_supervision ? (
                      <Badge
                        variant="outline"
                        className="text-orange-600 bg-orange-50 border-orange-200"
                      >
                        <AlertTriangle className="w-3 h-3 mr-1" /> Sim
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-500">
                        Não
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
