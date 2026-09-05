import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { ToolUsageChart } from '@/components/ToolUsageChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Bot, User, Activity } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { streamAgentChat } from '@/lib/skipAi'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

export default function AiChat() {
  const { id } = useParams()
  const { user } = useAuth()
  const [tool, setTool] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

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
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading])

  useEffect(() => () => abortRef.current?.abort(), [])

  const handleSend = async () => {
    const userMsg = input.trim()
    if (!userMsg || !tool || loading) return

    setMessages((previous) => [
      ...previous,
      { role: 'user', content: userMsg },
      { role: 'assistant', content: '' },
    ])
    setInput('')
    setError(null)
    setLoading(true)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch(
        `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/escala-expert/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: pb.authStore.token,
          },
          body: JSON.stringify({ message: userMsg, conversation_id: conversationId }),
          signal: controller.signal,
        },
      )

      const result = await streamAgentChat(response, {
        signal: controller.signal,
        onChunk: (_delta, accumulated) => {
          setMessages((previous) => {
            const next = [...previous]
            next[next.length - 1] = { role: 'assistant', content: accumulated }
            return next
          })
        },
      })

      setConversationId(response.headers.get('X-Conversation-Id') || result.conversation_id)
      setMessages((previous) => {
        const next = [...previous]
        next[next.length - 1] = { role: 'assistant', content: result.content }
        return next
      })
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError(err?.message || 'Não foi possível consultar o agente.')
        setMessages((previous) => previous.slice(0, -1))
      }
    } finally {
      abortRef.current = null
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
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`flex gap-3 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${message.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground'}`}
                    >
                      {message.role === 'user' ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div
                      className={`p-4 rounded-xl shadow-sm whitespace-pre-wrap ${message.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm'}`}
                    >
                      {message.content || (loading ? 'Consultando o Escala Expert...' : '')}
                    </div>
                  </div>
                </div>
              ))}
              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
              )}
            </div>
          </ScrollArea>
          <div className="p-4 border-t bg-white">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                handleSend()
              }}
              className="flex gap-2 relative"
            >
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Pergunte sobre escalas, setores, folgas ou regras..."
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
