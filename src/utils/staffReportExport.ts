import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { BPSCS_LOGO_BASE64 } from './scalePdfExport'
import { canonicalLabel } from '@/lib/parity-labels'

export interface CollaboratorReportRow {
  id: string
  name: string
  professionalId: string
  role: string
  sector: string
  contractType: string
  monthlyHourLimit: string
  shiftType: string
  shiftParity: string // 'Equipe 1' | 'Equipe 2' | '-'
  cycleStartDate: string
  status: string // 'Ativo' | 'Inativo'
  vacationStatus: string // 'Em férias' | 'Sem férias' | 'Programadas'
  vacationPeriod: string // 'DD/MM/AAAA a DD/MM/AAAA' ou '-'
  rulesCount: number
  rulesList: string
  createdAt: string
  updatedAt: string
}

/**
 * 14 colunas oficiais compartilhadas entre as exportações Excel e PDF.
 * A ordem e a grafia dos campos atendem estritamente à especificação.
 */
export const COLLABORATOR_REPORT_COLUMNS = [
  'Nome do Colaborador',
  'Registro Profissional (COREN/CRM)',
  'Função/Cargo',
  'Setor Padrão',
  'Regime/Turno',
  'Equipe de Plantão',
  'Início no Ciclo',
  'Status',
  'Férias (Status)',
  'Período de Férias',
  'Qtd. Regras',
  'Regras Vinculadas',
  'Data de Cadastro',
  'Última Atualização',
] as const

/**
 * Mapeamento padronizado de uma linha de colaborador para os 14 valores correspondentes
 * às colunas COLLABORATOR_REPORT_COLUMNS. Garante coerência idêntica entre Excel e PDF.
 */
export function mapCollaboratorRowToValues(r: CollaboratorReportRow): (string | number)[] {
  const formattedParity =
    canonicalLabel(r.shiftParity) === '-' ? r.shiftParity || '-' : canonicalLabel(r.shiftParity)
  return [
    r.name || '-',
    r.professionalId || '-',
    r.role || '-',
    r.sector || '-',
    r.shiftType || '-',
    formattedParity,
    r.cycleStartDate || '-',
    r.status || '-',
    r.vacationStatus || '-',
    r.vacationPeriod || '-',
    r.rulesCount ?? 0,
    r.rulesList || '-',
    r.createdAt || '-',
    r.updatedAt || '-',
  ]
}

function getFormattedDateStamp(): { dateStr: string; timestampStr: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return {
    dateStr: `${y}-${m}-${d}`,
    timestampStr: `${d}/${m}/${y} ${hh}:${mm}:${ss}`,
  }
}

/**
 * Exporta para arquivo .xlsx com aba "Colaboradores"
 * Atende aos requisitos:
 * - Título e data/hora de geração
 * - Total de colaboradores filtrados
 * - Cabeçalhos legíveis e congelados
 * - Autofilter ativo
 * - Larguras de colunas ajustadas
 * - Orientação de impressão Landscape
 * - Repetição de cabeçalho ao imprimir
 */
export function exportCollaboratorsToExcel(
  rows: CollaboratorReportRow[],
  customFilename?: string,
): string {
  const { dateStr, timestampStr } = getFormattedDateStamp()
  const total = rows.length

  // Estrutura de linhas com metadados no topo
  const sheetData: (string | number)[][] = [
    ['RELATÓRIO GERAL DE COLABORADORES - BENEFICÊNCIA PORTUGUESA'],
    [`Gerado em: ${timestampStr}`, '', '', '', `Total de Colaboradores: ${total}`],
    [], // linha vazia de respiro
    [...COLLABORATOR_REPORT_COLUMNS],
  ]

  rows.forEach((r) => {
    sheetData.push(mapCollaboratorRowToValues(r))
  })

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData)

  // Larguras ajustadas para evitar truncamento (14 colunas)
  worksheet['!cols'] = [
    { wch: 32 }, // Nome do Colaborador
    { wch: 22 }, // Registro Profissional (COREN/CRM)
    { wch: 24 }, // Função/Cargo
    { wch: 24 }, // Setor Padrão
    { wch: 26 }, // Regime/Turno
    { wch: 22 }, // Equipe de Plantão
    { wch: 16 }, // Início no Ciclo
    { wch: 12 }, // Status
    { wch: 16 }, // Férias (Status)
    { wch: 26 }, // Período de Férias
    { wch: 13 }, // Qtd. Regras
    { wch: 32 }, // Regras Vinculadas
    { wch: 16 }, // Data de Cadastro
    { wch: 16 }, // Última Atualização
  ]

  // Linha 4 (índice 3) é o cabeçalho de dados -> Autofilter (14 colunas = A até N)
  const lastColLetter = 'N'
  const lastRowIndex = sheetData.length
  worksheet['!autofilter'] = { ref: `A4:${lastColLetter}${lastRowIndex}` }

  // Congelar as 4 primeiras linhas (metadados + cabeçalho da tabela)
  worksheet['!freeze'] = {
    xSplit: 0,
    ySplit: 4,
    topLeftCell: 'A5',
    activePane: 'bottomLeft',
    state: 'frozen',
  }

  // Configurações de margens de página (formato estreito/narrow adequado para planilhas horizontais)
  worksheet['!margins'] = {
    left: 0.25,
    right: 0.25,
    top: 0.75,
    bottom: 0.75,
    header: 0.3,
    footer: 0.3,
  }

  // Configurações de impressão: Landscape A4, fitToWidth: 1, fitToHeight: 0
  worksheet['!pageSetup'] = {
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToWidth: 1,
    fitToHeight: 0,
  }
  // Repete linha 4 (cabeçalho) em cada página na impressão
  worksheet['!printHeader'] = [4, 4]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Colaboradores')

  workbook.Props = {
    Title: 'Relatório Geral de Colaboradores',
    Subject: 'Cadastro completo de colaboradores operacionais',
    Author: 'Gestão de Escalas BP',
    CreatedDate: new Date(),
  }

  const filename = customFilename || `relatorio-geral-colaboradores-${dateStr}.xlsx`
  XLSX.writeFile(workbook, filename)
  return filename
}

/**
 * Exporta para arquivo PDF em formato A4 Landscape com jsPDF + autotable
 * Atende aos requisitos:
 * - A4 Landscape
 * - Logotipo institucional BPSCS (proporção idêntica aos relatórios existentes)
 * - Título, data/hora de geração e total de colaboradores
 * - Tabela horizontal legível e quebra de linha adequada (sem cortes)
 * - Cabeçalho repetido em cada página (showHead: 'everyPage')
 * - Rodapé "Página X de Y" com alinhamento correto
 * - Valores nulos/vazios formatados como "-"
 */
export function exportCollaboratorsToPdf(
  rows: CollaboratorReportRow[],
  customFilename?: string,
): string {
  const { dateStr, timestampStr } = getFormattedDateStamp()
  const total = rows.length

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  doc.setProperties({
    title: 'Relatório Geral de Colaboradores',
    subject: 'Cadastro de Colaboradores - Gestão de Escalas',
    author: 'Gestão de Escalas BP',
  })

  const tableHead = [[...COLLABORATOR_REPORT_COLUMNS]]

  const tableBody = rows.map((r) => mapCollaboratorRowToValues(r))

  autoTable(doc, {
    startY: 28,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 5.5,
      cellPadding: 1,
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [226, 232, 240], // slate-200
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [6, 64, 43], // #06402B verde institucional BPSCS
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 5.5,
      cellPadding: 1.2,
      halign: 'center',
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: 'bold' }, // Nome do Colaborador
      1: { cellWidth: 22, halign: 'center' }, // Registro Profissional (COREN/CRM)
      2: { cellWidth: 24 }, // Função/Cargo
      3: { cellWidth: 22 }, // Setor Padrão
      4: { cellWidth: 24 }, // Regime/Turno
      5: { cellWidth: 20, halign: 'center' }, // Equipe de Plantão
      6: { cellWidth: 15, halign: 'center' }, // Início no Ciclo
      7: { cellWidth: 13, halign: 'center' }, // Status
      8: { cellWidth: 16, halign: 'center' }, // Férias (Status)
      9: { cellWidth: 22, halign: 'center' }, // Período de Férias
      10: { cellWidth: 13, halign: 'center' }, // Qtd. Regras
      11: { cellWidth: 30 }, // Regras Vinculadas
      12: { cellWidth: 15, halign: 'center' }, // Data de Cadastro
      13: { cellWidth: 15, halign: 'center' }, // Última Atualização
    },
    margin: { top: 28, right: 10, bottom: 12, left: 10 },
    showHead: 'everyPage',
    didDrawPage: () => {
      // Logotipo no cabeçalho superior direito (proporção 4:3 ~ 24x18mm, padrão v0.0.282)
      try {
        if (typeof (doc as any).addImage === 'function') {
          doc.addImage(BPSCS_LOGO_BASE64, 'JPEG', 263, 6, 24, 18)
        }
      } catch (imgErr) {
        console.warn('Falha ao renderizar logo no PDF do Relatório:', imgErr)
      }

      // Título e metadados no topo de cada página
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(6, 64, 43) // Verde institucional BP
      doc.text('Relatório Geral de Colaboradores', 10, 12)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(71, 85, 105) // Slate 600
      doc.text(
        `Gerado em: ${timestampStr}   |   Total de Colaboradores: ${total}   |   Hospital Beneficência Portuguesa SCS`,
        10,
        18,
      )

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(100, 116, 139)
      doc.text('Base operacional de colaboradores vinculada à Gestão de Escalas', 10, 23)
    },
  })

  // Rodapé "Página X de Y" em todas as páginas
  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Página ${page} de ${pageCount} | BP Escalas`,
      doc.internal.pageSize.getWidth() - 10,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'right' },
    )
  }

  const filename = customFilename || `relatorio-geral-colaboradores-${dateStr}.pdf`
  doc.save(filename)
  return filename
}
