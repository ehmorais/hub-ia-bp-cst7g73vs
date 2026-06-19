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
import { Textarea } from '@/components/ui/textarea'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'

export function ShiftRules({ departmentId }: { departmentId?: string }) {
  const [rules, setRules] = useState<any[]>([])
  const [name, setName] = useState('')
  const [type, setType] = useState('min_staff')
  const [value, setValue] = useState<number | ''>('')
  const [prompt, setPrompt] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
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
    if (!name || !departmentId) {
      return toast({
        title: 'Erro',
        description: 'Nome da regra é obrigatório',
        variant: 'destructive',
      })
    }
    if (type !== 'custom_prompt' && value === '') {
      return toast({
        title: 'Erro',
        description: 'Valor base é obrigatório para este tipo de regra',
        variant: 'destructive',
      })
    }
    if (type === 'custom_prompt' && !prompt.trim()) {
      return toast({
        title: 'Erro',
        description: 'Instrução (prompt) é obrigatória',
        variant: 'destructive',
      })
    }
    try {
      await createShiftRule({
        name,
        rule_type: type,
        value: type === 'custom_prompt' ? 0 : Number(value),
        prompt: type === 'custom_prompt' ? prompt : '',
        department: departmentId,
      })
      setName('')
      setValue('')
      setPrompt('')
      setIsDialogOpen(false)
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
      custom_prompt: 'Customizada (IA)',
    }
    return labels[t] || t
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">
          Gerencie as regras específicas aplicadas neste departamento.
        </p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Regra
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Nova Regra de Escala</DialogTitle>
              <DialogDescription>
                Defina restrições que o motor de geração automática deve respeitar.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Nome da Regra</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Regra Fim de Semana"
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
                    <SelectItem value="custom_prompt">Regra Customizada (IA)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {type !== 'custom_prompt' && (
                <div className="space-y-2">
                  <Label>Valor Base</Label>
                  <Input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value ? Number(e.target.value) : '')}
                  />
                </div>
              )}

              {type === 'custom_prompt' && (
                <div className="space-y-2">
                  <Label>Regra Description (IA Prompt)</Label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ex: Não escalar o colaborador X com o colaborador Y aos fins de semana..."
                    className="min-h-[100px] resize-y"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate}>Salvar Regra</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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
                  <TableCell>
                    {r.rule_type === 'custom_prompt' ? (
                      <span
                        className="text-muted-foreground text-sm line-clamp-2 max-w-[300px]"
                        title={r.prompt}
                      >
                        {r.prompt}
                      </span>
                    ) : (
                      r.value
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir esta regra? Esta ação não pode ser
                            desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(r.id)}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
