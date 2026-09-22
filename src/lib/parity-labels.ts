export const TEAM_1_LABEL = 'Equipe 1'
export const TEAM_2_LABEL = 'Equipe 2'

/**
 * Normaliza strings com variações de paridade para 'even', 'odd' ou null.
 * Variantes aceitas:
 * 'even', 'par', 'pares', 'dias pares', 'dia par', 'equipe 1', 'equipe1' -> 'even'
 * 'odd', 'ímpar', 'impar', 'ímpares', 'impares', 'dias ímpares', 'dia ímpar', 'equipe 2', 'equipe2' -> 'odd'
 */
export function normalizeParityValue(v?: string | null): 'even' | 'odd' | null {
  if (!v) return null
  const clean = v
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (
    clean === 'even' ||
    clean === 'par' ||
    clean === 'pares' ||
    clean === 'dias pares' ||
    clean === 'dia par' ||
    clean === 'equipe 1' ||
    clean === 'equipe1'
  ) {
    return 'even'
  }

  if (
    clean === 'odd' ||
    clean === 'impar' ||
    clean === 'impares' ||
    clean === 'dias impares' ||
    clean === 'dia impar' ||
    clean === 'equipe 2' ||
    clean === 'equipe2'
  ) {
    return 'odd'
  }

  return null
}

/**
 * Retorna o rótulo canônico amigável:
 * 'even' -> 'Equipe 1'
 * 'odd'  -> 'Equipe 2'
 * Outros -> '-'
 */
export function canonicalLabel(p?: string | null): string {
  const norm = normalizeParityValue(p)
  if (norm === 'even') return TEAM_1_LABEL
  if (norm === 'odd') return TEAM_2_LABEL
  return '-'
}
