/**
 * Helper para formatação de COREN/Registro Profissional no Calendário de Escalas.
 */

/**
 * Formata o registro de COREN para exibição no calendário.
 * Se informado, exibe "COREN <numero_ou_registro>".
 * Se já contiver a palavra "COREN" (ex: "COREN-SP 12345" ou "COREN 12345"), normaliza mantendo o identificador legível.
 * Se vazio ou não informado, retorna "COREN não informado".
 */
export function formatCorenLabel(corenOrProfessionalId?: string | null): string {
  if (!corenOrProfessionalId) {
    return 'COREN não informado'
  }

  const trimmed = String(corenOrProfessionalId).trim()
  if (!trimmed) {
    return 'COREN não informado'
  }

  // Se já começar com COREN (ex: "COREN 12345" ou "COREN-SP 12345" ou "COREN/SP 12345"), mantém ou ajusta
  if (/^coren/i.test(trimmed)) {
    return trimmed
  }

  return `COREN ${trimmed}`
}

/**
 * Formata a segunda linha da célula do calendário de escalas:
 * "D • COREN 12345" ou "N • COREN não informado"
 */
export function formatShiftCalendarSecondLine(
  periodLetter: 'D' | 'N',
  corenOrProfessionalId?: string | null,
): string {
  const corenLabel = formatCorenLabel(corenOrProfessionalId)
  return `${periodLetter} • ${corenLabel}`
}
