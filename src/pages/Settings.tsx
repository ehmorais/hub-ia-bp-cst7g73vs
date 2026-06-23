import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Github,
  Settings as SettingsIcon,
  Link as LinkIcon,
  ShieldCheck,
  Server,
  Bot,
  SlidersHorizontal,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

function StatusLed({
  status,
  label,
  tooltip,
}: {
  status: 'green' | 'red' | 'gray' | 'loading'
  label: string
  tooltip: string
}) {
  const isGreen = status === 'green'
  const isRed = status === 'red'
  const isGray = status === 'gray'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 w-full sm:w-auto">
          <div className="relative flex h-3 w-3 shrink-0">
            {isGreen && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 duration-1000"></span>
            )}
            <span
              className={cn(
                'relative inline-flex rounded-full h-3 w-3',
                isGreen
                  ? 'bg-green-500'
                  : isRed
                    ? 'bg-red-500'
                    : isGray
                      ? 'bg-slate-400'
                      : 'bg-blue-400 animate-pulse',
              )}
            ></span>
          </div>
          <span className="text-sm font-semibold text-slate-700">{label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export default function Settings() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [dbStatus, setDbStatus] = useState<'loading' | 'connected' | 'error'>('loading')
  const [githubStatus, setGithubStatus] = useState<'disconnected' | 'loading' | 'connected'>(
    'disconnected',
  )
  const [aiPriority, setAiPriority] = useState(
    localStorage.getItem('escala_ai_priority') === 'staffing' ? 'staffing' : 'timeoff',
  )
  const [aiStrictness, setAiStrictness] = useState([
    parseInt(localStorage.getItem('escala_ai_strictness') || '50', 10),
  ])

  const handleSaveAiSettings = () => {
    localStorage.setItem('escala_ai_priority', aiPriority)
    localStorage.setItem('escala_ai_strictness', aiStrictness[0].toString())
    toast({
      title: 'Configurações de IA Salvas',
      description: 'As preferências de geração de escalas foram atualizadas.',
    })
  }

  useEffect(() => {
    async function checkDb() {
      try {
        await pb.collection('users').getList(1, 1)
        setDbStatus('connected')
      } catch (e) {
        setDbStatus('error')
      }
    }
    checkDb()
  }, [])

  const handleConnectGithub = () => {
    setGithubStatus('loading')
    // Mock integration flow
    setTimeout(() => {
      setGithubStatus('connected')
      toast({
        title: 'Integração Concluída',
        description: 'Repositório GitHub conectado e sincronizado com sucesso.',
      })
    }, 1500)
  }

  if (user?.role !== 'Admin') {
    return (
      <div className="p-8 text-center text-red-500">Acesso negado. Apenas administradores.</div>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-[1400px] animate-fade-in">
      <div className="flex flex-col gap-2 mb-2">
        <h1 className="text-4xl font-bold tracking-tight text-[#06402B] flex items-center gap-3 font-heading">
          <SettingsIcon className="h-9 w-9 text-[#06402B]" />
          Configurações
        </h1>
        <p className="text-muted-foreground text-lg max-w-3xl font-sans">
          Gerencie configurações globais e integrações externas da plataforma.
        </p>
      </div>

      <Tabs defaultValue="integrations" className="w-full">
        <TabsList className="flex flex-wrap w-full justify-start max-w-6xl mb-8 h-auto p-1.5 gap-1 bg-white/60 backdrop-blur-md border border-slate-200/60 shadow-sm rounded-lg font-interactive">
          <TabsTrigger
            value="general"
            className="rounded-md px-4 py-2 data-[state=active]:bg-[#06402B] data-[state=active]:text-white data-[state=active]:shadow-md transition-all hover:bg-slate-100"
          >
            Geral
          </TabsTrigger>
          <TabsTrigger
            value="integrations"
            className="rounded-md px-4 py-2 data-[state=active]:bg-[#06402B] data-[state=active]:text-white data-[state=active]:shadow-md transition-all hover:bg-slate-100"
          >
            Integrações
          </TabsTrigger>
          <TabsTrigger
            value="ai"
            className="rounded-md px-4 py-2 data-[state=active]:bg-[#06402B] data-[state=active]:text-white data-[state=active]:shadow-md transition-all hover:bg-slate-100"
          >
            IA & Escalas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card className="shadow-soft border-slate-200/60 rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5 text-[#06402B]" />
                Status da Infraestrutura
              </CardTitle>
              <CardDescription>
                Monitoramento em tempo real dos serviços conectados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <StatusLed
                  status={
                    dbStatus === 'connected' ? 'green' : dbStatus === 'error' ? 'red' : 'loading'
                  }
                  label="Conexão com Banco de Dados"
                  tooltip={
                    dbStatus === 'connected'
                      ? 'Banco de dados operacional'
                      : dbStatus === 'error'
                        ? 'Falha na conexão com o banco de dados'
                        : 'Verificando conexão...'
                  }
                />
                <StatusLed
                  status={
                    githubStatus === 'connected'
                      ? 'green'
                      : githubStatus === 'disconnected'
                        ? 'gray'
                        : 'loading'
                  }
                  label="Conexão com GitHub"
                  tooltip={
                    githubStatus === 'connected'
                      ? 'GitHub sincronizado'
                      : githubStatus === 'disconnected'
                        ? 'GitHub não configurado'
                        : 'Conectando...'
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <Card className="shadow-soft border-slate-200/60 rounded-lg border-t-[6px] border-t-[#06402B] overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-3 bg-[#06402B]/10 rounded-xl">
                    <Github className="h-6 w-6 text-[#06402B]" />
                  </div>
                  <div className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full flex items-center gap-1.5">
                    <div
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        githubStatus === 'connected' ? 'bg-green-500' : 'bg-slate-400',
                      )}
                    />
                    {githubStatus === 'connected'
                      ? 'Conectado'
                      : githubStatus === 'loading'
                        ? 'Conectando...'
                        : 'Não Configurado'}
                  </div>
                </div>
                <CardTitle className="text-xl text-slate-800">Integração com GitHub</CardTitle>
                <CardDescription className="text-slate-500 mt-2 leading-relaxed">
                  Sincronize seu código automaticamente com um repositório para garantir
                  versionamento profissional e backup seguro.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col gap-4">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                      <ShieldCheck className="w-4 h-4 text-[#06402B]" /> Vantagens
                    </h4>
                    <ul className="text-xs text-slate-600 space-y-1.5 ml-1">
                      <li className="flex items-start gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-[#06402B] mt-1.5 shrink-0" />
                        Histórico completo de alterações (Commits)
                      </li>
                      <li className="flex items-start gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-[#06402B] mt-1.5 shrink-0" />
                        Revisão e homologação de código
                      </li>
                      <li className="flex items-start gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-[#06402B] mt-1.5 shrink-0" />
                        Backup seguro fora da plataforma
                      </li>
                    </ul>
                  </div>
                  <Button
                    className="w-full bg-[#06402B] hover:bg-[#06402B]/90 text-white font-medium shadow-sm transition-all"
                    size="lg"
                    onClick={handleConnectGithub}
                    disabled={githubStatus === 'loading' || githubStatus === 'connected'}
                  >
                    <LinkIcon className="w-4 h-4 mr-2" />
                    {githubStatus === 'connected'
                      ? 'Repositório Conectado'
                      : githubStatus === 'loading'
                        ? 'Conectando...'
                        : 'Conectar Repositório'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <Card className="shadow-soft border-slate-200/60 rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-[#06402B]" />
                Preferências Globais da IA
              </CardTitle>
              <CardDescription>
                Configure como a IA deve se comportar ao gerar rascunhos de escalas e resolver
                conflitos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="flex flex-col gap-4 max-w-xl">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold text-slate-800">
                      Prioridade de Resolução
                    </Label>
                    <div className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                      {aiPriority === 'timeoff' ? 'Respeitar Folgas' : 'Garantir Efetivo'}
                    </div>
                  </div>
                  <p className="text-sm text-slate-500">
                    Define se a IA deve priorizar as solicitações de folga aprovadas ou preencher o
                    quadro mínimo de funcionários do setor.
                  </p>
                  <div className="flex items-center space-x-4 pt-2">
                    <span className="text-sm font-medium text-slate-700">Folgas</span>
                    <Switch
                      checked={aiPriority === 'staffing'}
                      onCheckedChange={(c) => setAiPriority(c ? 'staffing' : 'timeoff')}
                    />
                    <span className="text-sm font-medium text-slate-700">Efetivo</span>
                  </div>
                </div>

                <div className="w-full h-px bg-slate-100 my-2" />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold text-slate-800 flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4" />
                      Rigor nas Regras (Strictness)
                    </Label>
                    <span className="font-mono text-sm font-bold text-[#06402B]">
                      {aiStrictness[0]}%
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    Determina o quão rigorosa a IA será com regras secundárias (ex: mix de
                    profissionais, preferências de turno) antes de sugerir "quebras" para revisão
                    manual.
                  </p>
                  <div className="pt-4">
                    <Slider
                      value={aiStrictness}
                      onValueChange={setAiStrictness}
                      max={100}
                      step={10}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-2">
                      <span>Flexível (Sugere opções)</span>
                      <span>Estrito (Falha ao invés de quebrar regra)</span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleSaveAiSettings}
                  className="mt-4 w-fit bg-[#06402B] hover:bg-[#06402B]/90"
                >
                  Salvar Preferências da IA
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
