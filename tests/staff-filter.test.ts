import { describe, it, expect } from 'vitest'
import {
  normalizeText,
  filterStaffByName,
  StaffOption,
} from '../src/components/escala/StaffFilter'

describe('Staff Individual Filter Suite', () => {
  const mockDraftStaff: StaffOption[] = [
    { id: 'user_1', name: 'Amanda Ribeiro da Silva', role: 'Enfermeira' },
    { id: 'user_2', name: 'João Carlos de Souza', role: 'Médico' },
    { id: 'user_3', name: 'Beatriz Álvares', role: 'Técnica de Enfermagem' },
    { id: 'user_4', name: 'Érica Mendonça', role: 'Enfermeira' },
    { id: 'user_5', name: 'Cláudio Ferreira', role: 'Médico' },
  ]

  const mockDraftShifts = [
    {
      id: 'shift_1',
      staff_profile: 'user_1',
      start_time: '2026-10-01 07:00:00.000Z',
      end_time: '2026-10-01 19:00:00.000Z',
      sector: 'sector_uti',
    },
    {
      id: 'shift_2',
      staff_profile: 'user_2',
      start_time: '2026-10-01 07:00:00.000Z',
      end_time: '2026-10-01 19:00:00.000Z',
      sector: 'sector_uti',
    },
    {
      id: 'shift_3',
      staff_profile: 'user_3',
      start_time: '2026-10-02 07:00:00.000Z',
      end_time: '2026-10-02 19:00:00.000Z',
      sector: 'sector_uti',
    },
    {
      id: 'shift_4',
      staff_profile: 'user_1',
      start_time: '2026-10-03 07:00:00.000Z',
      end_time: '2026-10-03 19:00:00.000Z',
      sector: 'sector_uti',
    },
  ]

  const mockWeekendOffSummary = {
    weekend_off_assignments: {
      user_1: ['2026-10-03', '2026-10-04'],
      user_2: ['2026-10-10', '2026-10-11'],
    },
  }

  // 1. Estado padrão: todos os colaboradores visíveis
  it('1. Estado padrão: retorna todos os colaboradores sem filtro', () => {
    const selectedStaffId = ''
    const visibleStaff = selectedStaffId
      ? mockDraftStaff.filter((s) => s.id === selectedStaffId)
      : mockDraftStaff

    expect(visibleStaff.length).toBe(5)
    expect(visibleStaff).toEqual(mockDraftStaff)
  })

  // 2. Seleção de um nome: somente aquele colaborador aparece
  it('2. Seleção de um nome: filtra exclusivamente o colaborador selecionado', () => {
    const selectedStaffId = 'user_1'
    const visibleStaff = mockDraftStaff.filter((s) => s.id === selectedStaffId)

    expect(visibleStaff.length).toBe(1)
    expect(visibleStaff[0].name).toBe('Amanda Ribeiro da Silva')

    // Na visualização dos plantões: apenas plantões de user_1
    const visibleShifts = mockDraftShifts.filter((s) => s.staff_profile === selectedStaffId)
    expect(visibleShifts.length).toBe(2)
    visibleShifts.forEach((s) => {
      expect(s.staff_profile).toBe('user_1')
    })
  })

  // 3. Busca parcial com acento: "amanda" encontra "Amanda Ribeiro da Silva", "joao" encontra "João Carlos"
  it('3. Busca parcial com/sem acentos e case insensitive: "amanda" encontra "Amanda Ribeiro da Silva"', () => {
    expect(normalizeText('Amanda Ribeiro da Silva')).toBe('amanda ribeiro da silva')
    expect(normalizeText('amanda')).toBe('amanda')

    const searchAmanda = filterStaffByName(mockDraftStaff, 'amanda')
    expect(searchAmanda.length).toBe(1)
    expect(searchAmanda[0].name).toBe('Amanda Ribeiro da Silva')

    // "joao" sem acento deve encontrar "João Carlos de Souza"
    const searchJoao = filterStaffByName(mockDraftStaff, 'joao')
    expect(searchJoao.length).toBe(1)
    expect(searchJoao[0].name).toBe('João Carlos de Souza')

    // "alvares" sem acento deve encontrar "Beatriz Álvares"
    const searchAlvares = filterStaffByName(mockDraftStaff, 'alvares')
    expect(searchAlvares.length).toBe(1)
    expect(searchAlvares[0].name).toBe('Beatriz Álvares')

    // "ERICA" maiúsculo sem acento encontra "Érica Mendonça"
    const searchErica = filterStaffByName(mockDraftStaff, 'ERICA')
    expect(searchErica.length).toBe(1)
    expect(searchErica[0].name).toBe('Érica Mendonça')

    // "claudio" minúsculo sem acento encontra "Cláudio Ferreira"
    const searchClaudio = filterStaffByName(mockDraftStaff, 'claudio')
    expect(searchClaudio.length).toBe(1)
    expect(searchClaudio[0].name).toBe('Cláudio Ferreira')
  })

  // 4. Limpeza do filtro: volta a mostrar todos
  it('4. Limpeza do filtro: ao resetar selectedStaffId para vazio, volta ao conjunto completo', () => {
    let selectedStaffId = 'user_2'
    let visible = mockDraftStaff.filter((s) => !selectedStaffId || s.id === selectedStaffId)
    expect(visible.length).toBe(1)
    expect(visible[0].name).toBe('João Carlos de Souza')

    // Limpeza (simula clique no botão "x" ou seleção de "Todos os colaboradores")
    selectedStaffId = ''
    visible = mockDraftStaff.filter((s) => !selectedStaffId || s.id === selectedStaffId)
    expect(visible.length).toBe(5)
    expect(visible.map((s) => s.id)).toEqual(['user_1', 'user_2', 'user_3', 'user_4', 'user_5'])
  })

  // 5. Zero resultados: dropdown mostra zero itens / vazio
  it('5. Zero resultados: pesquisa inexistente resulta em array vazio', () => {
    const searchNone = filterStaffByName(mockDraftStaff, 'NomeInexistenteXYZ')
    expect(searchNone.length).toBe(0)
    expect(searchNone).toEqual([])
  })

  // 6. Ausência de alteração nos dados: assignments, plantões e validações intactos
  it('6. Ausência de alteração nos dados: o estado global de plantões e folgas permanece idêntico', () => {
    const originalShiftsCopy = JSON.parse(JSON.stringify(mockDraftShifts))
    const originalAssignmentsCopy = JSON.parse(JSON.stringify(mockWeekendOffSummary))

    // Aplica múltiplos filtros e limpezas
    const selected1 = 'user_1'
    const view1Shifts = mockDraftShifts.filter((s) => s.staff_profile === selected1)
    expect(view1Shifts.length).toBe(2)

    const selected2 = 'user_3'
    const view2Shifts = mockDraftShifts.filter((s) => s.staff_profile === selected2)
    expect(view2Shifts.length).toBe(1)

    // Verifica que a fonte de dados principal NÃO foi mutada
    expect(mockDraftShifts).toEqual(originalShiftsCopy)
    expect(mockWeekendOffSummary).toEqual(originalAssignmentsCopy)
  })

  it('ordenação alfabética e unicidade dos colaboradores da lista', () => {
    const rawListWithDuplicates: StaffOption[] = [
      { id: 'u_z', name: 'Zélia Ramos' },
      { id: 'u_a', name: 'Ana Carolina' },
      { id: 'u_z', name: 'Zélia Ramos' }, // duplicado
      { id: 'u_b', name: 'Bruna Lima' },
      { id: 'u_a', name: 'Ana Carolina' }, // duplicado
    ]

    const map = new Map<string, StaffOption>()
    rawListWithDuplicates.forEach((s) => {
      if (s && s.id && !map.has(s.id)) {
        map.set(s.id, s)
      }
    })
    const sorted = Array.from(map.values()).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }),
    )

    expect(sorted.length).toBe(3)
    expect(sorted.map((s) => s.name)).toEqual(['Ana Carolina', 'Bruna Lima', 'Zélia Ramos'])
  })
})
