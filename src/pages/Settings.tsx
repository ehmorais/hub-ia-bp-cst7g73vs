import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Github, Settings as SettingsIcon, Link as LinkIcon, ShieldCheck } from 'lucide-react'

export default function Settings() {
  const { user } = useAuth()

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
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card className="shadow-soft border-slate-200/60 rounded-lg">
            <CardHeader>
              <CardTitle>Configurações Gerais</CardTitle>
              <CardDescription>Configurações do sistema e da plataforma Hub IA.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Nenhuma configuração disponível no momento.
              </p>
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
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    Não Configurado
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
                  >
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Conectar Repositório
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
