/**
 * Helpers para gestão de férias de colaboradores da escala
 *
 * Regras:
 * - isVacationActive: vacation_enabled === true e ambas as datas (vacation_start e vacation_end) preenchidas
 * - isVacationDateInclusive: comparação inclusiva vacation_start <= date <= vacation_end em string YYYY-MM-DD
 * - getVacationBlockedProfileIds: retorna lista de IDs de colaboradores com férias ativas em uma data
 */

export interface StaffProfileVacationData {
  id?: string
  vacation_enabled?: boolean | null
  vacation_start?: string | null
  vacation_end?: string | null
  [key: string]: any
}

/**
 * Normaliza qualquer formato de data (ISO, PocketBase 'YYYY-MM-DD HH:mm:ss', etc.) para 'YYYY-MM-DD'.
 */
export function normalizeDateString(date: string | Date | null | undefined): string {
  if (!date) return ''
  if (date instanceof Date) {
    if (isNaN(date.getTime())) return ''
    return date.toISOString().split('T')[0]
  }
  const clean = String(date).trim()
  if (!clean) return ''
  // Se contiver 'T' ou ' ', pega apenas a primeira parte YYYY-MM-DD
  const part = clean.split('T')[0].split(' ')[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
    return part
  }
  return part
}

/**
 * Retorna true se as férias do colaborador estiverem ativas (flag true e ambas as datas preenchidas).
 */
export function isVacationActive(
  staffProfile: StaffProfileVacationData | null | undefined,
): boolean {
  if (!staffProfile) return false
  if (staffProfile.vacation_enabled !== true) return false
  const start = normalizeDateString(staffProfile.vacation_start)
  const end = normalizeDateString(staffProfile.vacation_end)
  return Boolean(start && end && start <= end)
}

/**
 * Retorna true se a data fornecida estiver dentro do intervalo [vacation_start, vacation_end] INCLUSIVE os extremos.
 * Usa estritamente strings 'YYYY-MM-DD' para evitar problemas de fuso horário.
 */
export function isVacationDateInclusive(
  staffProfile: StaffProfileVacationData | null | undefined,
  date: string | Date | null | undefined,
): boolean {
  if (!isVacationActive(staffProfile)) return false
  const targetDate = normalizeDateString(date)
  if (!targetDate) return false

  const start = normalizeDateString(staffProfile!.vacation_start)
  const end = normalizeDateString(staffProfile!.vacation_end)

  return targetDate >= start && targetDate <= end
}

/**
 * Retorna a lista de IDs de colaboradores com férias ativas que bloqueiam uma determinada data.
 */
export function getVacationBlockedProfileIds(
  staffProfiles: StaffProfileVacationData[] | null | undefined,
  date: string | Date | null | undefined,
): string[] {
  if (!staffProfiles || !Array.isArray(staffProfiles) || staffProfiles.length === 0) {
    return []
  }
  const targetDate = normalizeDateString(date)
  if (!targetDate) return []

  const blockedIds: string[] = []
  for (const profile of staffProfiles) {
    if (!profile) continue
    if (isVacationDateInclusive(profile, targetDate)) {
      const id = profile.id || profile.user_id || profile.staff_profile
      if (id && blockedIds.indexOf(id) === -1) {
        blockedIds.push(id)
      }
    }
  }
  return blockedIds
}
