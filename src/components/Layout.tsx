import { Outlet } from 'react-router-dom'
import { AppSidebar } from './AppSidebar'
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar'
import { useAuth } from '@/hooks/use-auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import pb from '@/lib/pocketbase/client'
import { GlobalSearch } from './GlobalSearch'
import { SystemHealthMonitor } from './SystemHealthMonitor'

export default function Layout() {
  const { user } = useAuth()
  const avatarUrl = user?.avatar ? pb.files.getURL(user, user.avatar) : undefined
  const fallback = user?.name ? user.name.charAt(0).toUpperCase() : 'U'

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-white">
        <div className="sticky top-0 z-10">
          <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-4 border-b border-slate-100 bg-white shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="-ml-1 text-primary hover:bg-slate-100 transition-colors" />
              <div className="hidden md:block">
                <GlobalSearch />
              </div>
            </div>
            <div className="flex items-center gap-4 mr-2">
              <div className="hidden sm:block">
                <SystemHealthMonitor />
              </div>
              <div className="flex flex-col items-end border-l border-slate-200 pl-4">
                <span className="text-sm font-semibold text-slate-800">
                  {user?.name || user?.email}
                </span>
                <span className="text-xs text-slate-500">{user?.role || 'Operador'}</span>
              </div>
              <Avatar className="h-10 w-10 border border-primary/20 shadow-sm">
                <AvatarImage src={avatarUrl} alt={user?.name} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {fallback}
                </AvatarFallback>
              </Avatar>
            </div>
          </header>
          <div className="h-[1px] w-full bg-emerald-900"></div>
          <div className="h-[1px] w-full bg-emerald-950"></div>
        </div>
        <main className="flex-1 p-4 md:p-6 lg:p-8 bg-white">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
