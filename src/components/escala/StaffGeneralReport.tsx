import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Download,
  FileSpreadsheet,
  FileText,
  RotateCw,
  Palmtree,
  FilterX,
  Users,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { isVacationActive } from '@/lib/escala-vacation'
import { formatCorenLabel } from '@/lib/escala-calendar-formatter'
import {
  getAllStaffProfilesPaginated,
  getHospitalSectors,
  getStaffRoles,
  getStaffContracts,
  getShiftRules,
  getShiftTypes,
} from '@/services/escala'
import {
  exportCollaboratorsToExcel,
  exportCollaboratorsToPdf,
  type CollaboratorReportRow,
} from '@/utils/staffReportExport'

function formatIsoDateOnly(dateStr?: string | null): string {
  if (!dateStr) return '-'
  const clean = String(dateStr).split('T')[0].split(' ')[0]
  if (!clean || clean.length < 10) return '-'
  const [y, m, d] = clean.split('-')
  if (!y || !m || !d) return clean
  return `${d}/${m}/${y}`
}

export function StaffGeneralReport() {
  const { toast } = useToast()
  const [searchParams] = useSearchParams()

  const [profiles, setProfiles] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [shiftTypes, setShiftTypes] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSector, setSelectedSector] = useState('ALL')
  const [selectedRole, setSelectedRole] = useState('ALL')
  const [selectedContractType, setSelectedContractType] = useState('ALL')
  const [selectedShiftType, setSelectedShiftType] = useState('ALL')
  const [selectedParity, setSelectedParity] = useState('ALL')
  const [selectedStatus, setSelectedStatus] = useState('ALL')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Carrega exaustivamente todas as páginas da coleção staff_profiles
      const [allProfiles, contractList, sectorList, roleList, shiftTypeList, ruleList] =
        await Promise.all([
          getAllStaffProfilesPaginated(),
          getStaffContracts().catch(() => []),
          getHospitalSectors().catch(() => []),
          getStaffRoles().catch(() => []),
          getShiftTypes().catch(() => []),
          getShiftRules().catch(() => []),
        ])

      setProfiles(allProfiles)
      setContracts(contractList)
      setSectors(sectorList)
      setRoles(roleList)
      setShiftTypes(shiftTypeList)
      setRules(ruleList)
    } catch (err: any) {
      console.error('Falha ao carregar colaboradores para o relatório:', err)
      toast({
        title: 'Erro ao carregar colaboradores',
        description: err?.message || 'Não foi possível carregar a lista de colaboradores.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Pré-aplicar filtro de setor a partir da URL (?setor=... ou ?sector=...)
  // Suporta tanto id do setor quanto nome exato, ou "todos" / "ALL"
  const appliedQueryParamRef = useRef<string | null>(null)
  useEffect(() => {
    const rawSectorParam = searchParams.get('setor') || searchParams.get('sector')
    if (!rawSectorParam) return
    const paramVal = rawSectorParam.trim()

    // Se mudou o query param ou ainda não aplicamos este valor
    if (appliedQueryParamRef.current === paramVal && sectors.length > 0) return

    if (paramVal.toLowerCase() === 'todos' || paramVal.toUpperCase() === 'ALL') {
      setSelectedSector('ALL')
      appliedQueryParamRef.current = paramVal
      return
    }

    if (sectors.length > 0) {
      // Tenta achar por ID
      const matchedById = sectors.find((s) => s.id === paramVal)
      if (matchedById) {
        setSelectedSector(matchedById.name)
        appliedQueryParamRef.current = paramVal
        return
      }

      // Tenta achar por nome (case insensitive)
      const matchedByName = sectors.find(
        (s) => s.name?.trim().toLowerCase() === paramVal.toLowerCase(),
      )
      if (matchedByName) {
        setSelectedSector(matchedByName.name)
        appliedQueryParamRef.current = paramVal
        return
      }

      // Se não encontrou setor correspondente, fallback seguro
      appliedQueryParamRef.current = paramVal
    }
  }, [searchParams, sectors])

  // Realtime para manter sincronizado com edições no cadastro
  useRealtime('staff_profiles', loadData)
  useRealtime('staff_contracts', loadData)
  useRealtime('staff_roles', loadData)
  useRealtime('hospital_sectors', loadData)
  useRealtime('shift_types', loadData)
  useRealtime('shift_rules', loadData)

  // Mapeamento enriquecido dos colaboradores
  const mappedRows: CollaboratorReportRow[] = useMemo(() => {
    return profiles.map((p) => {
      // Localiza contrato vinculado ao staff_profile (exatamente como StaffProfiles.tsx)
      const linked = contracts.find((c) => c.staff_profile === p.id) || p.expand?.staff_contracts
      const contract = Array.isArray(linked) ? linked[0] : linked

      // Setor
      const sectorName =
        p.expand?.default_sector?.name ||
        sectors.find((s) => s.id === p.default_sector)?.name ||
        '-'

      // Cargo / Função
      const roleName =
        p.expand?.staff_role?.name || roles.find((r) => r.id === p.staff_role)?.name || '-'

      // Contrato
      const contractType = contract?.contract_type || '-'
      const monthlyHourLimit =
        contract?.monthly_hour_limit != null && contract.monthly_hour_limit !== ''
          ? String(contract.monthly_hour_limit)
          : '-'

      // Tipo de Turno / Regime
      const shiftTypeObj =
        contract?.expand?.shift_type || shiftTypes.find((st) => st.id === contract?.shift_type)
      const shiftTypeName = shiftTypeObj
        ? `${shiftTypeObj.name || shiftTypeObj.code}${
            shiftTypeObj.work_hours
              ? ` (${shiftTypeObj.work_hours}h/${shiftTypeObj.rest_hours ?? 0}h)`
              : ''
          }`
        : '-'

      // Paridade (rótulos civis v0.0.291)
      let shiftParityLabel = '-'
      if (p.shift_parity === 'even') {
        shiftParityLabel = 'Dias pares'
      } else if (p.shift_parity === 'odd') {
        shiftParityLabel = 'Dias ímpares'
      }

      // Início no ciclo
      const cycleStartDate = formatIsoDateOnly(p.cycle_start_date)

      // Status ativo/inativo
      const statusLabel = p.active === false ? 'Inativo' : 'Ativo'

      // Férias
      const vacationActive = isVacationActive(p)
      const hasVacationConfigured = Boolean(
        p.vacation_enabled && p.vacation_start && p.vacation_end,
      )
      let vacationStatus = 'Sem férias'
      if (vacationActive) {
        vacationStatus = 'Em férias'
      } else if (hasVacationConfigured) {
        vacationStatus = 'Programadas'
      }

      let vacationPeriod = '-'
      if (p.vacation_start && p.vacation_end) {
        vacationPeriod = `${formatIsoDateOnly(p.vacation_start)} a ${formatIsoDateOnly(
          p.vacation_end,
        )}`
      }

      // Regras vinculadas
      const profileRules = Array.isArray(p.rules) ? p.rules : []
      const resolvedRuleNames = profileRules
        .map((rId: string) => {
          const ruleObj =
            p.expand?.rules?.find?.((item: any) => item.id === rId) ||
            rules.find((r) => r.id === rId)
          return ruleObj?.name || rId
        })
        .filter(Boolean)

      // Registro profissional (COREN/CRM)
      const rawProfessionalId = p.professional_id?.trim() || ''
      const formattedCoren = rawProfessionalId ? formatCorenLabel(rawProfessionalId) : '-'

      return {
        id: p.id,
        name: p.name || '-',
        professionalId: rawProfessionalId || '-',
        role: roleName,
        sector: sectorName,
        contractType,
        monthlyHourLimit,
        shiftType: shiftTypeName,
        shiftParity: shiftParityLabel,
        cycleStartDate,
        status: statusLabel,
        vacationStatus,
        vacationPeriod,
        rulesCount: profileRules.length,
        rulesList: resolvedRuleNames.length > 0 ? resolvedRuleNames.join('; ') : '-',
        createdAt: formatIsoDateOnly(p.created),
        updatedAt: formatIsoDateOnly(p.updated),
      }
    })
  }, [profiles, contracts, sectors, roles, shiftTypes, rules])

  // Aplicação dos filtros sobre mappedRows
  const filteredRows = useMemo(() => {
    return mappedRows.filter((r) => {
      // Busca por nome ou registro profissional
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase()
        const matchName = r.name.toLowerCase().includes(query)
        const matchReg = r.professionalId.toLowerCase().includes(query)
        const matchRole = r.role.toLowerCase().includes(query)
        const matchSector = r.sector.toLowerCase().includes(query)
        if (!matchName && !matchReg && !matchRole && !matchSector) return false
      }

      // Setor
      if (selectedSector !== 'ALL') {
        if (r.sector !== selectedSector) return false
      }

      // Função / Cargo
      if (selectedRole !== 'ALL') {
        if (r.role !== selectedRole) return false
      }

      // Tipo de Contrato
      if (selectedContractType !== 'ALL') {
        if (r.contractType !== selectedContractType) return false
      }

      // Regime / Turno
      if (selectedShiftType !== 'ALL') {
        if (!r.shiftType.includes(selectedShiftType)) return false
      }

      // Paridade
      if (selectedParity !== 'ALL') {
        if (r.shiftParity !== selectedParity) return false
      }

      // Status
      if (selectedStatus !== 'ALL') {
        if (r.status !== selectedStatus) return false
      }

      return true
    })
  }, [
    mappedRows,
    searchTerm,
    selectedSector,
    selectedRole,
    selectedContractType,
    selectedShiftType,
    selectedParity,
    selectedStatus,
  ])

  const handleClearFilters = () => {
    setSearchTerm('')
    setSelectedSector('ALL')
    setSelectedRole('ALL')
    setSelectedContractType('ALL')
    setSelectedShiftType('ALL')
    setSelectedParity('ALL')
    setSelectedStatus('ALL')
  }

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedSector !== 'ALL' ||
    selectedRole !== 'ALL' ||
    selectedContractType !== 'ALL' ||
    selectedShiftType !== 'ALL' ||
    selectedParity !== 'ALL' ||
    selectedStatus !== 'ALL'

  // Exportar Excel
  const handleExportExcel = async () => {
    if (filteredRows.length === 0) {
      toast({
        title: 'Nenhum colaborador para exportar',
        description: 'Ajuste os filtros para exibir colaboradores antes de exportar.',
        variant: 'destructive',
      })
      return
    }
    setExportingExcel(true)
    try {
      const filename = exportCollaboratorsToExcel(filteredRows)
      toast({
        title: 'Planilha exportada com sucesso',
        description: `Arquivo ${filename} gerado com ${filteredRows.length} colaborador(es).`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao exportar Excel',
        description: err?.message || 'Falha na geração do arquivo .xlsx.',
        variant: 'destructive',
      })
    } finally {
      setExportingExcel(false)
    }
  }

  // Exportar PDF
  const handleExportPdf = async () => {
    if (filteredRows.length === 0) {
      toast({
        title: 'Nenhum colaborador para exportar',
        description: 'Ajuste os filtros para exibir colaboradores antes de exportar.',
        variant: 'destructive',
      })
      return
    }
    setExportingPdf(true)
    try {
      const filename = exportCollaboratorsToPdf(filteredRows)
      toast({
        title: 'PDF exportado com sucesso',
        description: `Arquivo ${filename} gerado com ${filteredRows.length} colaborador(es).`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao exportar PDF',
        description: err?.message || 'Falha na geração do arquivo .pdf.',
        variant: 'destructive',
      })
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header com Ações Globais */}
      <Card className="border-slate-200/80 shadow-soft">
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight text-primary flex items-center gap-3 font-heading">
                <Users className="h-7 w-7 text-primary" />
                Relatório Geral de Colaboradores
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground mt-1 font-sans">
                Visão consolidada e somente leitura do cadastro mestre operacional de colaboradores,
                contratos e parâmetros de escala.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
                className="gap-2 shadow-sm font-interactive"
              >
                <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                onClick={handleExportExcel}
                disabled={exportingExcel || loading || filteredRows.length === 0}
                className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm font-interactive"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {exportingExcel ? 'Exportando Excel...' : 'Exportar Excel'}
              </Button>
              <Button
                onClick={handleExportPdf}
                disabled={exportingPdf || loading || filteredRows.length === 0}
                className="gap-2 bg-red-700 hover:bg-red-800 text-white shadow-sm font-interactive"
              >
                <FileText className="h-4 w-4" />
                {exportingPdf ? 'Exportando PDF...' : 'Exportar PDF'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {/* Barra de Filtros */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Busca por texto */}
              <div className="relative col-span-1 md:col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, COREN/CRM, função ou setor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-white"
                />
              </div>

              {/* Filtro: Setor */}
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Filtrar por Setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Setores</SelectItem>
                  {sectors.map((s) => (
                    <SelectItem key={s.id} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtro: Função / Cargo */}
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Filtrar por Cargo/Função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as Funções</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtro: Tipo de Contrato */}
              <Select value={selectedContractType} onValueChange={setSelectedContractType}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Tipo de Contrato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Contratos</SelectItem>
                  <SelectItem value="CLT 180h">CLT 180h</SelectItem>
                  <SelectItem value="PJ">PJ</SelectItem>
                  <SelectItem value="Autônomo">Autônomo</SelectItem>
                  <SelectItem value="-">Sem Contrato</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtro: Turno / Regime */}
              <Select value={selectedShiftType} onValueChange={setSelectedShiftType}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Regime / Turno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Turnos</SelectItem>
                  {shiftTypes.map((st) => (
                    <SelectItem key={st.id} value={st.name}>
                      {st.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtro: Paridade */}
              <Select value={selectedParity} onValueChange={setSelectedParity}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Dias de Plantão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as Paridades</SelectItem>
                  <SelectItem value="Dias pares">Dias pares</SelectItem>
                  <SelectItem value="Dias ímpares">Dias ímpares</SelectItem>
                  <SelectItem value="-">Não Definido</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtro: Status */}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Status</SelectItem>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>

              {/* Botão limpar filtros */}
              <div className="flex items-center">
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="text-slate-600 hover:text-slate-900 gap-1.5 w-full justify-center"
                  >
                    <FilterX className="h-4 w-4" />
                    Limpar Filtros
                  </Button>
                )}
              </div>
            </div>

            {/* Contador de Resultados */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Total filtrado:</span>
                <Badge variant="secondary" className="font-mono text-sm px-2.5 py-0.5">
                  {filteredRows.length} colaborador{filteredRows.length === 1 ? '' : 'es'}
                </Badge>
                {mappedRows.length !== filteredRows.length && (
                  <span className="text-xs text-muted-foreground">
                    (de {mappedRows.length} cadastrados no sistema)
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500">
                Ordenado alfabeticamente por nome • Exportações consideram todas as{' '}
                <strong>{filteredRows.length}</strong> linhas filtradas
              </div>
            </div>
          </div>

          {/* Tabela de Colaboradores */}
          <div className="rounded-lg border border-slate-200/80 overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 font-interactive text-xs uppercase tracking-wider text-slate-600">
                    <TableHead className="min-w-[200px]">Colaborador</TableHead>
                    <TableHead className="min-w-[140px]">Registro (COREN/CRM)</TableHead>
                    <TableHead className="min-w-[140px]">Função / Cargo</TableHead>
                    <TableHead className="min-w-[140px]">Setor Padrão</TableHead>
                    <TableHead className="min-w-[120px]">Contrato</TableHead>
                    <TableHead className="min-w-[90px] text-center">Limite (h)</TableHead>
                    <TableHead className="min-w-[160px]">Regime / Turno</TableHead>
                    <TableHead className="min-w-[130px] text-center">Dias de Plantão</TableHead>
                    <TableHead className="min-w-[110px] text-center">Início Ciclo</TableHead>
                    <TableHead className="min-w-[90px] text-center">Status</TableHead>
                    <TableHead className="min-w-[170px]">Férias</TableHead>
                    <TableHead className="min-w-[110px] text-center">Regras</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-16 text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RotateCw className="h-6 w-6 animate-spin text-primary" />
                          <span>Carregando todos os colaboradores do cadastro...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-16 text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Users className="h-8 w-8 text-slate-400" />
                          <span className="font-medium text-slate-600">
                            Nenhum colaborador encontrado para os filtros selecionados.
                          </span>
                          {hasActiveFilters && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleClearFilters}
                              className="mt-2"
                            >
                              Limpar filtros
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((r) => (
                      <TableRow key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Colaborador */}
                        <TableCell className="font-semibold text-slate-900 font-sans">
                          {r.name}
                        </TableCell>

                        {/* Registro Profissional */}
                        <TableCell className="font-mono text-xs text-slate-700">
                          {r.professionalId !== '-' ? formatCorenLabel(r.professionalId) : '-'}
                        </TableCell>

                        {/* Função / Cargo */}
                        <TableCell>
                          {r.role !== '-' ? (
                            <Badge variant="secondary" className="font-normal text-xs">
                              {r.role}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </TableCell>

                        {/* Setor Padrão */}
                        <TableCell className="text-sm text-slate-700">{r.sector}</TableCell>

                        {/* Contrato */}
                        <TableCell className="text-sm text-slate-700">{r.contractType}</TableCell>

                        {/* Limite Horas */}
                        <TableCell className="text-center font-mono text-xs text-slate-700">
                          {r.monthlyHourLimit !== '-' ? `${r.monthlyHourLimit}h` : '-'}
                        </TableCell>

                        {/* Regime / Turno */}
                        <TableCell className="text-xs text-slate-700">{r.shiftType}</TableCell>

                        {/* Paridade */}
                        <TableCell className="text-center">
                          {r.shiftParity === 'Dias pares' ? (
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-medium"
                            >
                              Dias pares
                            </Badge>
                          ) : r.shiftParity === 'Dias ímpares' ? (
                            <Badge
                              variant="outline"
                              className="bg-purple-50 text-purple-700 border-purple-200 text-xs font-medium"
                            >
                              Dias ímpares
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </TableCell>

                        {/* Início Ciclo */}
                        <TableCell className="text-center font-mono text-xs text-slate-700">
                          {r.cycleStartDate}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-center">
                          {r.status === 'Ativo' ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Ativo
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-slate-100 text-slate-600 border-slate-200 text-xs font-medium inline-flex items-center gap-1"
                            >
                              <XCircle className="h-3 w-3" />
                              Inativo
                            </Badge>
                          )}
                        </TableCell>

                        {/* Férias */}
                        <TableCell>
                          {r.vacationStatus === 'Em férias' ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium flex items-center gap-1 w-fit"
                            >
                              <Palmtree className="h-3 w-3" />
                              <span>{r.vacationPeriod}</span>
                            </Badge>
                          ) : r.vacationStatus === 'Programadas' ? (
                            <span className="text-xs text-amber-700 font-medium">
                              Prog: {r.vacationPeriod}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </TableCell>

                        {/* Regras */}
                        <TableCell className="text-center" title={r.rulesList}>
                          {r.rulesCount > 0 ? (
                            <Badge variant="outline" className="text-xs cursor-help">
                              {r.rulesCount} regra{r.rulesCount === 1 ? '' : 's'}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
export default StaffGeneralReport
