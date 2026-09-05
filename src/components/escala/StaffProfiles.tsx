import { useEffect, useState } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Palmtree } from 'lucide-react'
import { isVacationActive } from '@/lib/escala-vacation'
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import { CollaboratorImportDialog } from '@/components/CollaboratorImportDialog'
import { TimeoffRequestDialog } from './TimeoffRequestDialog'
import { useToast } from '@/components/ui/use-toast'
import {
  createStaffProfile,
  deleteStaffProfile,
  getHospitalSectors,
  getShiftCycles,
  getShiftRules,
  getShiftTypes,
  getStaffContracts,
  getStaffProfiles,
  getStaffRoles,
  createStaffContract,
  updateStaffContract,
  updateStaffProfile,
} from '@/services/escala'
import { parseDateOnly, civilParity, dayOfMonth } from '@/lib/escala-weekend-off'
import { useRealtime } from '@/hooks/use-realtime'

export type ShiftParity = 'even' | 'odd'

export type ProfileForm = {
  name: string
  professional_id: string
  staff_role: string
  default_sector: string
  rules: string[]
  active: boolean
  shift_parity: 'none' | ShiftParity
  cycle_start_date: string
  contract_type: string
  monthly_hour_limit: string
  shift_type: string
  vacation_enabled: boolean
  vacation_start: string
  vacation_end: string
}

const emptyForm: ProfileForm = {
  name: '',
  professional_id: '',
  staff_role: 'none',
  default_sector: 'none',
  rules: [],
  active: true,
  shift_parity: 'none',
  cycle_start_date: '',
  contract_type: 'none',
  monthly_hour_limit: '',
  shift_type: 'none',
  vacation_enabled: false,
  vacation_start: '',
  vacation_end: '',
}

const CONTRACT_TYPES = ['CLT 180h', 'PJ', 'Autônomo'] as const

export function StaffProfiles({ departmentId }: { departmentId?: string; projectId?: string }) {
  const [profiles, setProfiles] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [shiftTypes, setShiftTypes] = useState<any[]>([])
  const [cycles, setCycles] = useState<any[]>([])
  const [activeCycle, setActiveCycle] = useState<any>(null)
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([])
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  const [bulkSector, setBulkSector] = useState('none')
  const [bulkShiftType, setBulkShiftType] = useState('none')
  const [bulkContractType, setBulkContractType] = useState('CLT 180h')
  const [bulkHourLimit, setBulkHourLimit] = useState('180')
  const [isBulkSaving, setIsBulkSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<any>(null)
  const [formData, setFormData] = useState<ProfileForm>(emptyForm)
  const { toast } = useToast()

  const loadData = async () => {
    try {
      const [profileList, roleList, sectorList, ruleList, contractList, shiftTypeList, cycleList] =
        await Promise.all([
          getStaffProfiles().catch(() => []),
          getStaffRoles().catch(() => []),
          // Colaboradores podem ser realocados entre setores de qualquer
          // departamento; o combo deve usar o cadastro mestre completo.
          getHospitalSectors().catch(() => []),
          departmentId
            ? getShiftRules(departmentId).catch(() => [])
            : getShiftRules().catch(() => []),
          getStaffContracts().catch(() => []),
          getShiftTypes().catch(() => []),
          getShiftCycles().catch(() => []),
        ])
      setProfiles(profileList)
      setRoles(roleList)
      setSectors(sectorList)
      setRules(ruleList)
      setContracts(contractList)
      setShiftTypes(shiftTypeList)
      setCycles(cycleList)

      const active = cycleList.find((c: any) => c.status === 'active') || cycleList[0] || null
      setActiveCycle(active)
    } catch (error) {
      console.error('Failed to load collaborator profiles', error)
    }
  }

  useEffect(() => {
    loadData()
  }, [departmentId])

  useRealtime('staff_profiles', loadData)
  useRealtime('hospital_sectors', loadData)
  useRealtime('staff_roles', loadData)

  const openAdd = () => {
    setEditingProfile(null)
    const initialCycleStartDate = activeCycle
      ? activeCycle.start_date?.split(' ')[0].split('T')[0]
      : ''
    setFormData({
      ...emptyForm,
      cycle_start_date: initialCycleStartDate || '',
      vacation_enabled: false,
      vacation_start: '',
      vacation_end: '',
    })
    setIsFormOpen(true)
  }

  const openEdit = (profile: any) => {
    const linked =
      contracts.find((contract) => contract.staff_profile === profile.id) ||
      profile.expand?.staff_contracts
    const contract = Array.isArray(linked) ? linked[0] : linked
    const rawCycleStart = profile.cycle_start_date || ''
    const cleanCycleStart = rawCycleStart ? rawCycleStart.split(' ')[0].split('T')[0] : ''
    const cleanVacationStart = profile.vacation_start
      ? profile.vacation_start.split(' ')[0].split('T')[0]
      : ''
    const cleanVacationEnd = profile.vacation_end
      ? profile.vacation_end.split(' ')[0].split('T')[0]
      : ''

    setEditingProfile(profile)
    setFormData({
      name: profile.name || '',
      professional_id: profile.professional_id || '',
      staff_role: profile.staff_role || 'none',
      default_sector: profile.default_sector || 'none',
      rules: profile.rules || [],
      active: profile.active !== false,
      shift_parity:
        profile.shift_parity === 'even' || profile.shift_parity === 'odd'
          ? profile.shift_parity
          : 'none',
      cycle_start_date: cleanCycleStart,
      contract_type: contract?.contract_type || 'none',
      monthly_hour_limit:
        contract && contract.monthly_hour_limit != null ? String(contract.monthly_hour_limit) : '',
      shift_type: contract?.shift_type || 'none',
      vacation_enabled: Boolean(profile.vacation_enabled),
      vacation_start: cleanVacationStart,
      vacation_end: cleanVacationEnd,
    })
    setIsFormOpen(true)
  }

  const toggleRule = (ruleId: string, checked: boolean) => {
    setFormData((current) => ({
      ...current,
      rules: checked ? [...current.rules, ruleId] : current.rules.filter((id) => id !== ruleId),
    }))
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome do colaborador.',
        variant: 'destructive',
      })
      return
    }

    // Validação obrigatória: Dias de plantão (Paridade)
    if (formData.shift_parity !== 'even' && formData.shift_parity !== 'odd') {
      toast({
        title: 'Dias de plantão obrigatórios',
        description:
          'Selecione os dias de plantão do colaborador ("Dias pares" ou "Dias ímpares").',
        variant: 'destructive',
      })
      return
    }

    // Validação obrigatória: Início do plantão no ciclo
    const cleanDate = formData.cycle_start_date.trim()
    if (!cleanDate) {
      toast({
        title: 'Início do plantão obrigatório',
        description: 'Informe a data de início do primeiro plantão do colaborador no ciclo.',
        variant: 'destructive',
      })
      return
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      toast({
        title: 'Data inválida',
        description: 'A data de início do plantão deve estar no formato AAAA-MM-DD.',
        variant: 'destructive',
      })
      return
    }

    // Validação de ciclo e coerência de paridade relativa ao ciclo
    if (activeCycle) {
      const cStart = activeCycle.start_date
        ? activeCycle.start_date.split(' ')[0].split('T')[0]
        : ''
      const cEnd = activeCycle.end_date ? activeCycle.end_date.split(' ')[0].split('T')[0] : ''

      if (cStart && cEnd) {
        if (cleanDate < cStart || cleanDate > cEnd) {
          toast({
            title: 'Data fora do ciclo',
            description: `A data de início do plantão (${cleanDate}) deve pertencer ao período do ciclo ativo (${cStart} a ${cEnd}).`,
            variant: 'destructive',
          })
          return
        }

        // Validação de coerência com a paridade civil (even = dia civil par, odd = dia civil ímpar)
        const datePar = civilParity(cleanDate)
        const dom = dayOfMonth(cleanDate)

        if (formData.shift_parity !== datePar) {
          const expectedParityLabel =
            formData.shift_parity === 'even'
              ? 'Dias pares (dias civis pares: 2, 4, 6, 8...)'
              : 'Dias ímpares (dias civis ímpares: 1, 3, 5, 7...)'
          const actualLabel =
            datePar === 'even' ? `dia civil par (${dom})` : `dia civil ímpar (${dom})`

          toast({
            title: 'Incoerência com a paridade civil selecionada',
            description: `A data de início informada (${cleanDate}) é um ${actualLabel}, mas você selecionou "${expectedParityLabel}". Ajuste a data ou a paridade para manter a alternância civil correta.`,
            variant: 'destructive',
          })
          return
        }
      }
    }

    // Validação de Férias
    const vStart = formData.vacation_start.trim()
    const vEnd = formData.vacation_end.trim()
    if (formData.vacation_enabled) {
      if (!vStart || !vEnd) {
        toast({
          title: 'Datas de férias obrigatórias',
          description: 'Ao ativar as férias, as datas "De" e "Até" são obrigatórias.',
          variant: 'destructive',
        })
        return
      }
      if (vEnd < vStart) {
        toast({
          title: 'Período de férias inválido',
          description:
            'A data final de férias ("Até") deve ser igual ou posterior à data inicial ("De").',
          variant: 'destructive',
        })
        return
      }
    }

    const payload = {
      name: formData.name.trim(),
      professional_id: formData.professional_id.trim(),
      staff_role: formData.staff_role === 'none' ? null : formData.staff_role,
      default_sector: formData.default_sector === 'none' ? null : formData.default_sector,
      rules: formData.rules,
      active: formData.active,
      shift_parity: formData.shift_parity,
      cycle_start_date: cleanDate,
      vacation_enabled: formData.vacation_enabled,
      vacation_start: formData.vacation_enabled && vStart ? `${vStart} 00:00:00.000Z` : null,
      vacation_end: formData.vacation_enabled && vEnd ? `${vEnd} 00:00:00.000Z` : null,
    }

    // Contract data entered inline on the collaborator form. When a contract
    // type is selected we upsert a staff_contracts record linked to THIS
    // staff_profile (never to a portal user id). When "none" is selected and a
    // contract already exists for the profile, it is left untouched here (the
    // dedicated Contratos tab is the place to manage/remove it).
    const hasContract = formData.contract_type !== 'none'
    const contractPayload = {
      staff_profile: editingProfile ? editingProfile.id : '',
      contract_type: formData.contract_type,
      monthly_hour_limit: Number(formData.monthly_hour_limit) || 0,
      shift_type: formData.shift_type === 'none' ? null : formData.shift_type,
    }

    try {
      if (editingProfile) {
        await updateStaffProfile(editingProfile.id, payload)
        if (hasContract) {
          const existing = contracts.find(
            (contract) => contract.staff_profile === editingProfile.id,
          )
          if (existing) {
            await updateStaffContract(existing.id, {
              ...contractPayload,
              staff_profile: editingProfile.id,
            })
          } else {
            await createStaffContract(contractPayload)
          }
        }
        toast({ title: 'Cadastro atualizado com sucesso' })
      } else {
        const created = await createStaffProfile(payload)
        const createdId = created?.id
        if (hasContract && createdId) {
          await createStaffContract({ ...contractPayload, staff_profile: createdId })
        }
        toast({ title: 'Colaborador cadastrado com sucesso' })
      }
      setIsFormOpen(false)
      setEditingProfile(null)
      setFormData(emptyForm)
      loadData()
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar cadastro',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteStaffProfile(id)
      toast({ title: 'Colaborador removido com sucesso' })
      loadData()
    } catch (error: any) {
      toast({
        title: 'Erro ao remover colaborador',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleBulkSave = async () => {
    if (
      selectedProfiles.length === 0 ||
      bulkSector === 'none' ||
      bulkShiftType === 'none' ||
      Number(bulkHourLimit) <= 0
    ) {
      toast({
        title: 'Configuração incompleta',
        description: 'Selecione colaboradores, setor, tipo de turno e carga horária.',
        variant: 'destructive',
      })
      return
    }

    setIsBulkSaving(true)
    try {
      for (const profileId of selectedProfiles) {
        await updateStaffProfile(profileId, {
          default_sector: bulkSector,
          active: true,
        })
        const currentContract = contracts.find((contract) => contract.staff_profile === profileId)
        const contractPayload = {
          staff_profile: profileId,
          contract_type: bulkContractType,
          monthly_hour_limit: Number(bulkHourLimit),
          shift_type: bulkShiftType,
        }
        if (currentContract) {
          await updateStaffContract(currentContract.id, contractPayload)
        } else {
          await createStaffContract(contractPayload)
        }
      }
      toast({
        title: 'Configuração concluída',
        description: `${selectedProfiles.length} colaborador(es) integrados ao setor e aos contratos.`,
      })
      setSelectedProfiles([])
      setIsBulkOpen(false)
      await loadData()
    } catch (error: any) {
      toast({
        title: 'Erro na configuração em lote',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsBulkSaving(false)
    }
  }

  const filteredProfiles = profiles.filter((profile) => {
    if (!searchTerm) return true
    const query = searchTerm.toLowerCase()
    return (
      profile.name?.toLowerCase().includes(query) ||
      profile.professional_id?.toLowerCase().includes(query) ||
      profile.expand?.staff_role?.name?.toLowerCase().includes(query) ||
      profile.expand?.default_sector?.name?.toLowerCase().includes(query)
    )
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border-slate-200 bg-white">
        <CardHeader className="pb-3 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Cadastro de Colaboradores
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastro operacional integrado a contratos, folgas e geração de escalas. Estes
              colaboradores não são usuários do portal.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
            <div className="relative sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Buscar por nome, registro, cargo ou setor..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsBulkOpen(true)}
              disabled={selectedProfiles.length === 0}
            >
              Configurar em lote ({selectedProfiles.length})
            </Button>
            <CollaboratorImportDialog onImported={loadData} />
            <Button size="sm" onClick={openAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Colaborador
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Selecionar colaboradores exibidos"
                    checked={
                      filteredProfiles.length > 0 &&
                      filteredProfiles.every((profile) => selectedProfiles.includes(profile.id))
                    }
                    onCheckedChange={(checked) =>
                      setSelectedProfiles((current) =>
                        checked === true
                          ? Array.from(
                              new Set([
                                ...current,
                                ...filteredProfiles.map((profile) => profile.id),
                              ]),
                            )
                          : current.filter(
                              (id) => !filteredProfiles.some((profile) => profile.id === id),
                            ),
                      )
                    }
                  />
                </TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Registro Profissional</TableHead>
                <TableHead>Cargo / Função</TableHead>
                <TableHead>Setor Padrão</TableHead>
                <TableHead>Dias de Plantão</TableHead>
                <TableHead>Início no Ciclo</TableHead>
                <TableHead>Férias</TableHead>
                <TableHead>Regras</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Selecionar ${profile.name}`}
                      checked={selectedProfiles.includes(profile.id)}
                      onCheckedChange={(checked) =>
                        setSelectedProfiles((current) =>
                          checked === true
                            ? [...current, profile.id]
                            : current.filter((id) => id !== profile.id),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="font-medium text-slate-700">
                    <div className="flex items-center gap-2">
                      <span>{profile.name}</span>
                      {profile.active === false && (
                        <Badge variant="outline" className="text-slate-500">
                          Inativo
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {profile.professional_id || '-'}
                  </TableCell>
                  <TableCell>
                    {profile.expand?.staff_role?.name ? (
                      <Badge variant="secondary" className="font-normal">
                        {profile.expand.staff_role.name}
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-400">Sem cargo</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {profile.expand?.default_sector?.name || 'Sem setor'}
                  </TableCell>
                  <TableCell>
                    {profile.shift_parity === 'even' ? (
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-blue-700 border-blue-200 font-medium"
                      >
                        Dias pares
                      </Badge>
                    ) : profile.shift_parity === 'odd' ? (
                      <Badge
                        variant="outline"
                        className="bg-purple-50 text-purple-700 border-purple-200 font-medium"
                      >
                        Dias ímpares
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-amber-700 bg-amber-50 border-amber-200 font-normal"
                      >
                        Não definido (Legado)
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {profile.cycle_start_date ? (
                      <span className="font-mono text-xs">
                        {profile.cycle_start_date.split(' ')[0].split('T')[0]}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600">Padrão do setor/ciclo</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isVacationActive(profile) ? (
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium flex items-center gap-1 w-fit"
                      >
                        <Palmtree className="h-3 w-3" />
                        <span>
                          {profile.vacation_start?.split(' ')[0].split('T')[0]} a{' '}
                          {profile.vacation_end?.split(' ')[0].split('T')[0]}
                        </span>
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {profile.rules?.length ? (
                      <Badge variant="outline">{profile.rules.length} regra(s)</Badge>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <TimeoffRequestDialog staffProfile={profile} departmentId={departmentId} />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Alterar cadastro de ${profile.name}`}
                        onClick={() => openEdit(profile)}
                      >
                        <Pencil className="h-4 w-4 text-slate-500" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            aria-label={`Excluir ${profile.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Colaborador</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir o cadastro de {profile.name}? Cadastros
                              com contratos, folgas ou plantões vinculados não podem ser excluídos.
                              Para preservar o histórico, prefira desativar o colaborador.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-500 hover:bg-red-600 text-white"
                              onClick={() => handleDelete(profile.id)}
                            >
                              Confirmar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProfiles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                    Nenhum colaborador encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configuração Operacional em Lote</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Aplique setor e contrato aos {selectedProfiles.length} colaboradores selecionados. Esta
            configuração os torna elegíveis para a geração automática.
          </p>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label>Setor</Label>
              <Select value={bulkSector} onValueChange={setBulkSector}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {sectors.map((sector) => (
                    <SelectItem key={sector.id} value={sector.id}>
                      {sector.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de contrato</Label>
              <Select value={bulkContractType} onValueChange={setBulkContractType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLT 180h">CLT 180h</SelectItem>
                  <SelectItem value="PJ">PJ</SelectItem>
                  <SelectItem value="Autônomo">Autônomo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Limite mensal de horas</Label>
              <Input
                type="number"
                min="1"
                value={bulkHourLimit}
                onChange={(event) => setBulkHourLimit(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de turno</Label>
              <Select value={bulkShiftType} onValueChange={setBulkShiftType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de turno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {shiftTypes.map((shiftType) => (
                    <SelectItem key={shiftType.id} value={shiftType.id}>
                      {shiftType.name} ({shiftType.work_hours}h/{shiftType.rest_hours}h)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkOpen(false)} disabled={isBulkSaving}>
              Cancelar
            </Button>
            <Button onClick={handleBulkSave} disabled={isBulkSaving}>
              {isBulkSaving ? 'Configurando...' : 'Aplicar configuração'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProfile ? 'Alterar Cadastro de Colaborador' : 'Novo Colaborador'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                placeholder="Nome do colaborador"
              />
            </div>
            <div className="space-y-2">
              <Label>
                Registro Profissional (CRM / COREN){' '}
                <span className="font-normal text-slate-400">(opcional)</span>
              </Label>
              <Input
                value={formData.professional_id}
                onChange={(event) =>
                  setFormData({ ...formData, professional_id: event.target.value })
                }
                placeholder="Ex.: CRM/SP 123456 ou COREN-SP 123456"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Cargo / Função</Label>
              <Select
                value={formData.staff_role}
                onValueChange={(value) => setFormData({ ...formData, staff_role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cargo</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Setor Padrão</Label>
              <Select
                value={formData.default_sector}
                onValueChange={(value) => setFormData({ ...formData, default_sector: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem setor</SelectItem>
                  {sectors.map((sector) => (
                    <SelectItem key={sector.id} value={sector.id}>
                      {sector.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Configuração Obrigatória de Paridade e Âncora no Ciclo */}
            <div className="space-y-3 pt-3 border-t bg-slate-50/50 p-3 rounded-lg border">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-slate-800">
                  Paridade e Alternância de Escala
                </Label>
                <Badge variant="secondary" className="text-[10px] font-normal">
                  Obrigatório
                </Badge>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shift-parity-select" className="text-xs font-medium text-slate-700">
                  Dias de plantão <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.shift_parity}
                  onValueChange={(value: 'even' | 'odd') => {
                    setFormData((prev) => {
                      const next = { ...prev, shift_parity: value }
                      // Se houver ciclo ativo e data não preenchida ou vazia, sugere a data correspondente à paridade civil
                      if (activeCycle) {
                        const cStart = activeCycle.start_date
                          ? activeCycle.start_date.split(' ')[0].split('T')[0]
                          : ''
                        if (cStart) {
                          const startParity = civilParity(cStart)
                          if (startParity === value) {
                            next.cycle_start_date = cStart
                          } else {
                            const { y, m, d } = parseDateOnly(cStart)
                            const nextDate = new Date(Date.UTC(y, m - 1, d + 1))
                              .toISOString()
                              .split('T')[0]
                            next.cycle_start_date = nextDate
                          }
                        }
                      }
                      return next
                    })
                  }}
                >
                  <SelectTrigger id="shift-parity-select" className="bg-white">
                    <SelectValue placeholder="Selecione a paridade..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="even">Dias pares (dia civil par)</SelectItem>
                    <SelectItem value="odd">Dias ímpares (dia civil ímpar)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Define a equipe de alternância 12x36 do colaborador baseada na paridade do dia
                  civil do calendário (ex: 2, 4, 8 vs 1, 3, 5).
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="cycle-start-date-input"
                  className="text-xs font-medium text-slate-700"
                >
                  Início do plantão no ciclo <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="cycle-start-date-input"
                  type="date"
                  value={formData.cycle_start_date}
                  min={
                    activeCycle?.start_date
                      ? activeCycle.start_date.split(' ')[0].split('T')[0]
                      : undefined
                  }
                  max={
                    activeCycle?.end_date
                      ? activeCycle.end_date.split(' ')[0].split('T')[0]
                      : undefined
                  }
                  onChange={(event) =>
                    setFormData({ ...formData, cycle_start_date: event.target.value })
                  }
                  className="bg-white"
                />
                <p className="text-[11px] text-muted-foreground">
                  Data civil de início do plantão no ciclo. Deve respeitar a paridade civil
                  selecionada (dias pares ou dias ímpares do calendário).
                </p>
                {activeCycle && (
                  <div className="text-[11px] text-slate-500 bg-white/80 p-2 rounded border">
                    Ciclo ativo:{' '}
                    <span className="font-semibold text-slate-700">{activeCycle.name}</span> (
                    {activeCycle.start_date?.split(' ')[0].split('T')[0]} a{' '}
                    {activeCycle.end_date?.split(' ')[0].split('T')[0]})
                  </div>
                )}
              </div>
            </div>

            {/* Seção de Férias */}
            <div className="space-y-3 pt-3 border-t bg-emerald-50/40 p-3 rounded-lg border border-emerald-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palmtree className="h-4 w-4 text-emerald-600" />
                  <Label htmlFor="vacation-switch" className="text-sm font-semibold text-slate-800">
                    Férias
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">Ativar período de férias</span>
                  <Switch
                    id="vacation-switch"
                    checked={formData.vacation_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, vacation_enabled: checked })
                    }
                  />
                </div>
              </div>

              {formData.vacation_enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="vacation-start" className="text-xs font-medium text-slate-700">
                      De <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="vacation-start"
                      type="date"
                      value={formData.vacation_start}
                      onChange={(event) =>
                        setFormData({ ...formData, vacation_start: event.target.value })
                      }
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vacation-end" className="text-xs font-medium text-slate-700">
                      Até <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="vacation-end"
                      type="date"
                      value={formData.vacation_end}
                      min={formData.vacation_start || undefined}
                      onChange={(event) =>
                        setFormData({ ...formData, vacation_end: event.target.value })
                      }
                      className="bg-white"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground col-span-1 sm:col-span-2">
                    Durante o período de férias (inclusive início e fim), o colaborador não será
                    alocado na escala automática nem poderá receber plantões manuais.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-md border p-3 bg-slate-50">
              <Checkbox
                id="profile-active"
                checked={formData.active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, active: checked === true })
                }
              />
              <Label htmlFor="profile-active" className="cursor-pointer">
                Ativo para geração de escalas
              </Label>
            </div>
            <div className="space-y-2">
              <Label>Regras Associadas</Label>
              <ScrollArea className="h-36 border rounded-md p-2 bg-slate-50">
                {rules.length === 0 ? (
                  <p className="text-xs text-slate-500 p-3 text-center">
                    Nenhuma regra cadastrada.
                  </p>
                ) : (
                  rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center space-x-2 py-1.5 px-1 hover:bg-slate-100 rounded"
                    >
                      <Checkbox
                        id={`profile-rule-${rule.id}`}
                        checked={formData.rules.includes(rule.id)}
                        onCheckedChange={(checked) => toggleRule(rule.id, checked === true)}
                      />
                      <label
                        htmlFor={`profile-rule-${rule.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {rule.name}
                      </label>
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>
            <div className="space-y-3 pt-3 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Contrato e Regime de Escala</Label>
                <span className="text-[11px] text-slate-400">
                  Vinculado ao colaborador operacional
                </span>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Contrato</Label>
                <Select
                  value={formData.contract_type}
                  onValueChange={(value) => setFormData({ ...formData, contract_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem contrato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem contrato</SelectItem>
                    {CONTRACT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formData.contract_type !== 'none' && (
                <>
                  <div className="space-y-2">
                    <Label>Limite Mensal de Horas</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.monthly_hour_limit}
                      onChange={(event) =>
                        setFormData({ ...formData, monthly_hour_limit: event.target.value })
                      }
                      placeholder="Ex.: 180"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Regime de Escala (Tipo de Turno)</Label>
                    <Select
                      value={formData.shift_type}
                      onValueChange={(value) => setFormData({ ...formData, shift_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de turno" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não associado</SelectItem>
                        {shiftTypes.map((shiftType) => (
                          <SelectItem key={shiftType.id} value={shiftType.id}>
                            {shiftType.name} ({shiftType.work_hours}h/{shiftType.rest_hours}h)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
