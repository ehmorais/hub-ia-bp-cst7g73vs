import { Link, useLocation } from 'react-router-dom'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { LayoutDashboard, Settings } from 'lucide-react'
import { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'

export function AppSidebar() {
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const [departments, setDepartments] = useState<any[]>([])

  const loadData = async () => {
    try {
      const depRecords = await pb.collection('departments').getFullList({ sort: 'sort_order,name' })
      setDepartments(depRecords)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (isAuthenticated) loadData()
  }, [isAuthenticated])

  useRealtime(
    'departments',
    () => {
      loadData()
    },
    isAuthenticated,
  )

  const sortedDepartments = [...departments].sort((a, b) => {
    const aIsGeneral = a.name.includes('Projetos Gerais')
    const bIsGeneral = b.name.includes('Projetos Gerais')
    if (aIsGeneral && !bIsGeneral) return -1
    if (!aIsGeneral && bIsGeneral) return 1
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.name.localeCompare(b.name)
  })

  return (
    <Sidebar className="border-r-0 shadow-2xl bg-white">
      <SidebarHeader className="p-6 min-h-[5rem] flex items-center justify-center border-b border-emerald-900/10">
        <span className="font-bold text-[11px] tracking-[0.25em] uppercase text-emerald-950/50">
          Menu Principal
        </span>
      </SidebarHeader>

      <SidebarContent className="px-3 py-6 gap-8">
        <SidebarGroup>
          <SidebarGroupLabel className="text-emerald-950/50 text-xs tracking-wider font-semibold mb-3 px-2">
            Navegação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === '/' || location.pathname === '/dashboard'}
                  tooltip="Dashboard"
                  className="h-10 transition-all duration-200 data-[active=true]:bg-emerald-50 data-[active=true]:text-emerald-950 data-[active=true]:font-medium text-emerald-950/70 hover:text-emerald-950 hover:bg-emerald-50/50 rounded-lg px-3"
                >
                  <Link to="/" className="flex items-center gap-3">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Visão Geral</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === '/admin'}
                  tooltip="Administração"
                  className="h-10 transition-all duration-200 data-[active=true]:bg-emerald-50 data-[active=true]:text-emerald-950 data-[active=true]:font-medium text-emerald-950/70 hover:text-emerald-950 hover:bg-emerald-50/50 rounded-lg px-3"
                >
                  <Link to="/admin" className="flex items-center gap-3">
                    <Settings className="h-4 w-4" />
                    <span>Administração</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-emerald-950/50 text-xs tracking-wider font-semibold mb-3 px-2">
            Departamentos
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {sortedDepartments.map((dept: any) => (
                <SidebarMenuItem key={dept.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === `/department/${dept.id}`}
                    className="h-9 transition-all duration-200 data-[active=true]:bg-emerald-50 data-[active=true]:text-emerald-950 data-[active=true]:font-medium text-emerald-950/70 hover:text-emerald-950 hover:bg-emerald-50/50 rounded-lg px-3 group"
                  >
                    <Link to={`/department/${dept.id}`} className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-950/20 group-data-[active=true]:bg-emerald-950 group-hover:bg-emerald-950/40 shrink-0 transition-colors" />
                      <span className="line-clamp-1">{dept.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
