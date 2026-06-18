import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { BrainCircuit, Loader2 } from 'lucide-react'
import { useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { streamAgentChat } from '@/lib/skipAi'

export function AgentDialog() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [convId, setConvId] = useState<string | null>(null)

  const handleSend = async () => {
    if (!input) return
    const msg = input
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    try {
      const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/escala-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: pb.authStore.token },
        body: JSON.stringify({ message: msg, conversation_id: convId }),
      })
      if (!res.ok) throw new Error('Falha na resposta')
      let finalContent = ''
      const result = await streamAgentChat(res, {
        onChunk: (_, full) => {
          finalContent = full
          setMessages((prev) => {
            const newArr = [...prev]
            if (
              newArr[newArr.length - 1]?.role === 'assistant' &&
              !newArr[newArr.length - 1].final
            ) {
              newArr[newArr.length - 1].content = full
            } else {
              newArr.push({ role: 'assistant', content: full })
            }
            return newArr
          })
        },
      })
      setConvId(result.conversation_id)
      setMessages((prev) => {
        const newArr = [...prev]
        newArr[newArr.length - 1].final = true
        return newArr
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-purple-600 hover:bg-purple-700 gap-2">
          <BrainCircuit className="h-4 w-4" /> Escala Expert
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Assistente de Escala (IA)</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 p-4 border rounded-md bg-muted/30">
          {messages.length === 0 && (
            <p className="text-muted-foreground text-center mt-10 text-sm">
              Olá! Sou especialista em gestão de escalas. Peça para eu analisar dimensionamentos,
              folgas e leis trabalhistas.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground ml-8' : 'bg-background border mr-8 whitespace-pre-wrap'}`}
            >
              {m.content}
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 border rounded-md px-3 py-2 text-sm"
            placeholder="Pergunte sobre a escala..."
          />
          <Button onClick={handleSend} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
