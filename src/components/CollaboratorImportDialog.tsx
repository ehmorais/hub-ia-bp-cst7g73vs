import { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import pb from '@/lib/pocketbase/client'
import { parseXlsx, type ParsedSheet } from '@/lib/xlsx-parser'

interface ImportSummary {
  sheets: { name: string; rowsProcessed: number; sectorMatched: string | null }[]
  rolesCreated: number
  profilesCreated: number
  profilesUpdated: number
  profilesSkipped: number
  errors: string[]
}

export function CollaboratorImportDialog({ onImported }: { onImported?: () => void }) {
  const [open, setOpen] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parsedSheets, setParsedSheets] = useState<ParsedSheet[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportSummary | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setParsedSheets([])
    setFileName('')
    setResult(null)
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleFile = async (file: File) => {
    setParsing(true)
    setError('')
    setResult(null)
    try {
      const sheets = await parseXlsx(file)
      setParsedSheets(sheets)
      setFileName(file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao processar o arquivo')
      setParsedSheets([])
    } finally {
      setParsing(false)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    setError('')
    try {
      const res = await pb.send('/backend/v1/escala/import', {
        method: 'POST',
        body: JSON.stringify({ sheets: parsedSheets }),
        headers: { 'Content-Type': 'application/json' },
      })
      setResult(res as ImportSummary)
      setParsedSheets([])
      onImported?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao importar dados')
    } finally {
      setImporting(false)
    }
  }

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) reset()
  }

  const totalRows = parsedSheets.reduce((acc, s) => acc + s.rows.length, 0)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Importar Colaboradores
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Importar Colaboradores
          </DialogTitle>
          <DialogDescription>
            Selecione um arquivo Excel (.xlsx) para importar colaboradores e funções.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Importação concluída!</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">{result.profilesCreated}</p>
                <p className="text-sm text-muted-foreground">Perfis criados</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">{result.profilesUpdated}</p>
                <p className="text-sm text-muted-foreground">Perfis atualizados</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">{result.rolesCreated}</p>
                <p className="text-sm text-muted-foreground">Funções criadas</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold">{result.profilesSkipped}</p>
                <p className="text-sm text-muted-foreground">Perfis ignorados</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <ScrollArea className="h-32 rounded-lg border p-3">
                <div className="space-y-1">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-sm text-red-600">
                      {err}
                    </p>
                  ))}
                </div>
              </ScrollArea>
            )}
            <Button onClick={() => handleOpenChange(false)} className="w-full">
              Concluir
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => inputRef.current?.click()}
            >
              {parsing ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground">
                {parsing ? 'Processando...' : fileName || 'Clique para selecionar um arquivo .xlsx'}
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
            </div>

            {parsedSheets.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {parsedSheets.length} planilha(s) encontrada(s) · {totalRows} linha(s)
                </p>
                <ScrollArea className="h-32 rounded-lg border p-2">
                  <div className="space-y-1">
                    {parsedSheets.map((s, i) => (
                      <div key={i} className="flex justify-between text-sm py-1">
                        <span className="truncate">{s.name}</span>
                        <span className="text-muted-foreground">{s.rows.length} linhas</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <Button
              onClick={handleImport}
              disabled={parsedSheets.length === 0 || importing}
              className="w-full"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                'Confirmar Importação'
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
