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
    <Sidebar className="border-r shadow-sm">
      <SidebarHeader className="p-4 border-b min-h-[4rem] flex items-center justify-center bg-card text-foreground">
        <span className="font-semibold text-sm tracking-wider uppercase text-muted-foreground">
          Menu Principal
        </span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === '/' || location.pathname === '/dashboard'}
                  tooltip="Dashboard"
                  className="hover:text-primary hover:bg-secondary data-[active=true]:bg-secondary data-[active=true]:text-primary font-medium transition-colors"
                >
                  <Link to="/" className="flex items-center gap-2">
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
                  className="hover:text-primary hover:bg-secondary data-[active=true]:bg-secondary data-[active=true]:text-primary font-medium transition-colors"
                >
                  <Link to="/admin" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span>Administração</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Departamentos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sortedDepartments.map((dept: any) => (
                <SidebarMenuItem key={dept.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === `/department/${dept.id}`}
                    className="hover:text-primary hover:bg-secondary data-[active=true]:bg-secondary data-[active=true]:text-primary font-medium transition-colors"
                  >
                    <Link to={`/department/${dept.id}`} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 group-data-[active=true]:bg-primary shrink-0 transition-colors" />
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
