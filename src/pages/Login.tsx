import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Login() {
  const [email, setEmail] = useState('eduardo.morais@idcorp.com.br')
  const [password, setPassword] = useState('Skip@Pass')
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn(email, password)
    if (res.error) {
      setError('Credenciais inválidas. Verifique seu e-mail e senha e tente novamente.')
      setLoading(false)
    } else {
      navigate('/system-check')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm shadow-lg border-primary/20">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-3xl font-bold text-primary tracking-tight">
            HUB IA BPSCS
          </CardTitle>
          <CardDescription className="text-sm mt-2">
            Entre com suas credenciais institucionais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <p className="text-sm text-red-500 text-center font-medium bg-red-50 p-2 rounded">
                {error}
              </p>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">E-mail</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
                placeholder="nome@exemplo.com.br"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Senha</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
