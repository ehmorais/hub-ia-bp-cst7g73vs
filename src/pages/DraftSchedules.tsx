import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Search, Send, CalendarClock, Filter } from 'lucide-react'
import { format } from 'date-fns'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { Badge } from '@/components/ui/badge'

import pb from '@/lib/pocketbase/client'
import { submitCycleToHR } from '@/services/escala'

export default function DraftSchedules() {
  const [drafts, setDrafts] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedDraft, setSelectedDraft] = useState<any>(null)

  const { toast } = useToast()

  const loadDrafts = async () => {
    try {
      setLoading(true)
      const records = await pb.collection('shift_cycles').getFullList({
        filter: `status = 'draft'`,
        sort: '-created',
      })
      setDrafts(records)
    } catch (error) {
      console.error('Failed to load drafts:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os rascunhos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDrafts()
  }, [])

  const handleSubmit = async () => {
    if (!selectedDraft) return

    try {
      setSubmittingId(selectedDraft.id)
      await pb.send('/backend/v1/escala/submit-hr', {
        method: 'POST',
        body: JSON.stringify({ cycle_id: selectedDraft.id }),
      })
      toast({ title: 'Sucesso', description: 'Escala gravada e enviada ao RH com sucesso.' })
      setIsDialogOpen(false)
      setSelectedDraft(null)
      loadDrafts()
    } catch (error: any) {
      console.error('Submission failed:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao enviar ao RH.',
        variant: 'destructive',
      })
    } finally {
      setSubmittingId(null)
    }
  }

  const filteredDrafts = drafts.filter((d) => {
    const matchesName = d.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStart = startDate ? d.start_date.startsWith(startDate) : true
    const matchesEnd = endDate ? d.end_date.startsWith(endDate) : true
    return matchesName && matchesStart && matchesEnd
  })

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Rascunhos de Escala</h1>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Escalas Pendentes
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Revise e submeta as escalas para aprovação do RH.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Filtrar por nome..."
                className="pl-8 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Input
                type="date"
                className="w-[130px] hidden sm:block"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                type="date"
                className="w-[130px] hidden sm:block"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <Select defaultValue="all">
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Setores</SelectItem>
                  <SelectItem value="uti">UTI</SelectItem>
                  <SelectItem value="emergencia">Emergência</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="all">
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Gestor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Gestores</SelectItem>
                  <SelectItem value="me">Meus Rascunhos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Carregando...</div>
          ) : filteredDrafts.length === 0 ? (
            <div className="py-12 text-center border rounded-lg bg-slate-50 border-dashed">
              <p className="text-muted-foreground">Nenhum rascunho de escala encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Prazo de Folgas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDrafts.map((draft) => (
                    <TableRow key={draft.id}>
                      <TableCell className="font-medium whitespace-nowrap">{draft.name}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(draft.start_date), 'dd/MM/yyyy')} a{' '}
                        {format(new Date(draft.end_date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(draft.request_deadline), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Rascunho</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedDraft(draft)
                            setIsDialogOpen(true)
                          }}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Gravar e Submeter ao RH
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submeter ao RH</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja submeter a escala <strong>{selectedDraft?.name}</strong> ao RH?
              Esta ação mudará o status para ativo e notificará o departamento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={submittingId !== null}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submittingId !== null}>
              {submittingId === selectedDraft?.id ? 'Submetendo...' : 'Confirmar Submissão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
