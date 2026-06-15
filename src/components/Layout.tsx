import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { Bell, Search, User, AlertCircle } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { skipCloud } from '@/lib/skip-cloud'

export default function Layout() {
  const location = useLocation()

  useEffect(() => {
    // Inicialização do cliente Skip Cloud para métricas e auditoria futura
    skipCloud.collection('logs').then((col) => col.find())
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
          <SidebarTrigger className="shrink-0 md:hidden" />
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
            <div className="hidden lg:flex items-center gap-2 mr-4 text-sm">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
              <span className="text-muted-foreground font-medium">Sistemas Operacionais</span>
            </div>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute top-1 right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
            </Button>
            <div className="flex items-center gap-3 pl-4 border-l">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-semibold leading-none">Enf. Marina Costa</span>
                <span className="text-xs text-muted-foreground">Enfermeiro Sênior</span>
              </div>
              <Avatar className="h-9 w-9 border border-primary/20">
                <AvatarImage
                  src="https://img.usecurling.com/ppl/thumbnail?gender=female&seed=12"
                  alt="Avatar"
                />
                <AvatarFallback>MC</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

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
              <span>Hub IA BP v1.0.0</span>
            </div>
          </div>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  )
}
