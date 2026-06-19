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
import { Label } from '@/components/ui/label'
import { Trash2, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { getShiftRules, createShiftRule, deleteShiftRule } from '@/services/escala'
import { useRealtime } from '@/hooks/use-realtime'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function ShiftRules({ departmentId }: { departmentId?: string }) {
  const [rules, setRules] = useState<any[]>([])
  const [name, setName] = useState('')
  const [type, setType] = useState('min_staff')
  const [value, setValue] = useState<number | ''>('')
  const { toast } = useToast()

  const loadData = async () => {
    if (departmentId) {
      getShiftRules(departmentId)
        .then(setRules)
        .catch((err) => {
          console.error(err)
          setRules([])
        })
    }
  }

  useEffect(() => {
    loadData()
  }, [departmentId])

  useRealtime('shift_rules', loadData)

  const handleCreate = async () => {
    if (!name || !departmentId || value === '') {
      return toast({
        title: 'Erro',
        description: 'Todos os campos são obrigatórios',
        variant: 'destructive',
      })
    }
    try {
      await createShiftRule({
        name,
        rule_type: type,
        value: Number(value),
        department: departmentId,
      })
      setName('')
      setValue('')
      toast({ title: 'Regra criada' })
    } catch {
      toast({ title: 'Erro', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteShiftRule(id)
      toast({ title: 'Removido' })
    } catch {
      toast({ title: 'Erro', variant: 'destructive' })
    }
  }

  const getTypeLabel = (t: string) => {
    const labels: Record<string, string> = {
      min_staff: 'Mínimo de Colaboradores',
      max_consecutive: 'Máx. Plantões Consecutivos',
      professional_mix: 'Mix Profissional',
      max_hours: 'Máximo de Horas/Mês',
      min_rest_hours: 'Mínimo Horas Descanso',
      other: 'Outra Regra',
    }
    return labels[t] || t
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle>Nova Regra de Escala</CardTitle>
          <CardDescription>
            Defina restrições que o motor de geração automática deve respeitar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Nome da Regra</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Folga mínima 36h"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Restrição</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="min_staff">Mínimo de Colaboradores</SelectItem>
                  <SelectItem value="max_consecutive">Máx. Plantões Consecutivos</SelectItem>
                  <SelectItem value="professional_mix">Mix Profissional</SelectItem>
                  <SelectItem value="max_hours">Máximo de Horas/Mês</SelectItem>
                  <SelectItem value="min_rest_hours">Mínimo Horas Descanso</SelectItem>
                  <SelectItem value="other">Outra Regra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor Base</Label>
              <Input
                type="number"
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
              />
            </div>
            <Button onClick={handleCreate} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Regra
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regras Ativas do Departamento</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{getTypeLabel(r.rule_type)}</TableCell>
                  <TableCell>{r.value}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhuma regra cadastrada para este departamento.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
