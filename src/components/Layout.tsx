import { useEffect, useState } from 'react'
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { Bell, Search, User, AlertCircle, Activity } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { skipCloud } from '@/lib/skip-cloud'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SystemChecklistModal } from './SystemChecklistModal'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, signOut } = useAuth()

  const [tools, setTools] = useState<any[]>([])

  const fetchTools = async () => {
    if (!user) return
    try {
      const records = await pb.collection('ia_tools').getFullList({ sort: 'name' })
      let filteredTools = records
      const currentDeptId = location.pathname.startsWith('/department/')
        ? location.pathname.split('/')[2]
        : null

      if (user.role !== 'Admin') {
        const userProjects = await pb.collection('projects').getFullList({
          filter: `members ~ "${user.id}"`,
        })
        const userDeptIds = new Set<string>()
        userProjects.forEach((p) => {
          if (p.department) userDeptIds.add(p.department)
          p.associated_departments?.forEach((d: string) => userDeptIds.add(d))
        })
        if (currentDeptId) userDeptIds.add(currentDeptId)

        filteredTools = records.filter((t) =>
          t.associated_departments?.some((d: string) => userDeptIds.has(d)),
        )
      }
      setTools(filteredTools)
    } catch (error) {
      console.error('Failed to fetch IA tools:', error)
    }
  }

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchTools()
    }
  }, [isAuthenticated, user, location.pathname])

  useRealtime(
    'ia_tools',
    () => {
      fetchTools()
    },
    isAuthenticated,
  )

  useRealtime(
    'projects',
    () => {
      if (user?.role !== 'Admin') {
        fetchTools()
      }
    },
    isAuthenticated,
  )

  const allActive = tools.length === 0 || tools.every((t) => t.status === 'active')
  const statusColor = allActive ? 'bg-green-500' : 'bg-red-500'
  const statusText = allActive ? 'All Systems Go' : 'System Alert'

  const avatarUrl = user?.avatar ? pb.files.getUrl(user, user.avatar, { thumb: '100x100' }) : ''
  const name = user?.name || 'Usuário'
  const initials = name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

  useEffect(() => {
    // Inicialização do cliente Skip Cloud para métricas, auditoria futura e projetos
    skipCloud.collection('logs').then((col: any) => col.find())
    skipCloud.collection('projects').then((col: any) => col.find())
  }, [])

  // Do not render sidebar layout for the login page
  if (location.pathname === '/') {
    return (
      <main className="flex flex-col min-h-screen">
        <Outlet />
      </main>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col min-h-screen bg-slate-50/50">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 shadow-sm">
          <div className="flex items-center gap-2 md:hidden">
            <SidebarTrigger className="shrink-0" />
            <div className="flex items-center gap-2 ml-1">
              <div className="flex flex-col">
                <span className="font-bold text-sm leading-none text-primary">HUB de IA BP</span>
                <span className="text-[10px] text-muted-foreground font-medium">
                  São Caetano do Sul
                </span>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <div className="relative max-w-md hidden md:flex items-center">
              <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar ferramentas ou pacientes (anonimizado)..."
                className="pl-8 bg-muted/50 border-none focus-visible:ring-1 focus-visible:bg-background"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="hidden lg:flex items-center gap-2 mr-2 text-sm hover:bg-muted/50"
                >
                  <div
                    className={`h-2 w-2 rounded-full ${statusColor} ${allActive ? '' : 'animate-pulse'}`}
                  ></div>
                  <span className="text-muted-foreground font-medium">{statusText}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 mr-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold text-sm">Status do Sistema</h4>
                  </div>
                  {tools.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">
                      Nenhum módulo encontrado.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-auto pr-1">
                      {tools.map((tool) => (
                        <div key={tool.id} className="flex items-center justify-between text-xs">
                          <span className="font-medium truncate pr-2" title={tool.name}>
                            {tool.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full whitespace-nowrap ${tool.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                          >
                            {tool.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute top-1 right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
            </Button>
            <div className="flex items-center gap-3 pl-4 border-l">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-semibold leading-none">{name}</span>
                <span className="text-xs text-muted-foreground">{user?.email}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9 border border-primary/20">
                      <AvatarImage src={avatarUrl} alt={name} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="w-full cursor-pointer flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      <span>Meu Perfil</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      signOut()
                      navigate('/login')
                    }}
                    className="cursor-pointer"
                  >
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {isAuthenticated && <SystemChecklistModal tools={tools} />}

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto animate-fade-in">
          <Outlet />
        </main>

        {/* Global Footer / Disclaimer */}
        <footer className="mt-auto border-t bg-white p-4">
          <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-4 py-2 rounded-md border border-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="font-medium">
                <strong>Atenção:</strong> As respostas da IA são geradas automaticamente e devem ser
                obrigatoriamente validadas por profissionais de saúde habilitados.
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Button variant="link" size="sm" className="text-muted-foreground hover:text-primary">
                Reportar Problema
              </Button>
              <span>•</span>
              <span>HUB de IA BP v1.0.0</span>
            </div>
          </div>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  )
}
