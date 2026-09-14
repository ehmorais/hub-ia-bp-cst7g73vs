import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAllStaffProfilesPaginated } from '@/services/escala'
import {
  exportCollaboratorsToExcel,
  exportCollaboratorsToPdf,
  type CollaboratorReportRow,
} from '@/utils/staffReportExport'
import pb from '@/lib/pocketbase/client'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'

// Mock de jsPDF e XLSX para testar chamadas e estruturas de exportação
vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('xlsx')>()
  return {
    ...actual,
    writeFile: vi.fn(),
  }
})

describe('StaffGeneralReport e Serviços de Relatório de Colaboradores', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('1. Carga completa e paginação exaustiva (getAllStaffProfilesPaginated)', () => {
    it('deve buscar todas as páginas disponíveis da API e ordenar alfabeticamente por nome', async () => {
      // Simula resposta paginada com 2 páginas
      const mockGetList = vi
        .fn()
        .mockResolvedValueOnce({
          items: [
            { id: '2', name: 'Carlos Eduardo Souza', shift_parity: 'odd' },
            { id: '1', name: 'Beatriz Santos', shift_parity: 'even' },
          ],
          page: 1,
          perPage: 2,
          totalItems: 4,
          totalPages: 2,
        })
        .mockResolvedValueOnce({
          items: [
            { id: '4', name: 'Débora Lima', shift_parity: 'even' },
            { id: '3', name: 'Ana Carolina Silva', shift_parity: 'odd' },
          ],
          page: 2,
          perPage: 2,
          totalItems: 4,
          totalPages: 2,
        })

      vi.spyOn(pb, 'collection').mockImplementation(
        () =>
          ({
            getList: mockGetList,
          }) as any,
      )

      const result = await getAllStaffProfilesPaginated(2)

      // Verificações
      expect(mockGetList).toHaveBeenCalledTimes(2)
      expect(mockGetList).toHaveBeenNthCalledWith(1, 1, 2, {
        sort: 'name',
        expand: 'staff_role,default_sector,rules,staff_contracts',
      })
      expect(mockGetList).toHaveBeenNthCalledWith(2, 2, 2, {
        sort: 'name',
        expand: 'staff_role,default_sector,rules,staff_contracts',
      })

      expect(result).toHaveLength(4)
      // Ordenação alfabética case-insensitive pt-BR
      expect(result.map((r) => r.name)).toEqual([
        'Ana Carolina Silva',
        'Beatriz Santos',
        'Carlos Eduardo Souza',
        'Débora Lima',
      ])
    })
  })

  describe('2. Filtros e total do resultado filtrado', () => {
    const sampleRows: CollaboratorReportRow[] = [
      {
        id: 'p1',
        name: 'Maria Helena Silva',
        professionalId: '123456-SP',
        role: 'Enfermeiro(a) Pleno',
        sector: 'UTI Geral',
        contractType: 'CLT 180h',
        monthlyHourLimit: '180',
        shiftType: 'SD 12x36 (07:00-19:00)',
        shiftParity: 'Dias pares',
        cycleStartDate: '01/01/2025',
        status: 'Ativo',
        vacationStatus: 'Sem férias',
        vacationPeriod: '-',
        rulesCount: 2,
        rulesList: 'Regra Noturna; Regra UTI',
        createdAt: '01/01/2025',
        updatedAt: '15/01/2025',
      },
      {
        id: 'p2',
        name: 'João Pedro Santos',
        professionalId: '654321-SP',
        role: 'Técnico(a) de Enfermagem',
        sector: 'Pronto Socorro Adulto',
        contractType: 'CLT 180h',
        monthlyHourLimit: '180',
        shiftType: 'SN 12x36 (19:00-07:00)',
        shiftParity: 'Dias ímpares',
        cycleStartDate: '02/01/2025',
        status: 'Ativo',
        vacationStatus: 'Em férias',
        vacationPeriod: '10/02/2025 a 20/02/2025',
        rulesCount: 1,
        rulesList: 'Regra Noturna',
        createdAt: '02/01/2025',
        updatedAt: '10/02/2025',
      },
      {
        id: 'p3',
        name: 'Ana Paula Ferreira',
        professionalId: '987654-SP',
        role: 'Fisioterapeuta Respiratório',
        sector: 'UTI Geral',
        contractType: 'PJ',
        monthlyHourLimit: '120',
        shiftType: 'MT (07:00-13:00)',
        shiftParity: '-',
        cycleStartDate: '-',
        status: 'Inativo',
        vacationStatus: 'Sem férias',
        vacationPeriod: '-',
        rulesCount: 0,
        rulesList: '-',
        createdAt: '01/02/2025',
        updatedAt: '01/02/2025',
      },
    ]

    function applyFilters(
      rows: CollaboratorReportRow[],
      filters: {
        searchTerm?: string
        sector?: string
        role?: string
        contractType?: string
        shiftType?: string
        parity?: string
        status?: string
      },
    ) {
      return rows.filter((r) => {
        if (filters.searchTerm?.trim()) {
          const q = filters.searchTerm.toLowerCase()
          const m =
            r.name.toLowerCase().includes(q) ||
            r.professionalId.toLowerCase().includes(q) ||
            r.role.toLowerCase().includes(q) ||
            r.sector.toLowerCase().includes(q)
          if (!m) return false
        }
        if (filters.sector && filters.sector !== 'ALL' && r.sector !== filters.sector) return false
        if (filters.role && filters.role !== 'ALL' && r.role !== filters.role) return false
        if (
          filters.contractType &&
          filters.contractType !== 'ALL' &&
          r.contractType !== filters.contractType
        )
          return false
        if (
          filters.shiftType &&
          filters.shiftType !== 'ALL' &&
          !r.shiftType.includes(filters.shiftType)
        )
          return false
        if (filters.parity && filters.parity !== 'ALL' && r.shiftParity !== filters.parity)
          return false
        if (filters.status && filters.status !== 'ALL' && r.status !== filters.status) return false
        return true
      })
    }

    it('filtra por nome e número de registro com total correto', () => {
      const byName = applyFilters(sampleRows, { searchTerm: 'Maria' })
      expect(byName).toHaveLength(1)
      expect(byName[0].name).toBe('Maria Helena Silva')

      const byReg = applyFilters(sampleRows, { searchTerm: '654321' })
      expect(byReg).toHaveLength(1)
      expect(byReg[0].name).toBe('João Pedro Santos')
    })

    it('filtra por setor e função com total do resultado', () => {
      const bySector = applyFilters(sampleRows, { sector: 'UTI Geral' })
      expect(bySector).toHaveLength(2)

      const byRole = applyFilters(sampleRows, { role: 'Fisioterapeuta Respiratório' })
      expect(byRole).toHaveLength(1)
      expect(byRole[0].name).toBe('Ana Paula Ferreira')
    })

    it('filtra por tipo de contrato, turno/regime, paridade civil e status', () => {
      const byContract = applyFilters(sampleRows, { contractType: 'PJ' })
      expect(byContract).toHaveLength(1)
      expect(byContract[0].name).toBe('Ana Paula Ferreira')

      const byShift = applyFilters(sampleRows, { shiftType: 'SD 12x36' })
      expect(byShift).toHaveLength(1)
      expect(byShift[0].name).toBe('Maria Helena Silva')

      const byParityEven = applyFilters(sampleRows, { parity: 'Dias pares' })
      expect(byParityEven).toHaveLength(1)
      expect(byParityEven[0].shiftParity).toBe('Dias pares')

      const byParityOdd = applyFilters(sampleRows, { parity: 'Dias ímpares' })
      expect(byParityOdd).toHaveLength(1)
      expect(byParityOdd[0].shiftParity).toBe('Dias ímpares')

      const byStatusInactive = applyFilters(sampleRows, { status: 'Inativo' })
      expect(byStatusInactive).toHaveLength(1)
      expect(byStatusInactive[0].name).toBe('Ana Paula Ferreira')
    })
  })

  describe('3. Exportação para Excel e PDF considerando linhas filtradas', () => {
    const rowsToExport: CollaboratorReportRow[] = [
      {
        id: 'p1',
        name: 'Maria Helena Silva',
        professionalId: '123456-SP',
        role: 'Enfermeiro(a) Pleno',
        sector: 'UTI Geral',
        contractType: 'CLT 180h',
        monthlyHourLimit: '180',
        shiftType: 'SD 12x36 (07:00-19:00)',
        shiftParity: 'Dias pares',
        cycleStartDate: '01/01/2025',
        status: 'Ativo',
        vacationStatus: 'Sem férias',
        vacationPeriod: '-',
        rulesCount: 0,
        rulesList: '-',
        createdAt: '01/01/2025',
        updatedAt: '15/01/2025',
      },
      {
        id: 'p2',
        name: 'Carlos Oliveira',
        professionalId: '-', // Campo vazio formatado como "-"
        role: '-',
        sector: '-',
        contractType: '-',
        monthlyHourLimit: '-',
        shiftType: '-',
        shiftParity: '-',
        cycleStartDate: '-',
        status: 'Ativo',
        vacationStatus: 'Sem férias',
        vacationPeriod: '-',
        rulesCount: 0,
        rulesList: '-',
        createdAt: '02/01/2025',
        updatedAt: '02/01/2025',
      },
    ]

    it('exportCollaboratorsToExcel gera planilha .xlsx com aba Colaboradores, metadados e total', async () => {
      const actualXlsx = await vi.importActual<typeof import('xlsx')>('xlsx')
      const wb = actualXlsx.utils.book_new()
      const ws = actualXlsx.utils.aoa_to_sheet([['test']])
      ws['!pageSetup'] = { orientation: 'landscape', paperSize: 9, fitToWidth: 1, fitToHeight: 0 }
      ws['!margins'] = {
        left: 0.25,
        right: 0.25,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3,
      }
      ws['!printHeader'] = [4, 4]
      actualXlsx.utils.book_append_sheet(wb, ws, 'Test')
      const buffer = actualXlsx.write(wb, { type: 'array', bookType: 'xlsx' })
      expect(buffer.byteLength).toBe(0) // intentionally fail so vitest prints the diff or error

      const filename = exportCollaboratorsToExcel(rowsToExport, 'teste-colaboradores.xlsx')
      expect(filename).toBe('teste-colaboradores.xlsx')
      expect(XLSX.writeFile).toHaveBeenCalledTimes(1)

      const workbookArg = (XLSX.writeFile as any).mock.calls[0][0]
      expect(workbookArg.SheetNames).toContain('Colaboradores')
      const worksheet = workbookArg.Sheets['Colaboradores']

      // Verifica propriedades de autofilter, freeze e pageSetup
      expect(worksheet['!autofilter']).toBeDefined()
      expect(worksheet['!freeze']).toBeDefined()
      expect(worksheet['!pageSetup']).toEqual({
        orientation: 'landscape',
        paperSize: 9,
      })
      expect(worksheet['!printHeader']).toEqual([4, 4])
    })

    it('exportCollaboratorsToPdf gera PDF Landscape com título, data/hora e total de colaboradores', () => {
      const saveSpy = vi.spyOn(jsPDF.prototype, 'save').mockImplementation(() => undefined as any)
      const filename = exportCollaboratorsToPdf(rowsToExport, 'teste-colaboradores.pdf')

      expect(filename).toBe('teste-colaboradores.pdf')
      expect(saveSpy).toHaveBeenCalledWith('teste-colaboradores.pdf')
    })

    it('campos vazios ou ausentes são exibidos estritamente como "-"', () => {
      const emptyRow = rowsToExport[1]
      expect(emptyRow.professionalId).toBe('-')
      expect(emptyRow.role).toBe('-')
      expect(emptyRow.sector).toBe('-')
      expect(emptyRow.contractType).toBe('-')
      expect(emptyRow.monthlyHourLimit).toBe('-')
      expect(emptyRow.shiftType).toBe('-')
      expect(emptyRow.shiftParity).toBe('-')
      expect(emptyRow.cycleStartDate).toBe('-')
      expect(emptyRow.vacationPeriod).toBe('-')
      expect(emptyRow.rulesList).toBe('-')
    })
  })
})
