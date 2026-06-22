import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import pb from '@/lib/pocketbase/client'
import { useNavigate } from 'react-router-dom'

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<
    { type: string; items: any[]; pathPrefix?: string; path?: string }[]
  >([])
  const navigate = useNavigate()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  useEffect(() => {
    if (!open || !query) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const filter = `name ~ "${query.replace(/"/g, '')}"`
        const [tools, projects, departments, profiles] = await Promise.all([
          pb.collection('ia_tools').getList(1, 5, { filter }),
          pb.collection('projects').getList(1, 5, { filter }),
          pb.collection('departments').getList(1, 5, { filter }),
          pb.collection('staff_profiles').getList(1, 5, { filter }),
        ])

        const newResults = []
        if (tools.items.length > 0)
          newResults.push({ type: 'IA Tools', items: tools.items, path: '/admin' })
        if (projects.items.length > 0)
          newResults.push({ type: 'Projects', items: projects.items, pathPrefix: '/project/' })
        if (departments.items.length > 0)
          newResults.push({
            type: 'Departments',
            items: departments.items,
            pathPrefix: '/department/',
          })
        if (profiles.items.length > 0)
          newResults.push({ type: 'Staff Profiles', items: profiles.items, path: '/admin' })

        setResults(newResults)
      } catch (error) {
        console.error('Search error', error)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, open])

  const handleSelect = (resultType: any, item: any) => {
    setOpen(false)
    if (resultType.pathPrefix) {
      navigate(`${resultType.pathPrefix}${item.id}`)
    } else if (resultType.path) {
      navigate(resultType.path)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-full transition-colors w-64 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <Search className="w-4 h-4 text-slate-400" />
        <span className="flex-1 text-left">Pesquisar...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-white px-1.5 font-mono text-[10px] font-medium text-slate-500 opacity-100 shadow-sm">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Digite para pesquisar em ferramentas, projetos, departamentos..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          {results.map((group) => (
            <CommandGroup key={group.type} heading={group.type}>
              {group.items.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => handleSelect(group, item)}
                  value={`${group.type}-${item.id}-${item.name}`}
                  className="cursor-pointer flex items-center gap-2"
                >
                  <Search className="w-3 h-3 text-slate-400" />
                  <span>{item.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  )
}
