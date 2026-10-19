import { describe, it, expect } from 'vitest'
import {
  prepareCalendarMultiPageData,
  exportAutoGenerateCalendarPdf,
  type ExportAutoGenerateCalendarPdfParams,
} from './scalePdfExport'
import jsPDF from 'jspdf'
import { CALENDAR_PDF_COMMON_STYLES } from '@/templates/calendarPdfTemplate'

describe('Teste de Regressão: Exportação UTI 2 Densa (17 colaboradores, 7-12 cards/dia)', () => {
  // Cenário realista do setor UTI 2: 17 colaboradores, dia denso com 11 plantões
  const denseStaffProfiles = Array.from({ length: 17 }, (_, idx) => ({
    id: `staff-uti2-${idx + 1}`,
    name: `Profissional UTI2 ${idx + 1} Silva Santos`,
    professional_id: `COREN-SP ${100000 + idx}`,
  }))

  const denseDays = [
    { date: new Date(2026, 9, 5), key: '2026-10-05', dayOfWeek: 1 }, // Seg
    { date: new Date(2026, 9, 6), key: '2026-10-06', dayOfWeek: 2 }, // Ter (Dia denso com 11 cards)
    { date: new Date(2026, 9, 7), key: '2026-10-07', dayOfWeek: 3 }, // Qua
    { date: new Date(2026, 9, 8), key: '2026-10-08', dayOfWeek: 4 }, // Qui
    { date: new Date(2026, 9, 9), key: '2026-10-09', dayOfWeek: 5 }, // Sex
    { date: new Date(2026, 9, 10), key: '2026-10-10', dayOfWeek: 6 }, // Sab
    { date: new Date(2026, 9, 11), key: '2026-10-11', dayOfWeek: 0 }, // Dom
  ]

  // No dia 2026-10-06, 11 plantões escalados
  const denseShifts = Array.from({ length: 11 }, (_, idx) => ({
    id: `shift-uti2-${idx + 1}`,
    staff_profile: denseStaffProfiles[idx].id,
    start_time: idx < 6 ? '2026-10-06 07:00:00' : '2026-10-06 19:00:00',
    end_time: idx < 6 ? '2026-10-06 19:00:00' : '2026-10-07 07:00:00',
  }))

  const params: ExportAutoGenerateCalendarPdfParams = {
    title: 'Escala Mensal UTI 2',
    sectorName: 'UTI 2',
    cycleName: 'Outubro 2026',
    cycleStart: '2026-10-01',
    cycleEnd: '2026-10-31',
    days: denseDays,
    shifts: denseShifts,
    contracts: denseStaffProfiles.map((p) => ({ staff_profile: p.id })),
    staffProfiles: denseStaffProfiles,
    weekendOffMap: new Map(),
  }

  it('(a) e (b): limita a no máximo 4 cards na grade principal da semana e cria páginas de continuação dedicadas para o excedente', () => {
    const { pages, maxChipsPerCell } = prepareCalendarMultiPageData(params)

    // Afirma limite de 4 cards por célula na grade principal
    expect(maxChipsPerCell).toBe(4)

    // Deve conter a página principal da semana ('week')
    const weekPages = pages.filter((p) => p.pageType === 'week')
    expect(weekPages.length).toBeGreaterThanOrEqual(1)

    // Deve conter página(s) de continuação para o dia denso (11 cards > 4)
    const continuationPages = pages.filter((p) => p.pageType === 'day_continuation')
    expect(continuationPages.length).toBeGreaterThanOrEqual(1)

    // A página de continuação deve conter os plantões do dia denso
    const contDay = continuationPages[0].continuationDay
    expect(contDay?.dateKey).toBe('2026-10-06')
    expect(contDay?.shifts.length).toBe(11)
  })

  it('(c): TODAS as páginas do PDF gerado nascem e permanecem em landscape A4 (largura 297 > altura 210 na metadata)', async () => {
    // Chama o exportador real pedindo o documento jsPDF
    const doc = (await exportAutoGenerateCalendarPdf({
      ...params,
      returnDoc: true,
    } as any)) as unknown as jsPDF

    expect(doc).toBeDefined()
    const totalPages = doc.getNumberOfPages()
    expect(totalPages).toBeGreaterThanOrEqual(2)

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      // Valida dimensões A4 Landscape em milímetros: 297 x 210
      expect(pageWidth).toBeCloseTo(297, 1)
      expect(pageHeight).toBeCloseTo(210, 1)
      expect(pageWidth).toBeGreaterThan(pageHeight)
    }
  })

  it('(d): ausência de transform/scale/zoom distorcivo ou esticamento da captura no contêiner de renderização', () => {
    // Validar regras de estilo CSS da captura e templates
    // Contêiner tem dimensões fixas compatíveis com A4 landscape (297x210 mm) sem zooms ou escalas deformantes
    expect(CALENDAR_PDF_COMMON_STYLES).toMatch(/width:\s*1123px/)
    expect(CALENDAR_PDF_COMMON_STYLES).not.toMatch(/zoom:\s*0\./)
    expect(CALENDAR_PDF_COMMON_STYLES).not.toMatch(/transform:\s*scale\(/)
  })

  it('setores menores (ex.: PS RESPIRATÓRIO com 2-3 colaboradores/dia) continuam sem quebrar e geram landscape sem páginas espúrias de continuação', () => {
    const psProfiles = [
      { id: 'ps-1', name: 'Médico PS 1', professional_id: '101' },
      { id: 'ps-2', name: 'Médico PS 2', professional_id: '102' },
      { id: 'ps-3', name: 'Médico PS 3', professional_id: '103' },
    ]

    const psShifts = [
      {
        id: 'ps-s1',
        staff_profile: 'ps-1',
        start_time: '2026-10-06 07:00:00',
        end_time: '2026-10-06 19:00:00',
      },
      {
        id: 'ps-s2',
        staff_profile: 'ps-2',
        start_time: '2026-10-06 07:00:00',
        end_time: '2026-10-06 19:00:00',
      },
    ]

    const psParams: ExportAutoGenerateCalendarPdfParams = {
      title: 'Escala PS Respiratório',
      sectorName: 'PS RESPIRATÓRIO',
      cycleName: 'Outubro 2026',
      days: denseDays,
      shifts: psShifts,
      contracts: psProfiles.map((p) => ({ staff_profile: p.id })),
      staffProfiles: psProfiles,
      weekendOffMap: new Map(),
    }

    const { pages } = prepareCalendarMultiPageData(psParams)
    // Sem dias > 4 itens, não deve criar páginas de continuação
    const continuationPages = pages.filter((p) => p.pageType === 'day_continuation')
    expect(continuationPages.length).toBe(0)
    expect(pages.length).toBe(1)
    expect(pages[0].pageType).toBe('week')
  })
})
