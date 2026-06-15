import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { TOOLS } from '@/lib/mock-data'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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

type Message = {
  id: string
  role: 'user' | 'ai'
  content: string
}

export default function AiChat() {
  const { id } = useParams()
  const tool = TOOLS.find((t) => t.id === id) || TOOLS[0]

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'ai',
      content: `Olá! Sou o **${tool.name}**. Como posso ajudar com suas análises hoje? Forneça os dados ou o contexto clínico para iniciarmos.`,
    },
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    // Simulate AI response
    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: `Baseado nas informações fornecidas, observei os seguintes pontos:\n\n1. **Análise Primária**: Não há achados críticos evidentes no primeiro momento.\n2. **Recomendação**: Sugere-se correlação clínica e acompanhamento padrão.\n\n*Nota: Esta é uma simulação de resposta estruturada em Markdown.*`,
      }
      setMessages((prev) => [...prev, aiMsg])
      setIsTyping(false)
    }, 1500)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem-4rem)] bg-slate-50/50">
      {' '}
      {/* subtract header and footer approx */}
      {/* Top Bar */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link to={`/department/${tool.departmentId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="font-semibold text-sm flex items-center gap-2">
              {tool.name}
              <Badge
                variant="outline"
                className="text-[10px] font-normal py-0 px-1 border-primary/20 text-primary bg-primary/5"
              >
                {tool.model}
              </Badge>
            </h2>
          </div>
        </div>
        <Button variant="outline" size="sm" className="text-xs h-8 text-slate-600">
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
                {msg.role === 'ai' && msg.id !== '1' && (
                  <div className="flex items-center gap-2 pl-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-slate-600"
                      title="Copiar Resposta"
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
                placeholder="Descreva o caso clínico, cole o laudo ou faça sua pergunta. Não inclua dados sensíveis do paciente (Nome, CPF, etc)."
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
                input.trim()
                  ? 'bg-primary hover:bg-primary/90'
                  : 'bg-slate-200 text-slate-400 pointer-events-none',
              )}
            >
              <Send className="h-6 w-6" />
            </Button>
          </form>
          <p className="text-center text-[11px] text-slate-400 mt-3 font-medium">
            LLMs podem cometer erros. Verifique informações importantes com protocolos
            institucionais.
          </p>
        </div>
      </div>
    </div>
  )
}
