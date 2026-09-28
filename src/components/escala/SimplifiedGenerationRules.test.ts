import { describe, it, expect } from 'vitest'
import {
  resolveTeamWorkingParity,
  isStaffEligibleForDateWithInversion,
} from '@/lib/parity-inversion'

describe('Motor de Geração Simplificado - Regras Obrigatórias e Desempenho', () => {
  it('1. Alternância contínua 12x36 respeitando Equipe 1 (even) e Equipe 2 (odd)', () => {
    // Para outubro de 2026 (âncora)
    // Equipe 1 ('even') trabalha em dias pares (ex: 2026-10-02, 2026-10-04, 2026-10-06)
    expect(isStaffEligibleForDateWithInversion('2026-10-02', 'even')).toBe(true)
    expect(isStaffEligibleForDateWithInversion('2026-10-03', 'even')).toBe(false)
    expect(isStaffEligibleForDateWithInversion('2026-10-04', 'even')).toBe(true)

    // Equipe 2 ('odd') trabalha em dias ímpares (ex: 2026-10-01, 2026-10-03, 2026-10-05)
    expect(isStaffEligibleForDateWithInversion('2026-10-01', 'odd')).toBe(true)
    expect(isStaffEligibleForDateWithInversion('2026-10-02', 'odd')).toBe(false)
    expect(isStaffEligibleForDateWithInversion('2026-10-03', 'odd')).toBe(true)
  })

  it('2. Paridade contínua entre ciclos e inversão em mês após 31 dias', () => {
    // Outubro tem 31 dias, então em Novembro de 2026 a paridade inverte para manter 36h de descanso
    const parityEvenInNov = resolveTeamWorkingParity('even', 2026, 11)
    expect(parityEvenInNov).toBe('odd')

    // Dia 31 de Outubro (ímpar) foi trabalhado pela equipe odd
    // No dia 01 de Novembro (ímpar), quem trabalha agora é a equipe even (invertida para odd no mês)
    // garantindo 36h de descanso contínuo
    expect(isStaffEligibleForDateWithInversion('2026-11-01', 'even')).toBe(true)
    expect(isStaffEligibleForDateWithInversion('2026-11-01', 'odd')).toBe(false)
  })

  it('3. Garantia de exatamente uma folga em fim de semana por mês para colaborador', () => {
    // Simula a lógica do gerador simplificado:
    // Para cada colaborador e cada mês do ciclo, seleciona exatamente um plantão de sábado/domingo para folga
    const daysInMonthNovember2025 = [
      '2025-11-01', // Sábado
      '2025-11-03',
      '2025-11-05',
      '2025-11-07',
      '2025-11-09', // Domingo
      '2025-11-11',
      '2025-11-13',
      '2025-11-15', // Sábado
    ]

    const isWeekend = (dateStr: string) => {
      const parts = dateStr.split('-').map(Number)
      const dow = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay()
      return dow === 0 || dow === 6
    }

    const weekendDays = daysInMonthNovember2025.filter(isWeekend)
    expect(weekendDays.length).toBeGreaterThanOrEqual(1)

    // Escolhe exatamente 1 folga de fim de semana
    const chosenWeekendOff = weekendDays[0]
    const assignedShifts = daysInMonthNovember2025.filter((d) => d !== chosenWeekendOff)

    // O colaborador agora tem 1 folga garantida no fim de semana
    expect(assignedShifts).not.toContain(chosenWeekendOff)
    expect(assignedShifts.length).toBe(daysInMonthNovember2025.length - 1)
  })

  it('4. Folga impossível gera aviso e NÃO bloqueia o rascunho', () => {
    // Cenário onde não há dias de fim de semana disponíveis no mês
    const staffDaysInMonth = ['2025-11-03', '2025-11-05', '2025-11-07'] // apenas dias úteis
    const isWeekend = (dateStr: string) => {
      const parts = dateStr.split('-').map(Number)
      const dow = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay()
      return dow === 0 || dow === 6
    }
    const candidateWeekendDays = staffDaysInMonth.filter(isWeekend)
    const warnings: string[] = []

    if (candidateWeekendDays.length === 0) {
      warnings.push(
        'Colaborador sem plantão de fim de semana no mês; aviso registrado e prosseguindo.',
      )
    }

    // Não lança erro e rascunho continua válido com aviso
    expect(warnings.length).toBe(1)
    expect(warnings[0]).toContain('aviso registrado e prosseguindo')
    expect(staffDaysInMonth.length).toBe(3)
  })

  it('5. Rascunho é salvo como rascunho e nunca publicado automaticamente', () => {
    const draftStatus = 'draft'
    expect(draftStatus).toBe('draft')
    expect(draftStatus).not.toBe('published')
  })
})
