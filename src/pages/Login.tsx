import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Loader2, XCircle, BrainCircuit } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { cn } from '@/lib/utils'

export default function Login() {
  const [email, setEmail] = useState('eduardo.morais@idcorp.com.br')
  const [password, setPassword] = useState('Skip@Pass')
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [checking, setChecking] = useState(false)
  const [checklistIndex, setChecklistIndex] = useState(-1)
  const [checklistError, setChecklistError] = useState('')

  const runChecklist = async () => {
    try {
      setChecklistIndex(0)
      await new Promise((r) => setTimeout(r, 600))
      await pb.collection('users').authRefresh()

      setChecklistIndex(1)
      await new Promise((r) => setTimeout(r, 600))
      await pb.health.check()

      setChecklistIndex(2)
      await new Promise((r) => setTimeout(r, 600))
      await Promise.all([
        pb.collection('departments').getList(1, 1),
        pb.collection('projects').getList(1, 1),
        pb.collection('ia_tools').getList(1, 1),
      ])

      setChecklistIndex(3)
      await new Promise((r) => setTimeout(r, 800))
      navigate('/dashboard')
    } catch (err: any) {
      setChecklistError(
        err?.message || 'Falha na validação do sistema. Serviços podem estar inoperantes.',
      )
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn(email, password)
    if (res.error) {
      setError('Credenciais inválidas.')
      setLoading(false)
    } else {
      setChecking(true)
      runChecklist()
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md border-slate-200/60 shadow-xl bg-white/80 backdrop-blur-sm animate-fade-in">
          <CardHeader className="text-center space-y-2 pb-6">
            <div className="mx-auto mb-6 flex justify-center w-full px-4">
              <div className="bg-primary text-primary-foreground p-3 rounded-xl shadow-sm">
                <BrainCircuit className="h-10 w-10" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
              Portal Corporativo
            </CardTitle>
            <CardDescription className="text-base">
              Verificando integridade dos módulos...
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {['Session Integrity', 'Database Connection', 'Administrative Modules Readiness'].map(
              (label, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 border rounded-lg bg-slate-50"
                >
                  {checklistIndex > idx ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : checklistIndex === idx && !checklistError ? (
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  ) : checklistIndex === idx && checklistError ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-slate-200" />
                  )}
                  <span
                    className={cn(
                      'text-sm font-medium',
                      checklistIndex >= idx ? 'text-slate-800' : 'text-slate-400',
                    )}
                  >
                    {label}
                  </span>
                </div>
              ),
            )}
            {checklistError && (
              <div className="mt-4 p-4 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 text-center font-medium animate-fade-in-up">
                {checklistError}
                <Button
                  variant="outline"
                  className="w-full mt-4 bg-white hover:bg-slate-50 text-slate-700"
                  onClick={() => {
                    setChecking(false)
                    setChecklistIndex(-1)
                    setChecklistError('')
                    setLoading(false)
                  }}
                >
                  Voltar e tentar novamente
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md border-slate-200/60 shadow-xl bg-white/80 backdrop-blur-sm animate-fade-in">
        <CardHeader className="text-center space-y-2 pb-6">
          <div className="mx-auto mb-6 flex justify-center w-full px-4">
            <div className="bg-primary text-primary-foreground p-3 rounded-xl shadow-sm">
              <BrainCircuit className="h-10 w-10" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            Acesso Restrito
          </CardTitle>
          <CardDescription className="text-base">
            Entre com suas credenciais institucionais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <p className="text-sm text-red-500 text-center font-medium bg-red-50 p-2 rounded">
                {error}
              </p>
            )}
            <div className="space-y-2 text-left">
              <label className="text-sm font-semibold text-slate-700">Usuário ou E-mail</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white h-11 border-slate-300 focus-visible:ring-primary"
                placeholder="nome.sobrenome@idcorp.com.br"
              />
            </div>
            <div className="space-y-2 text-left">
              <label className="text-sm font-semibold text-slate-700">Senha</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white h-11 border-slate-300 focus-visible:ring-primary"
                placeholder="••••••••"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 text-base shadow-sm font-semibold mt-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={loading}
            >
              {loading ? 'Autenticando...' : 'Entrar no Sistema'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
