import { Outlet, Link, useNavigate } from 'react-router-dom'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { User, LogOut, Search, Shuffle } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'

export default function Layout() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const avatarUrl = user?.avatar ? pb.files.getUrl(user, user.avatar, { thumb: '100x100' }) : ''
  const name = user?.name || 'Usuário'
  const initials = name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col min-h-screen bg-background">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-emerald-600/20 bg-white px-4 md:px-8 shadow-sm transition-all">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="shrink-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors" />
            <div className="h-5 w-px bg-emerald-600/20 mx-1 hidden md:block" />
            <Link
              to="/"
              className="flex items-center gap-3 transition-opacity hover:opacity-80 shrink-0"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                <span className="font-bold text-lg leading-none mb-[2px]">H</span>
              </div>
              <span className="font-bold text-lg tracking-tight text-emerald-950 hidden sm:block">
                HUB IA <span className="text-emerald-600 font-medium">BPSCS</span>
              </span>
            </Link>
          </div>

          <div className="flex-1 flex items-center justify-center md:justify-start px-2 md:px-6">
            <div className="relative w-full max-w-md flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-emerald-600" />
              <Input
                type="search"
                placeholder="Search..."
                className="w-full bg-white pl-10 pr-12 border-emerald-600/30 focus-visible:ring-emerald-600 rounded-full hover:border-emerald-600/50 transition-colors"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 h-8 w-8 rounded-full text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                title="Busca Randômica"
              >
                <Shuffle className="h-4 w-4" />
                <span className="sr-only">Busca Randômica</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-emerald-900 hidden md:inline-block">
              {name}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full shadow-sm border border-emerald-600/20 hover:bg-emerald-50"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={avatarUrl} alt={name} />
                    <AvatarFallback className="bg-emerald-50 text-emerald-600 font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-foreground">{name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  asChild
                  className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50 focus:text-emerald-900"
                >
                  <Link to="/profile" className="w-full flex items-center">
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
                  className="cursor-pointer text-destructive focus:text-destructive hover:bg-red-50 focus:bg-red-50"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 md:p-10">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
