import { describe, it, expect } from 'vitest'
import {
  isVacationActive,
  isVacationDateInclusive,
  getVacationBlockedProfileIds,
  normalizeDateString,
} from './escala-vacation'

describe('Gestão de Férias - Helpers (src/lib/escala-vacation.ts)', () => {
  it('1. Legados sem férias carregam desativados/nulos', () => {
    const legacyProfile1 = {
      id: 'prof-legacy-1',
      name: 'Enfermeiro Teste',
      vacation_enabled: false,
      vacation_start: null,
      vacation_end: null,
    }
    const legacyProfile2 = {
      id: 'prof-legacy-2',
      name: 'Técnico Teste',
    }

    expect(isVacationActive(legacyProfile1)).toBe(false)
    expect(isVacationActive(legacyProfile2)).toBe(false)
    expect(isVacationDateInclusive(legacyProfile1, '2025-05-10')).toBe(false)
    expect(isVacationDateInclusive(legacyProfile2, '2025-05-10')).toBe(false)
  })

  it('2. Switch ativação/desativação com persistência editável ao reabrir', () => {
    const profile = {
      id: 'prof-123',
      vacation_enabled: true,
      vacation_start: '2025-06-01 00:00:00.000Z',
      vacation_end: '2025-06-15 00:00:00.000Z',
    }

    // Ativo com ambas as datas válidas
    expect(isVacationActive(profile)).toBe(true)

    // Se o switch for desligado (vacation_enabled = false), fica inativo mesmo mantendo as datas
    const disabledProfile = { ...profile, vacation_enabled: false }
    expect(isVacationActive(disabledProfile)).toBe(false)
    expect(isVacationDateInclusive(disabledProfile, '2025-06-05')).toBe(false)

    // Reativado ao reabrir formulário
    const reOpenedProfile = { ...disabledProfile, vacation_enabled: true }
    expect(isVacationActive(reOpenedProfile)).toBe(true)
    expect(isVacationDateInclusive(reOpenedProfile, '2025-06-05')).toBe(true)
  })

  it('3. Validação de obrigatoriedade quando ativo e "Até" >= "De"', () => {
    // Incompleto: sem vacation_start
    const incomplete1 = {
      vacation_enabled: true,
      vacation_start: null,
      vacation_end: '2025-06-10',
    }
    expect(isVacationActive(incomplete1)).toBe(false)

    // Incompleto: sem vacation_end
    const incomplete2 = {
      vacation_enabled: true,
      vacation_start: '2025-06-01',
      vacation_end: null,
    }
    expect(isVacationActive(incomplete2)).toBe(false)

    // Inválido: Até < De
    const invalidDates = {
      vacation_enabled: true,
      vacation_start: '2025-06-15',
      vacation_end: '2025-06-01',
    }
    expect(isVacationActive(invalidDates)).toBe(false)

    // Válido: De == Até (1 único dia de férias)
    const singleDay = {
      vacation_enabled: true,
      vacation_start: '2025-06-05',
      vacation_end: '2025-06-05',
    }
    expect(isVacationActive(singleDay)).toBe(true)
    expect(isVacationDateInclusive(singleDay, '2025-06-05')).toBe(true)
    expect(isVacationDateInclusive(singleDay, '2025-06-06')).toBe(false)
  })

  it('4. Limite inclusivo: data inicial e data final do intervalo bloqueadas sem desvio de timezone', () => {
    const profile = {
      id: 'prof-inclusive',
      vacation_enabled: true,
      vacation_start: '2025-07-10',
      vacation_end: '2025-07-20',
    }

    // Extremo inicial INCLUSIVO
    expect(isVacationDateInclusive(profile, '2025-07-10')).toBe(true)
    // Extremo final INCLUSIVO
    expect(isVacationDateInclusive(profile, '2025-07-20')).toBe(true)
    // Meio do período
    expect(isVacationDateInclusive(profile, '2025-07-15')).toBe(true)

    // Fora do período
    expect(isVacationDateInclusive(profile, '2025-07-09')).toBe(false)
    expect(isVacationDateInclusive(profile, '2025-07-21')).toBe(false)
  })

  it('5. getVacationBlockedProfileIds retorna lista correta de colaboradores bloqueados', () => {
    const staffList = [
      {
        id: 'prof-a',
        vacation_enabled: true,
        vacation_start: '2025-08-01',
        vacation_end: '2025-08-10',
      },
      {
        id: 'prof-b',
        vacation_enabled: true,
        vacation_start: '2025-08-05',
        vacation_end: '2025-08-15',
      },
      {
        id: 'prof-c',
        vacation_enabled: false,
        vacation_start: '2025-08-01',
        vacation_end: '2025-08-10',
      },
      {
        id: 'prof-d',
        // Sem férias
      },
    ]

    expect(getVacationBlockedProfileIds(staffList, '2025-08-02')).toEqual(['prof-a'])
    expect(getVacationBlockedProfileIds(staffList, '2025-08-07')).toEqual(['prof-a', 'prof-b'])
    expect(getVacationBlockedProfileIds(staffList, '2025-08-12')).toEqual(['prof-b'])
    expect(getVacationBlockedProfileIds(staffList, '2025-08-20')).toEqual([])
  })

  it('6. Normalização correta de formatos de datas (ISO e PB)', () => {
    expect(normalizeDateString('2025-09-01 00:00:00.000Z')).toBe('2025-09-01')
    expect(normalizeDateString('2025-09-01T15:30:00.000Z')).toBe('2025-09-01')
    expect(normalizeDateString('2025-09-01')).toBe('2025-09-01')
    expect(normalizeDateString(new Date('2025-09-01T00:00:00.000Z'))).toBe('2025-09-01')
  })
})
