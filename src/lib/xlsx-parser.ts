interface ParsedSheet {
  name: string
  rows: string[][]
}

async function decompressDeflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw')
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(data)
      controller.close()
    },
  }).pipeThrough(ds)
  const result = await new Response(stream).arrayBuffer()
  return new Uint8Array(result)
}

async function parseZip(data: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>()
  const view = new DataView(data)
  const bytes = new Uint8Array(data)
  let offset = 0

  while (offset < data.byteLength - 4) {
    const signature = view.getUint32(offset, true)
    if (signature !== 0x04034b50) break

    const compressionMethod = view.getUint16(offset + 8, true)
    const compressedSize = view.getUint32(offset + 18, true)
    const filenameLength = view.getUint16(offset + 26, true)
    const extraFieldLength = view.getUint16(offset + 28, true)

    const filenameStart = offset + 30
    const filename = new TextDecoder().decode(
      bytes.slice(filenameStart, filenameStart + filenameLength),
    )

    const dataStart = filenameStart + filenameLength + extraFieldLength
    const compressedData = bytes.slice(dataStart, dataStart + compressedSize)

    let fileData: Uint8Array
    if (compressionMethod === 0) {
      fileData = compressedData
    } else if (compressionMethod === 8) {
      fileData = await decompressDeflateRaw(compressedData)
    } else {
      offset = dataStart + compressedSize
      continue
    }

    if (!filename.endsWith('/')) {
      files.set(filename, fileData)
    }
    offset = dataStart + compressedSize
  }

  if (files.size === 0) {
    throw new Error('Arquivo não é um XLSX válido (formato ZIP não reconhecido)')
  }
  return files
}

function parseXML(text: string): Document {
  return new DOMParser().parseFromString(text, 'text/xml')
}

function decodeFile(file: Uint8Array): string {
  return new TextDecoder().decode(file)
}

function getSharedStrings(files: Map<string, Uint8Array>): string[] {
  const file = files.get('xl/sharedStrings.xml')
  if (!file) return []
  const doc = parseXML(decodeFile(file))
  const sis = doc.getElementsByTagName('si')
  const strings: string[] = []
  for (let i = 0; i < sis.length; i++) {
    const texts = sis[i].getElementsByTagName('t')
    let value = ''
    for (let j = 0; j < texts.length; j++) {
      value += texts[j].textContent || ''
    }
    strings.push(value)
  }
  return strings
}

function colLetterToIndex(letters: string): number {
  let result = 0
  for (let i = 0; i < letters.length; i++) {
    result = result * 26 + (letters.charCodeAt(i) - 64)
  }
  return result - 1
}

function parseCellRef(ref: string): { col: number; row: number } {
  const match = ref.match(/([A-Z]+)(\d+)/)
  if (!match) return { col: 0, row: 0 }
  return { col: colLetterToIndex(match[1]), row: parseInt(match[2], 10) - 1 }
}

function parseSheet(file: Uint8Array, sharedStrings: string[]): string[][] {
  const doc = parseXML(decodeFile(file))
  const rows: string[][] = []
  const sheetData = doc.getElementsByTagName('sheetData')[0]
  if (!sheetData) return rows

  const rowElements = sheetData.getElementsByTagName('row')
  for (let i = 0; i < rowElements.length; i++) {
    const rowEl = rowElements[i]
    const rowIdx = parseInt(rowEl.getAttribute('r') || '0', 10) - 1
    if (isNaN(rowIdx)) continue
    while (rows.length <= rowIdx) rows.push([])

    const cells = rowEl.getElementsByTagName('c')
    for (let j = 0; j < cells.length; j++) {
      const cell = cells[j]
      const { col } = parseCellRef(cell.getAttribute('r') || '')
      const type = cell.getAttribute('t') || ''
      const vEl = cell.getElementsByTagName('v')[0]
      const isEl = cell.getElementsByTagName('is')[0]

      let value = ''
      if (type === 's' && vEl) {
        value = sharedStrings[parseInt(vEl.textContent || '0', 10)] || ''
      } else if (type === 'inlineStr' && isEl) {
        const tEls = isEl.getElementsByTagName('t')
        for (let k = 0; k < tEls.length; k++) value += tEls[k].textContent || ''
      } else if (vEl) {
        value = vEl.textContent || ''
      }
      while (rows[rowIdx].length <= col) rows[rowIdx].push('')
      rows[rowIdx][col] = value
    }
  }
  return rows
}

function getSheetFiles(files: Map<string, Uint8Array>): { name: string; file: Uint8Array }[] {
  const workbookFile = files.get('xl/workbook.xml')
  if (!workbookFile) return []
  const doc = parseXML(decodeFile(workbookFile))
  const sheets = doc.getElementsByTagName('sheet')

  const relsFile = files.get('xl/_rels/workbook.xml.rels')
  const relsMap = new Map<string, string>()
  if (relsFile) {
    const relsDoc = parseXML(decodeFile(relsFile))
    const relationships = relsDoc.getElementsByTagName('Relationship')
    for (let i = 0; i < relationships.length; i++) {
      relsMap.set(
        relationships[i].getAttribute('Id') || '',
        relationships[i].getAttribute('Target') || '',
      )
    }
  }

  const result: { name: string; file: Uint8Array }[] = []
  for (let i = 0; i < sheets.length; i++) {
    const name = sheets[i].getAttribute('name') || ''
    const rId = sheets[i].getAttribute('r:id') || ''
    let target = relsMap.get(rId) || ''
    if (!target) continue
    const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target
    const file = files.get(path)
    if (file) result.push({ name, file })
  }
  return result
}

export async function parseXlsx(file: File): Promise<ParsedSheet[]> {
  const buffer = await file.arrayBuffer()
  const files = await parseZip(buffer)
  const sharedStrings = getSharedStrings(files)
  return getSheetFiles(files).map(({ name, file: f }) => ({
    name,
    rows: parseSheet(f, sharedStrings),
  }))
}

export type { ParsedSheet }
