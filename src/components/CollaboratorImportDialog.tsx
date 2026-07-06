import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react'
import { importCollaborators } from '@/services/escala'
import { useToast } from '@/components/ui/use-toast'

export function CollaboratorImportDialog() {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const res = await importCollaborators(file)
      setResult(res)
      toast({
        title: 'Importação concluída',
        description: `${res.profilesCreated} perfil(is) criado(s), ${res.profilesUpdated} atualizado(s).`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro na importação',
        description: err?.message || 'Falha ao importar arquivo.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
    setResult(null)
  }

  const handleClose = () => {
    setOpen(false)
    setFile(null)
    setResult(null)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Importar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Importar Colaboradores</DialogTitle>
          <DialogDescription>
            Selecione um arquivo Excel (.xlsx) com os dados dos colaboradores. O sistema extrairá
            nome, COREN e função de cada planilha automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="cursor-pointer"
            />
            {file && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                <span className="font-medium">{file.name}</span>
                <span className="text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>

          {result && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Resumo da Importação
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                <div>
                  Perfis criados:{' '}
                  <strong className="text-slate-900">{result.profilesCreated}</strong>
                </div>
                <div>
                  Perfis atualizados:{' '}
                  <strong className="text-slate-900">{result.profilesUpdated}</strong>
                </div>
                <div>
                  Perfis ignorados:{' '}
                  <strong className="text-slate-900">{result.profilesSkipped}</strong>
                </div>
                <div>
                  Funções criadas: <strong className="text-slate-900">{result.rolesCreated}</strong>
                </div>
              </div>

              {result.sheets?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
                    Planilhas processadas:
                  </div>
                  {result.sheets.map((s: any, i: number) => (
                    <div key={i} className="text-xs text-slate-600">
                      • {s.name}: {s.rowsProcessed} registro(s)
                      {s.sectorMatched && (
                        <span className="text-slate-400"> → setor: {s.sectorMatched}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {result.errors?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-red-500 uppercase mb-1">
                    Avisos / Erros:
                  </div>
                  {result.errors.slice(0, 5).map((err: string, i: number) => (
                    <div key={i} className="text-xs text-red-500 flex items-start gap-1">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      {err}
                    </div>
                  ))}
                  {result.errors.length > 5 && (
                    <div className="text-xs text-slate-400">
                      ... e mais {result.errors.length - 5} aviso(s)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Fechar
          </Button>
          <Button onClick={handleImport} disabled={!file || loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Importar Dados
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
