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
} from '@/components/ui/sidebar'
import { LayoutDashboard, Settings, LogOut, ChevronRight, ShieldAlert } from 'lucide-react'
import { DEPARTMENTS } from '@/lib/mock-data'

export function AppSidebar() {
  const location = useLocation()

  return (
    <Sidebar variant="inset" className="border-r shadow-sm">
      <SidebarHeader className="p-4 flex flex-row items-center gap-3 border-b">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center p-1">
          <img
            src="https://img.usecurling.com/i?q=sailboat&color=blue&shape=fill"
            alt="Beneficência Portuguesa Logo"
            className="h-full w-full object-contain"
          />
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="font-bold text-lg leading-tight text-primary truncate">HUB IA BP</span>
          <span className="text-xs text-muted-foreground font-medium truncate">
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
              {DEPARTMENTS.map((dept) => {
                const Icon = dept.icon
                const isActive = location.pathname.includes(`/department/${dept.id}`)
                return (
                  <SidebarMenuItem key={dept.id}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={dept.name}>
                      <Link to={`/department/${dept.id}`}>
                        <Icon className="h-4 w-4" />
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
                asChild
                variant="default"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Link to="/">
                  <LogOut className="h-4 w-4" />
                  <span>Sair do Sistema</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
