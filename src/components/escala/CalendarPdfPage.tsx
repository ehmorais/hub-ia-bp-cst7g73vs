import React from 'react'
import { ShiftCalendarGrid, CalendarGridLegend, CalendarDayItem } from './ShiftCalendarGrid'
import { BPSCS_LOGO_BASE64 } from '@/utils/bpscsLogo'

export interface CalendarPdfPageProps {
  title?: string
  sectorName?: string
  cycleName?: string
  cycleStart?: string
  cycleEnd?: string
  days: CalendarDayItem[]
  shifts: any[]
  contracts: any[]
  staffProfiles?: Array<{
    id: string
    name: string
    professional_id?: string | null
    default_sector?: string
    vacation_enabled?: boolean | null
    vacation_start?: string | null
    vacation_end?: string | null
    [key: string]: any
  }>
  weekendOffMap?: Map<string, Set<string>>
  selectedSectorId?: string
  sectorMinStaffing?: number
  selectedStaffId?: string
  pageCurrent?: number
  pageTotal?: number
  showLegend?: boolean
  logoBase64?: string
  weekRangeLabel?: string
}

/**
 * Componente de página individual do PDF em A4 Paisagem (~1120px de largura).
 * Renderiza o cabeçalho institucional (com logotipo BPSCS), a grade idêntica à tela
 * reutilizando ShiftCalendarGrid, e na última página a legenda oficial idêntica.
 */
export function CalendarPdfPage({
  title = 'Escala de Plantões — Calendário',
  sectorName,
  cycleName,
  cycleStart,
  cycleEnd,
  days,
  shifts,
  contracts,
  staffProfiles = [],
  weekendOffMap = new Map(),
  selectedSectorId,
  sectorMinStaffing = 0,
  selectedStaffId,
  pageCurrent = 1,
  pageTotal = 1,
  showLegend = false,
  logoBase64 = BPSCS_LOGO_BASE64,
  weekRangeLabel,
}: CalendarPdfPageProps) {
  const subtitleParts: string[] = []
  if (sectorName) subtitleParts.push(`Setor: ${sectorName}`)
  if (cycleName) subtitleParts.push(`Ciclo: ${cycleName}`)
  else if (cycleStart && cycleEnd) subtitleParts.push(`Período: ${cycleStart} a ${cycleEnd}`)
  else if (cycleStart) subtitleParts.push(`Início: ${cycleStart}`)
  if (weekRangeLabel) subtitleParts.push(weekRangeLabel)
  const subtitle = subtitleParts.join(' • ')

  return (
    <div
      className="page-container bg-white text-slate-800 flex flex-col justify-between box-border p-6"
      style={{
        width: '1123px',
        minHeight: '794px',
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
      }}
    >
      {/* Topo / Cabeçalho Institucional */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-3">
            <img
              src={logoBase64}
              alt="Logo Beneficência Portuguesa"
              className="h-10 w-auto object-contain shrink-0"
            />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Beneficência Portuguesa de São Caetano do Sul
              </div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">{title}</h1>
              {subtitle && (
                <div className="text-xs text-slate-600 font-medium mt-0.5">{subtitle}</div>
              )}
            </div>
          </div>
          <div className="text-right text-xs text-slate-500 font-medium">
            <div>
              Página {pageCurrent} de {pageTotal}
            </div>
            <div className="text-[10px] text-slate-400">Hub IA BP • Gestão de Escalas</div>
          </div>
        </div>

        {/* Grade semanal compartilhada */}
        <div className="w-full border border-slate-200 rounded overflow-hidden">
          <ShiftCalendarGrid
            days={days}
            shifts={shifts}
            contracts={contracts}
            staffProfiles={staffProfiles}
            weekendOffMap={weekendOffMap}
            selectedSectorId={selectedSectorId}
            sectorMinStaffing={sectorMinStaffing}
            selectedStaffId={selectedStaffId}
            dayFilter="all"
            view="cycle"
            isInteractive={false}
          />
        </div>
      </div>

      {/* Rodapé / Legenda (apenas na última página ou se solicitado) */}
      <div className="mt-4 pt-2 border-t border-slate-200 flex flex-col gap-2">
        {showLegend && (
          <div className="w-full rounded border border-slate-200 overflow-hidden">
            <CalendarGridLegend />
          </div>
        )}
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>Documento gerado automaticamente pelo sistema de Gestão de Escalas BP</span>
          <span>
            Página {pageCurrent} de {pageTotal}
          </span>
        </div>
      </div>
    </div>
  )
}
