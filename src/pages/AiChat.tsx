import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { ToolUsageChart } from '@/components/ToolUsageChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Bot, User, Activity } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

export default function AiChat() {
  const { id } = useParams()
  const { user } = useAuth()
  const [tool, setTool] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    pb.collection('ia_tools').getOne(id).then(setTool).catch(console.error)

    const fetchLogs = async () => {
      const fiveDaysAgo = new Date()
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
      try {
        const res = await pb.collection('audit_logs').getList(1, 500, {
          filter: `created >= "${fiveDaysAgo.toISOString()}" && (details ~ "${id}" || action = "${id}")`,
          sort: '-created',
        })
        setLogs(res.items)
      } catch (e) {
        console.error(e)
      }
    }
    fetchLogs()
  }, [id])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const handleSend = async () => {
    if (!input.trim() || !tool) return
    const userMsg = input.trim()
    setMessages((p) => [...p, { role: 'user', content: userMsg }])
    setInput('')
    setLoading(true)

    try {
      await pb.collection('audit_logs').create({
        user: user?.id,
        action: tool.id,
        department: 'IA Chat',
        details: `Uso da ferramenta ${tool.name}`,
        token_usage: Math.floor(Math.random() * 50) + 10,
      })

      setTimeout(() => {
        setMessages((p) => [
          ...p,
          {
            role: 'assistant',
            content: `Esta é uma resposta simulada da ferramenta ${tool.name}. A integração real usaria o gateway Skip AI.`,
          },
        ])
        setLoading(false)
      }, 1000)
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }

  if (!tool)
    return (
      <div className="p-8 flex items-center justify-center text-muted-foreground">
        Carregando ferramenta...
      </div>
    )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
      <Card className="lg:col-span-2 flex flex-col h-full overflow-hidden">
        <CardHeader className="border-b bg-slate-50/50 py-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            {tool.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden relative">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-6 pb-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-12 flex flex-col items-center gap-4">
                  <Bot className="h-12 w-12 text-primary/20" />
                  <p>
                    Envie uma mensagem para começar a usar o <strong>{tool.name}</strong>.
                  </p>
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground'}`}
                    >
                      {m.role === 'user' ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div
                      className={`p-4 rounded-xl shadow-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm'}`}
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex gap-3 max-w-[85%]">
                    <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="p-4 rounded-xl rounded-tl-sm bg-muted flex items-center gap-2 shadow-sm">
                      <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" />
                      <div
                        className="w-2 h-2 rounded-full bg-primary/40 animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      />
                      <div
                        className="w-2 h-2 rounded-full bg-primary/40 animate-bounce"
                        style={{ animationDelay: '0.4s' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="p-4 border-t bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="flex gap-2 relative"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="flex-1 pr-12 rounded-lg bg-slate-50 focus-visible:bg-white transition-colors border-slate-200"
              />
              <Button
                type="submit"
                size="icon"
                disabled={loading || !input.trim()}
                className="absolute right-1 top-1 h-8 w-8 rounded-md transition-transform hover:scale-105"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6 flex flex-col h-full overflow-y-auto pr-2 custom-scrollbar">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Estatísticas (5 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] pb-6">
            <ToolUsageChart tool={tool} logs={logs} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-lg">Sobre a Ferramenta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {tool.description || 'Nenhuma descrição fornecida para esta ferramenta de IA.'}
            </p>
            <div className="mt-6 flex flex-col gap-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-muted-foreground">Modelo Base</span>
                <span className="font-semibold px-2 py-1 bg-secondary rounded-md text-secondary-foreground text-xs">
                  {tool.model_alias || 'fast'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-muted-foreground">Status</span>
                <span className="font-semibold px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs capitalize">
                  {tool.status}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Versão</span>
                <span className="font-semibold">{tool.version || '1.0'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
