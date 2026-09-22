import { describe, it, expect } from 'vitest'
import { TEAM_1_LABEL, TEAM_2_LABEL, normalizeParityValue, canonicalLabel } from './parity-labels'
import {
  ANCHOR_YEAR,
  ANCHOR_MONTH,
  getDaysInMonth,
  resolveTeamWorkingParity,
  isStaffEligibleForDateWithInversion,
} from './parity-inversion'
import {
  exportCollaboratorsToExcel,
  exportCollaboratorsToPdf,
  COLLABORATOR_REPORT_COLUMNS,
  mapCollaboratorRowToValues,
  CollaboratorReportRow,
} from '@/utils/staffReportExport'

describe('Parity Labels & Normalization', () => {
  it('normaliza variantes legadas para even e odd', () => {
    // Variantes de even
    expect(normalizeParityValue('even')).toBe('even')
    expect(normalizeParityValue('par')).toBe('even')
    expect(normalizeParityValue('pares')).toBe('even')
    expect(normalizeParityValue('dias pares')).toBe('even')
    expect(normalizeParityValue('dia par')).toBe('even')
    expect(normalizeParityValue('equipe 1')).toBe('even')
    expect(normalizeParityValue('equipe1')).toBe('even')
    expect(normalizeParityValue('  Dias Pares  ')).toBe('even')
    expect(normalizeParityValue('Equipe 1')).toBe('even')

    // Variantes de odd
    expect(normalizeParityValue('odd')).toBe('odd')
    expect(normalizeParityValue('ímpar')).toBe('odd')
    expect(normalizeParityValue('impar')).toBe('odd')
    expect(normalizeParityValue('ímpares')).toBe('odd')
    expect(normalizeParityValue('impares')).toBe('odd')
    expect(normalizeParityValue('dias ímpares')).toBe('odd')
    expect(normalizeParityValue('dia ímpar')).toBe('odd')
    expect(normalizeParityValue('dias impares')).toBe('odd')
    expect(normalizeParityValue('dia impar')).toBe('odd')
    expect(normalizeParityValue('equipe 2')).toBe('odd')
    expect(normalizeParityValue('equipe2')).toBe('odd')
    expect(normalizeParityValue('  Dias Ímpares  ')).toBe('odd')
    expect(normalizeParityValue('Equipe 2')).toBe('odd')

    // Valores desconhecidos ou vazios
    expect(normalizeParityValue(null)).toBeNull()
    expect(normalizeParityValue(undefined)).toBeNull()
    expect(normalizeParityValue('')).toBeNull()
    expect(normalizeParityValue('qualquer')).toBeNull()
    expect(normalizeParityValue('-')).toBeNull()
  })

  it('canonicalLabel retorna rótulos canônicos corretos', () => {
    expect(canonicalLabel('even')).toBe('Equipe 1')
    expect(canonicalLabel('dias pares')).toBe('Equipe 1')
    expect(canonicalLabel('par')).toBe('Equipe 1')
    expect(canonicalLabel('odd')).toBe('Equipe 2')
    expect(canonicalLabel('dias ímpares')).toBe('Equipe 2')
    expect(canonicalLabel('ímpar')).toBe('Equipe 2')
    expect(canonicalLabel(null)).toBe('-')
    expect(canonicalLabel(undefined)).toBe('-')
    expect(canonicalLabel('')).toBe('-')
    expect(canonicalLabel('desconhecido')).toBe('-')
  })
})

describe('Parity Inversion Deterministic Rules', () => {
  it('getDaysInMonth calcula corretamente o total de dias', () => {
    expect(getDaysInMonth(2026, 10)).toBe(31) // Outubro 2026
    expect(getDaysInMonth(2026, 11)).toBe(30) // Novembro 2026
    expect(getDaysInMonth(2026, 12)).toBe(31) // Dezembro 2026
    expect(getDaysInMonth(2027, 1)).toBe(31) // Janeiro 2027
    expect(getDaysInMonth(2027, 2)).toBe(28) // Fevereiro 2027 (não bissexto)
    expect(getDaysInMonth(2028, 2)).toBe(29) // Fevereiro 2028 (bissexto)
  })

  it('resolveTeamWorkingParity segue a regra de alternância contínua', () => {
    // Âncora: Outubro/2026 (sem inversão)
    expect(resolveTeamWorkingParity('even', 2026, 10)).toBe('even')
    expect(resolveTeamWorkingParity('odd', 2026, 10)).toBe('odd')

    // Novembro/2026: Outubro tem 31 dias -> 1 mês de 31 dias no caminho -> inverte!
    // Equipe 1 ('even') agora trabalha em dias ímpares civis ('odd')
    expect(resolveTeamWorkingParity('even', 2026, 11)).toBe('odd')
    expect(resolveTeamWorkingParity('odd', 2026, 11)).toBe('even')

    // Dezembro/2026: Novembro tem 30 dias -> contagem de meses de 31 dias permanece 1 -> mantém inversão
    expect(resolveTeamWorkingParity('even', 2026, 12)).toBe('odd')
    expect(resolveTeamWorkingParity('odd', 2026, 12)).toBe('even')

    // Janeiro/2027: Dezembro tem 31 dias -> contagem passa para 2 (Out e Dez) -> volta à paridade original ('even')
    expect(resolveTeamWorkingParity('even', 2027, 1)).toBe('even')
    expect(resolveTeamWorkingParity('odd', 2027, 1)).toBe('odd')

    // Fevereiro/2028: Jan/2027 (31), Mar/2027 (31), Mai/2027 (31), Jul/2027 (31), Ago/2027 (31), Out/2027 (31), Dez/2027 (31), Jan/2028 (31)
    // Total de meses de 31 dias:
    // Out/26 (31), Dez/26 (31) -> 2
    // 2027: Jan, Mar, Mai, Jul, Ago, Out, Dez -> 7
    // Jan/28: 1
    // Total = 2 + 7 + 1 = 10 (par) -> volta a paridade original
    // Consistência ida e volta:
    const parityEvenFev2028 = resolveTeamWorkingParity('even', 2028, 2)
    // Verificamos reversibilidade
    const parityReverseBack = resolveTeamWorkingParity(parityEvenFev2028, 2026, 10)
    expect(parityReverseBack).toBe('even')
  })

  it('isStaffEligibleForDateWithInversion valida elegibilidade exata', () => {
    // Em Outubro/2026:
    // Laodiceia (even / Equipe 1) elegível em 2026-10-08 (par)
    expect(isStaffEligibleForDateWithInversion('2026-10-08', 'even')).toBe(true)
    expect(isStaffEligibleForDateWithInversion('2026-10-08', 'odd')).toBe(false)

    // Em Novembro/2026 (Outubro teve 31 dias -> inverte! Equipe 1 trabalha em dias ímpares civis):
    // 2026-11-01 (dia 1 = ímpar civil) -> Equipe 1 ('even') é elegível!
    expect(isStaffEligibleForDateWithInversion('2026-11-01', 'even')).toBe(true)
    // 2026-11-02 (dia 2 = par civil) -> Equipe 1 ('even') não é elegível!
    expect(isStaffEligibleForDateWithInversion('2026-11-02', 'even')).toBe(false)
    expect(isStaffEligibleForDateWithInversion('2026-11-02', 'odd')).toBe(true)
  })
})

describe('Relatórios e Exportações com Novos Rótulos', () => {
  it('cabeçalho da coluna de paridade é "Equipe de Plantão"', () => {
    expect(COLLABORATOR_REPORT_COLUMNS[5]).toBe('Equipe de Plantão')
    expect(COLLABORATOR_REPORT_COLUMNS).not.toContain('Dias de Plantão (Paridade)')
  })

  it('mapCollaboratorRowToValues exporta "Equipe 1", "Equipe 2" ou "-"', () => {
    const row1: CollaboratorReportRow = {
      id: '1',
      name: 'Maria Silva',
      professionalId: '12345',
      role: 'Enfermeira',
      sector: 'UTI',
      contractType: 'CLT 180h',
      monthlyHourLimit: '180',
      shiftType: '12x36',
      shiftParity: 'Equipe 1',
      cycleStartDate: '2026-10-01',
      status: 'Ativo',
      vacationStatus: 'Sem férias',
      vacationPeriod: '-',
      rulesCount: 0,
      rulesList: '-',
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    }

    const row2: CollaboratorReportRow = {
      ...row1,
      id: '2',
      name: 'João Santos',
      shiftParity: 'dias ímpares', // Deve ser mapeado/canônico
    }

    const row3: CollaboratorReportRow = {
      ...row1,
      id: '3',
      name: 'Carlos Lima',
      shiftParity: '-',
    }

    const values1 = mapCollaboratorRowToValues(row1)
    const values2 = mapCollaboratorRowToValues(row2)
    const values3 = mapCollaboratorRowToValues(row3)

    expect(values1[5]).toBe('Equipe 1')
    expect(values2[5]).toBe('Equipe 2')
    expect(values3[5]).toBe('-')

    // Certificar que não contém rótulos legados
    const serialized = JSON.stringify([values1, values2, values3])
    expect(serialized).not.toContain('dias pares')
    expect(serialized).not.toContain('dias ímpares')
  })
})
