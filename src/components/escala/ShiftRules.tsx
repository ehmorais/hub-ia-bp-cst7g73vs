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
import { Trash2, Plus, Info } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import pb from '@/lib/pocketbase/client'
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
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface ShiftRulesProps {
  departmentId?: string
  readOnly?: boolean
}

export function ShiftRules({ departmentId, readOnly = false }: ShiftRulesProps) {
  const [rules, setRules] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [name, setName] = useState('')
  const [type, setType] = useState('min_staff')
  const [value, setValue] = useState<number | ''>('')
  const [prompt, setPrompt] = useState('')
  const [selectedDeptId, setSelectedDeptId] = useState<string>(departmentId || '')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { toast } = useToast()

  const loadData = async () => {
    try {
      let filter = ''
      if (departmentId) {
        filter = `department = "${departmentId}"`
      }
      const rulesData = await pb.collection('shift_rules').getFullList({
        filter,
        expand: 'department',
        sort: '-created',
      })
      setRules(rulesData)

      if (!readOnly) {
        const depts = await pb.collection('departments').getFullList({ sort: 'name' })
        setDepartments(depts)
      }
    } catch (err) {
      console.error(err)
      setRules([])
    }
  }

  useEffect(() => {
    loadData()
  }, [departmentId, readOnly])

  useRealtime('shift_rules', loadData)

  const handleCreate = async () => {
    const newErrors: Record<string, string> = {}
    if (!name) newErrors.name = 'Nome da regra é obrigatório'
    const deptToSave = departmentId || selectedDeptId
    if (!deptToSave) newErrors.department = 'Departamento é obrigatório'
    if (type !== 'custom_prompt' && value === '') {
      newErrors.value = 'Valor base é obrigatório'
    }
    if (type === 'custom_prompt' && !prompt.trim()) {
      newErrors.prompt = 'Instrução (prompt) é obrigatória'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    try {
      await pb.collection('shift_rules').create({
        name,
        rule_type: type,
        value: type === 'custom_prompt' ? 0 : Number(value),
        prompt: type === 'custom_prompt' ? prompt : '',
        department: deptToSave,
      })
      setName('')
      setValue('')
      setPrompt('')
      setSelectedDeptId(departmentId || '')
      setIsDialogOpen(false)
      toast({ title: 'Regra criada com sucesso' })
    } catch {
      toast({ title: 'Erro ao criar regra', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await pb.collection('shift_rules').delete(id)
      toast({ title: 'Regra removida' })
    } catch {
      toast({ title: 'Erro ao remover regra', variant: 'destructive' })
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
          {readOnly
            ? 'Regras específicas aplicadas neste departamento.'
            : 'Gerencie as regras globais e específicas de escala.'}
        </p>
        {!readOnly && (
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
                  <Label>
                    Nome da Regra <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (errors.name) setErrors((prev) => ({ ...prev, name: '' }))
                    }}
                    placeholder="Ex: Regra Fim de Semana"
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                </div>

                {!departmentId && (
                  <div className="space-y-2">
                    <Label>
                      Departamento <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={selectedDeptId}
                      onValueChange={(val) => {
                        setSelectedDeptId(val)
                        if (errors.department) setErrors((prev) => ({ ...prev, department: '' }))
                      }}
                    >
                      <SelectTrigger className={errors.department ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Selecione um departamento..." />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.department && (
                      <p className="text-xs text-red-500">{errors.department}</p>
                    )}
                  </div>
                )}

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
                    <Label>
                      Valor Base <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      value={value}
                      onChange={(e) => {
                        setValue(e.target.value ? Number(e.target.value) : '')
                        if (errors.value) setErrors((prev) => ({ ...prev, value: '' }))
                      }}
                      className={errors.value ? 'border-red-500' : ''}
                    />
                    {errors.value && <p className="text-xs text-red-500">{errors.value}</p>}
                  </div>
                )}

                {type === 'custom_prompt' && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Instruções da IA <span className="text-red-500">*</span>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </Label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => {
                        setPrompt(e.target.value)
                        if (errors.prompt) setErrors((prev) => ({ ...prev, prompt: '' }))
                      }}
                      placeholder="Ex: Não escalar o colaborador X com o colaborador Y aos fins de semana..."
                      className={cn(
                        'min-h-[100px] resize-y',
                        errors.prompt ? 'border-red-500' : '',
                      )}
                    />
                    {errors.prompt ? (
                      <p className="text-xs text-red-500">{errors.prompt}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        O modelo de IA interpretará este prompt para ajustar a escala.
                      </p>
                    )}
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
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Regras Ativas</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                {!departmentId && <TableHead>Departamento</TableHead>}
                <TableHead>Valor / Detalhes</TableHead>
                {!readOnly && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={r.rule_type === 'custom_prompt' ? 'default' : 'secondary'}
                      className="font-normal"
                    >
                      {getTypeLabel(r.rule_type)}
                    </Badge>
                  </TableCell>
                  {!departmentId && (
                    <TableCell>
                      {r.expand?.department?.name || (
                        <span className="text-muted-foreground italic">Nenhum</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    {r.rule_type === 'custom_prompt' ? (
                      <span
                        className="text-muted-foreground text-sm line-clamp-2 max-w-[300px]"
                        title={r.prompt}
                      >
                        {r.prompt}
                      </span>
                    ) : (
                      <span className="font-mono">{r.value}</span>
                    )}
                  </TableCell>
                  {!readOnly && (
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
                  )}
                </TableRow>
              ))}
              {rules.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={readOnly ? 3 : !departmentId ? 5 : 4}
                    className="text-center text-muted-foreground py-8"
                  >
                    Nenhuma regra cadastrada.
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
