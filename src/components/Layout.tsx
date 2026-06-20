import { Outlet } from 'react-router-dom'
import { AppSidebar } from './AppSidebar'
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar'
export default function Layout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-white">
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b bg-white shadow-sm">
          <SidebarTrigger className="-ml-1 text-emerald-600 hover:text-emerald-700" />
          <div className="flex items-center gap-2 ml-2">
            <span className="font-bold text-lg tracking-tight text-emerald-800">HUB IA BPSCS</span>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 bg-white min-h-[calc(100vh-4rem)]">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
