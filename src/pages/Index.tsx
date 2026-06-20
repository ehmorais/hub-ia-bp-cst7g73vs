import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { BrainCircuit, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function Index() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Background Image */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage:
            'url("https://img.usecurling.com/p/1920/1080?q=modern%20hospital%20interior&color=green")',
        }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
      </div>

      <Card className="z-10 w-full max-w-md shadow-elevation border-0 bg-white/95 backdrop-blur-md">
        <CardHeader className="space-y-3 text-center pb-8 pt-8">
          <div className="mx-auto flex items-center justify-center mb-6 bg-primary text-primary-foreground p-5 rounded-2xl w-fit shadow-md">
            <BrainCircuit className="h-16 w-16" />
          </div>
          <CardTitle className="text-3xl font-bold text-slate-800">Hub IA BP</CardTitle>
          <CardDescription className="text-base font-medium text-slate-600">
            Portal Corporativo de Inteligência Artificial
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <Button
            className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => navigate('/login')}
          >
            Acessar o Sistema
          </Button>

          <div className="mt-6 flex items-center gap-2 text-sm text-slate-500 justify-center">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            <span>Acesso seguro e auditado.</span>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-slate-100 pt-6 pb-6 text-xs text-slate-400 gap-4">
          <a href="#" className="hover:text-primary transition-colors">
            Política de Privacidade
          </a>
          <span>•</span>
          <a href="#" className="hover:text-primary transition-colors">
            Termos de Uso (LGPD)
          </a>
        </CardFooter>
      </Card>
    </div>
  )
}
