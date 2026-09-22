import { normalizeParityValue } from './parity-labels'

/**
 * Retorna o número de dias de um determinado mês e ano (mês 1..12).
 * Usa new Date(Date.UTC(y, m, 0)).getUTCDate().
 */
export function getDaysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/**
 * Âncora histórica: Outubro/2026 ("Ciclo Outubro 2026")
 * Nesse mês âncora, Equipe 1 ('even') trabalha nos dias pares civis.
 */
export const ANCHOR_YEAR = 2026
export const ANCHOR_MONTH = 10

/**
 * Resolve a paridade ativa da equipe no mês alvo (year, month).
 * month deve ser 1..12.
 * Regra determinística:
 * Conta quantos meses com 31 dias existem no caminho entre Outubro/2026 e o mês alvo.
 *
 * Como funciona a alternância contínua 12x36 (dia sim, dia não):
 * - Se um mês tem 31 dias (ímpar), o dia 31 e o dia 1 do mês seguinte têm a mesma paridade numérica (ambos ímpares).
 *   Portanto, a equipe que trabalhou no dia 30 (par) folga no 31 (ímpar) e trabalha no dia 1 (ímpar)!
 *   Houve uma inversão de paridade numérica no mês seguinte.
 * - Se um mês tem 30 ou 28/29 dias (par), o último dia é par (ex: 30) e o dia 1 é ímpar.
 *   A equipe que trabalhou no dia 30 folga no dia 1 e trabalha no dia 2 (par).
 *   Não há inversão de paridade numérica.
 *
 * Logo, cada mês com 31 dias percorrido inverte a paridade numérica dos dias de trabalho.
 *
 * Caminho para frente (mês alvo > âncora):
 * Contamos os meses com 31 dias desde [ANCHOR_YEAR, ANCHOR_MONTH] até o mês imediatamente anterior ao mês alvo.
 * Exemplo: Nov/2026 -> Out/2026 tem 31 dias -> 1 mês de 31 dias -> inverte!
 *
 * Caminho para trás (mês alvo < âncora):
 * Contamos os meses com 31 dias desde [year, month] até o mês anterior à âncora.
 * Se a contagem for ímpar, inverte a paridade.
 */
export function resolveTeamWorkingParity(
  base: 'even' | 'odd',
  year: number,
  month: number,
): 'even' | 'odd' {
  const targetTotalMonths = year * 12 + (month - 1)
  const anchorTotalMonths = ANCHOR_YEAR * 12 + (ANCHOR_MONTH - 1)

  if (targetTotalMonths === anchorTotalMonths) {
    return base
  }

  let count31 = 0

  if (targetTotalMonths > anchorTotalMonths) {
    // Meses intermediários cujo tamanho determina a transição para o mês seguinte:
    // Começa em anchorTotalMonths e vai até targetTotalMonths - 1
    for (let m = anchorTotalMonths; m < targetTotalMonths; m++) {
      const y = Math.floor(m / 12)
      const mon = (m % 12) + 1
      if (getDaysInMonth(y, mon) === 31) {
        count31++
      }
    }
  } else {
    // Caminho para trás:
    // Do mês alvo até antes do mês âncora
    for (let m = targetTotalMonths; m < anchorTotalMonths; m++) {
      const y = Math.floor(m / 12)
      const mon = (m % 12) + 1
      if (getDaysInMonth(y, mon) === 31) {
        count31++
      }
    }
  }

  const shouldInvert = count31 % 2 !== 0
  if (!shouldInvert) {
    return base
  }

  return base === 'even' ? 'odd' : 'even'
}

/**
 * Verifica se um colaborador com paridade base é elegível para trabalhar na data especificada (YYYY-MM-DD).
 * NUNCA usa new Date('YYYY-MM-DD') devido a timezone shifts; faz split string puro.
 */
export function isStaffEligibleForDateWithInversion(
  dateStr: string,
  baseParity?: string | null,
): boolean {
  const normBase = normalizeParityValue(baseParity)
  if (!normBase) {
    // Sem paridade definida: elegível por padrão (ou sem restrição de paridade 12x36)
    return true
  }

  if (!dateStr || typeof dateStr !== 'string') return true

  const parts = dateStr.split('-')
  if (parts.length < 3) return true

  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const day = parseInt(parts[2], 10)

  if (isNaN(year) || isNaN(month) || isNaN(day)) return true

  // Resolve qual paridade trabalha no mês alvo
  const activeWorkingParity = resolveTeamWorkingParity(normBase, year, month)

  // Paridade do dia civil
  const dayParity: 'even' | 'odd' = day % 2 === 0 ? 'even' : 'odd'

  return activeWorkingParity === dayParity
}
