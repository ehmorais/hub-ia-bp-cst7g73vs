import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Copy,
  RefreshCcw,
  AlertTriangle,
  Send,
  Sparkles,
  User,
  BrainCircuit,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import pb from '@/lib/pocketbase/client'
import { parseChatStream, type DisplayMessage } from '@/lib/skipAi'
import { Skeleton } from '@/components/ui/skeleton'

export default function AiChat() {
  const { id } = useParams()
  const [tool, setTool] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    pb.collection('ia_tools')
      .getOne(id)
      .then((t) => {
        setTool(t)
        setMessages([
          {
            id: '1',
            role: 'assistant',
            content: `Olá! Sou o **${t.name}**. Como posso ajudar com suas análises hoje? Forneça os dados ou o contexto para iniciarmos.`,
            created: new Date().toISOString(),
          },
        ])
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [id])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isTyping) return

    const userText = input.trim()
    const userMsg: DisplayMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      created: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    const controller = new AbortController()
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/ai-chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: pb.authStore.token },
        body: JSON.stringify({ message: userText, tool_id: id, history }),
        signal: controller.signal,
      })

      let assistantId = Date.now().toString() + '-ai'
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', created: new Date().toISOString() },
      ])

      if (res.ok) {
        let fullContent = ''
        for await (const chunk of parseChatStream(res, controller.signal)) {
          const text = chunk.choices[0]?.delta?.content || ''
          fullContent += text
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m)),
          )
        }
      } else {
        throw new Error('Falha ao obter resposta')
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem-4rem)] bg-slate-50/50">
      {/* Top Bar */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          {loading ? (
            <Skeleton className="h-6 w-48" />
          ) : tool ? (
            <div>
              <h2 className="font-semibold text-sm flex items-center gap-2">
                {tool.name}
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal py-0 px-1 border-primary/20 text-primary bg-primary/5"
                >
                  {tool.model_alias || 'agent'}
                </Badge>
              </h2>
            </div>
          ) : null}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8 text-slate-600"
          onClick={() => {
            if (tool) {
              setMessages([
                {
                  id: '1',
                  role: 'assistant',
                  content: `Olá! Sou o **${tool.name}**. Como posso ajudar com suas análises hoje? Forneça os dados ou o contexto para iniciarmos.`,
                  created: new Date().toISOString(),
                },
              ])
            } else {
              setMessages([])
            }
          }}
        >
          Novo Chamado
        </Button>
      </div>
      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:px-24">
        <div className="max-w-4xl mx-auto space-y-6 pb-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex gap-4 animate-fade-in-up',
                msg.role === 'user' ? 'flex-row-reverse' : '',
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-1',
                  msg.role === 'user'
                    ? 'bg-slate-200 text-slate-600'
                    : 'bg-primary text-primary-foreground',
                )}
              >
                {msg.role === 'user' ? (
                  <User className="h-5 w-5" />
                ) : (
                  <BrainCircuit className="h-5 w-5" />
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={cn(
                  'flex flex-col gap-2 max-w-[85%]',
                  msg.role === 'user' ? 'items-end' : 'items-start',
                )}
              >
                <div
                  className={cn(
                    'px-4 py-3 rounded-2xl text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-white border shadow-sm rounded-tl-sm text-slate-800',
                  )}
                >
                  {/* Simplistic markdown rendering simulation */}
                  <div className="whitespace-pre-wrap font-medium">
                    {msg.content
                      .split('**')
                      .map((part, i) => (i % 2 !== 0 ? <strong key={i}>{part}</strong> : part))}
                  </div>
                </div>

                {/* AI Actions */}
                {msg.role === 'assistant' && msg.id !== '1' && (
                  <div className="flex items-center gap-2 pl-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-slate-600"
                      title="Copiar Resposta"
                      onClick={() => navigator.clipboard.writeText(msg.content)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-slate-600"
                      title="Regerar"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-red-600"
                      title="Reportar Erro"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-4 animate-fade-in">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 animate-pulse" />
              </div>
              <div className="bg-white border shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                <span
                  className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                ></span>
                <span
                  className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                ></span>
                <span
                  className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                ></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      {/* Input Area */}
      <div className="bg-white border-t p-4 shrink-0">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSend} className="relative flex items-end gap-2">
            <Card className="flex-1 border-slate-200 shadow-sm focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all overflow-hidden p-1">
              <textarea
                className="w-full min-h-[60px] max-h-[200px] resize-none bg-transparent border-0 p-3 text-sm focus:outline-none focus:ring-0 text-slate-900 placeholder:text-slate-400"
                placeholder="Descreva sua solicitação ou faça uma pergunta..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend(e)
                  }
                }}
              />
            </Card>
            <Button
              type="submit"
              size="icon"
              className={cn(
                'h-[68px] w-[68px] rounded-xl shrink-0 transition-all',
                input.trim() && !isTyping
                  ? 'bg-primary hover:bg-primary/90'
                  : 'bg-slate-200 text-slate-400 pointer-events-none',
              )}
            >
              <Send className="h-6 w-6" />
            </Button>
          </form>
          <p className="text-center text-[11px] text-slate-400 mt-3 font-medium">
            A IA pode cometer erros. Considere verificar informações importantes.
          </p>
        </div>
      </div>
    </div>
  )
}
