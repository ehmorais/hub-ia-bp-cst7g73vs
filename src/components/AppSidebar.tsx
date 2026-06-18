import { Link, useLocation } from 'react-router-dom'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar'
import { LayoutDashboard, Settings, LogOut, ChevronRight, ShieldAlert } from 'lucide-react'
import { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { Folder } from 'lucide-react'

export function AppSidebar() {
  const location = useLocation()
  const { signOut, isAuthenticated } = useAuth()
  const [departments, setDepartments] = useState<any[]>([])

  const loadDepartments = async () => {
    try {
      const records = await pb.collection('departments').getFullList({ sort: 'name' })
      setDepartments(records)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (isAuthenticated) loadDepartments()
  }, [isAuthenticated])

  useRealtime(
    'departments',
    () => {
      loadDepartments()
    },
    isAuthenticated,
  )

  return (
    <Sidebar variant="inset" className="border-r shadow-sm">
      <SidebarHeader className="p-4 flex flex-col items-center justify-center gap-1 border-b bg-white min-h-[5rem]">
        <div className="flex flex-col overflow-hidden text-center w-full">
          <span className="font-bold text-xl leading-tight text-primary truncate">HUB IA BP</span>
          <span className="text-sm text-muted-foreground font-medium truncate">
            São Caetano do Sul
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === '/dashboard'}
                  tooltip="Dashboard"
                >
                  <Link to="/dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === '/admin'}
                  tooltip="Administração"
                >
                  <Link to="/admin">
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
              {departments.map((dept: any) => {
                const isDeptActive = location.pathname === `/department/${dept.id}`

                return (
                  <SidebarMenuItem key={dept.id}>
                    <SidebarMenuButton asChild isActive={isDeptActive} tooltip={dept.name}>
                      <Link to={`/department/${dept.id}`}>
                        <Folder className="h-4 w-4" />
                        <span>{dept.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex flex-col gap-4">
          <div className="bg-primary/10 rounded-lg p-3 text-xs flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span className="text-primary-foreground text-primary font-medium">
              LGPD & Compliance Ativos
            </span>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                variant="default"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
                <span>Sair do Sistema</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
