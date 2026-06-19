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
import {
  getStaffProfiles,
  createStaffProfile,
  deleteStaffProfile,
  getShiftRules,
} from '@/services/escala'
import { useRealtime } from '@/hooks/use-realtime'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'

export function StaffProfiles({ departmentId }: { departmentId?: string }) {
  const [profiles, setProfiles] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [name, setName] = useState('')
  const [selectedRules, setSelectedRules] = useState<string[]>([])
  const { toast } = useToast()

  const loadData = async () => {
    try {
      const [p, r] = await Promise.all([
        getStaffProfiles().catch(() => []),
        departmentId ? getShiftRules(departmentId).catch(() => []) : Promise.resolve([]),
      ])
      setProfiles(p)
      setRules(r)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [departmentId])

  useRealtime('staff_profiles', loadData)

  const handleCreate = async () => {
    if (!name) {
      return toast({
        title: 'Erro',
        description: 'Nome do perfil é obrigatório',
        variant: 'destructive',
      })
    }
    try {
      await createStaffProfile({
        name,
        rules: selectedRules,
      })
      setName('')
      setSelectedRules([])
      toast({ title: 'Perfil criado' })
    } catch {
      toast({ title: 'Erro ao criar perfil', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteStaffProfile(id)
      toast({ title: 'Perfil removido' })
    } catch {
      toast({ title: 'Erro ao remover perfil', variant: 'destructive' })
    }
  }

  const toggleRule = (ruleId: string, checked: boolean) => {
    if (checked) {
      setSelectedRules([...selectedRules, ruleId])
    } else {
      setSelectedRules(selectedRules.filter((id) => id !== ruleId))
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle>Novo Perfil de Colaborador</CardTitle>
          <CardDescription>
            Crie perfis (templates) com regras pré-configuradas para facilitar o cadastro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Nome do Perfil</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Enfermeiro Padrão"
              />
            </div>
            <div className="space-y-2">
              <Label>Regras do Perfil</Label>
              <ScrollArea className="h-32 border rounded-md p-2 bg-slate-50">
                {rules.length === 0 ? (
                  <p className="text-xs text-slate-500 p-2 text-center">
                    Nenhuma regra cadastrada. Adicione regras na aba Regras primeiro.
                  </p>
                ) : (
                  rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center space-x-2 py-1.5 px-1 hover:bg-slate-100 rounded"
                    >
                      <Checkbox
                        id={`pr-rule-${rule.id}`}
                        checked={selectedRules.includes(rule.id)}
                        onCheckedChange={(checked) => toggleRule(rule.id, checked === true)}
                      />
                      <label
                        htmlFor={`pr-rule-${rule.id}`}
                        className="text-sm font-normal cursor-pointer flex-1 leading-tight"
                      >
                        {rule.name}
                      </label>
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>
          </div>
          <Button onClick={handleCreate} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Perfil
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Perfis Cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Perfil</TableHead>
                <TableHead>Total de Regras</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.rules?.length || 0} regra(s)</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {profiles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    Nenhum perfil cadastrado.
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
