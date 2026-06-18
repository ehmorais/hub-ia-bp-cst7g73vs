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
} from '@/components/ui/sidebar'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { LayoutDashboard, Settings, LogOut, ShieldAlert } from 'lucide-react'
import { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { getIcon } from '@/lib/icons'

export function AppSidebar() {
  const location = useLocation()
  const { signOut, isAuthenticated } = useAuth()
  const [departments, setDepartments] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])

  const loadData = async () => {
    try {
      const [depRecords, projRecords] = await Promise.all([
        pb.collection('departments').getFullList({ sort: 'sort_order,name' }),
        pb
          .collection('projects')
          .getFullList({ sort: 'sort_order,name', filter: 'status = "active"' }),
      ])
      setDepartments(depRecords)
      setProjects(projRecords)
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
  useRealtime(
    'projects',
    () => {
      loadData()
    },
    isAuthenticated,
  )

  const renderIcon = (iconName: string) => {
    const Icon = getIcon(iconName)
    return <Icon className="h-4 w-4" />
  }

  const generalProjectDept = departments.find((d) => d.name === 'Projetos Gerais HBPSCS')
  const otherDepartments = departments
    .filter((d) => d.name !== 'Projetos Gerais HBPSCS')
    .sort((a, b) => a.sort_order - b.sort_order)

  const renderDeptItem = (dept: any) => {
    const isDeptActive = location.pathname === `/department/${dept.id}`
    const deptProjects = projects.filter(
      (p) => p.associated_departments?.includes(dept.id) || p.department === dept.id,
    )

    return (
      <SidebarMenuItem key={dept.id}>
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild>
            <SidebarMenuButton asChild isActive={isDeptActive} tooltip={dept.name}>
              <Link to={`/department/${dept.id}`}>
                <div
                  style={{ color: dept.color || 'inherit' }}
                  className="flex items-center justify-center"
                >
                  {renderIcon(dept.icon)}
                </div>
                <span style={{ color: dept.color || 'inherit', fontWeight: 500 }}>{dept.name}</span>
              </Link>
            </SidebarMenuButton>
          </HoverCardTrigger>
          {deptProjects.length > 0 && (
            <HoverCardContent side="right" align="start" className="w-64 p-2 z-50">
              <div className="space-y-1">
                <h4 className="font-semibold text-sm mb-2 text-muted-foreground px-2">Projetos</h4>
                {deptProjects.map((proj: any) => {
                  const isProjActive = location.pathname === `/project/${proj.id}`
                  return (
                    <Link
                      key={proj.id}
                      to={`/project/${proj.id}`}
                      className={`block px-2 py-1.5 text-sm rounded-md transition-colors hover:bg-muted ${
                        isProjActive
                          ? 'bg-muted font-medium text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {proj.name}
                    </Link>
                  )
                })}
              </div>
            </HoverCardContent>
          )}
        </HoverCard>
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar variant="inset" className="border-r shadow-sm">
      <SidebarHeader className="p-4 flex flex-col items-center justify-center gap-1 border-b bg-white min-h-[5rem]">
        <div className="flex flex-col overflow-hidden text-center w-full">
          <span className="font-bold text-xl leading-tight text-primary truncate">
            HUB de IA BP
          </span>
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
              {generalProjectDept && renderDeptItem(generalProjectDept)}
              {otherDepartments.map((dept: any) => renderDeptItem(dept))}
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
