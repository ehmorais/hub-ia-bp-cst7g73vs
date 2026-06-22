import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Login() {
  const [email, setEmail] = useState('eduardo.morais@idcorp.com.br')
  const [password, setPassword] = useState('Skip@Pass')
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)

  const from = location.state?.from?.pathname || '/'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setFieldErrors({})

    let hasError = false
    const newFieldErrors: { email?: string; password?: string } = {}

    if (!email) {
      newFieldErrors.email = 'O e-mail é obrigatório.'
      hasError = true
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newFieldErrors.email = 'Formato de e-mail inválido.'
      hasError = true
    }

    if (!password) {
      newFieldErrors.password = 'A senha é obrigatória.'
      hasError = true
    }

    if (hasError) {
      setFieldErrors(newFieldErrors)
      setLoading(false)
      return
    }

    const res = await signIn(email, password)
    if (res.error) {
      setError('E-mail ou senha inválidos. Verifique suas credenciais e tente novamente.')
      setLoading(false)
    } else {
      navigate('/all-systems-go', { state: { from }, replace: true })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <Card className="w-full max-w-sm shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] border border-gray-100 rounded-xl">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-6">
            <img
              src="https://storage.googleapis.com/wombo-assets/images/61a7a0b3-f667-4bd9-8fde-4863bf46cd8a/image.jpeg"
              alt="Hospital Beneficência Portuguesa de São Caetano do Sul"
              className="w-full max-w-[240px] h-auto object-contain mix-blend-multiply"
            />
          </div>
          <CardTitle className="text-3xl font-bold text-emerald-700 tracking-tight">
            HUB IA BPSCS
          </CardTitle>
          <CardDescription className="text-sm mt-2 text-gray-500">
            Entre com suas credenciais institucionais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5" noValidate>
            {error && (
              <div className="text-sm text-red-600 text-center font-medium bg-red-50/50 border border-red-100 p-3 rounded-lg">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">E-mail</label>
              <Input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined })
                }}
                type="email"
                placeholder="nome@exemplo.com.br"
                className={`transition-colors ${
                  fieldErrors.email
                    ? 'border-red-500 focus-visible:ring-red-500'
                    : 'border-gray-200 focus-visible:ring-emerald-500 focus-visible:border-emerald-500'
                }`}
              />
              {fieldErrors.email && (
                <p className="text-xs text-red-500 animate-in fade-in">{fieldErrors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Senha</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined })
                }}
                placeholder="••••••••"
                className={`transition-colors ${
                  fieldErrors.password
                    ? 'border-red-500 focus-visible:ring-red-500'
                    : 'border-gray-200 focus-visible:ring-emerald-500 focus-visible:border-emerald-500'
                }`}
              />
              {fieldErrors.password && (
                <p className="text-xs text-red-500 animate-in fade-in">{fieldErrors.password}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium h-11 transition-all shadow-sm rounded-lg"
              disabled={loading}
            >
              {loading ? 'Autenticando...' : 'Acessar Plataforma'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
