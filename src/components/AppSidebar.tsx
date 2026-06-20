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
      <SidebarHeader className="p-4 min-h-[5rem] flex items-center justify-center border-b">
        <Link
          to="/"
          className="flex w-full items-center justify-center transition-opacity hover:opacity-80"
        >
          <img
            src="https://skip-assets.s3.amazonaws.com/11751/36965/images/f3821035-7c01-443b-8534-106596b6537d.gif"
            alt="Beneficência Portuguesa São Caetano do Sul"
            className="max-h-12 max-w-full w-auto object-contain"
          />
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-6 gap-8">
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs tracking-wider font-semibold mb-3 px-2">
            Navegação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === '/' || location.pathname === '/dashboard'}
                  tooltip="Dashboard"
                  className="h-10 transition-colors duration-200 data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 data-[active=true]:hover:bg-primary/15 rounded-lg px-3"
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
                  className="h-10 transition-colors duration-200 data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 data-[active=true]:hover:bg-primary/15 rounded-lg px-3"
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
          <SidebarGroupLabel className="text-muted-foreground text-xs tracking-wider font-semibold mb-3 px-2">
            Departamentos
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {sortedDepartments.map((dept: any) => (
                <SidebarMenuItem key={dept.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === `/department/${dept.id}`}
                    className="h-9 transition-colors duration-200 data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 data-[active=true]:hover:bg-primary/15 rounded-lg px-3 group"
                  >
                    <Link to={`/department/${dept.id}`} className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 group-data-[active=true]:bg-primary group-hover:bg-primary shrink-0 transition-colors" />
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
