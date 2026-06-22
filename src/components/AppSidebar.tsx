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
  const [projects, setProjects] = useState<any[]>([])

  const loadData = async () => {
    try {
      const depRecords = await pb.collection('departments').getFullList({ sort: 'sort_order,name' })
      setDepartments(depRecords)
      const projRecords = await pb.collection('projects').getFullList({ sort: 'sort_order,name' })
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

  const sortedDepartments = [...departments].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.name.localeCompare(b.name)
  })

  const generalDept = departments.find((d) => d.name.includes('Projetos Gerais'))
  const otherDepts = sortedDepartments.filter((d) => d.id !== generalDept?.id)
  const generalProjects = projects.filter(
    (p) =>
      (p.department === generalDept?.id || p.associated_departments?.includes(generalDept?.id)) &&
      p.name !== 'Visão Geral do Hub',
  )

  return (
    <Sidebar variant="inset" className="border-r border-slate-100 shadow-sm bg-white">
      <SidebarHeader className="p-4 min-h-[5rem] flex items-center justify-center border-b border-slate-100 bg-white">
        <Link
          to="/"
          className="flex w-full items-center justify-center transition-opacity hover:opacity-80"
        >
          <span className="font-bold text-2xl tracking-tight text-primary">HUB IA BPSCS</span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-6 gap-8 bg-white">
        <SidebarGroup>
          <SidebarGroupLabel className="text-slate-500 text-xs tracking-widest font-semibold mb-3 px-2 uppercase">
            Navegação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === '/' || location.pathname === '/dashboard'}
                  tooltip="Dashboard"
                  className="h-10 transition-all duration-200 rounded-lg px-3 group hover:bg-slate-50 hover:text-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium"
                >
                  <Link to="/" className="flex items-center gap-3">
                    <LayoutDashboard className="h-4 w-4 group-data-[active=true]:text-primary" />
                    <span>Visão Geral do Hub</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === '/admin' && location.hash !== '#escalas'}
                  tooltip="Administração"
                  className="h-10 transition-all duration-200 rounded-lg px-3 group hover:bg-slate-50 hover:text-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium"
                >
                  <Link to="/admin" className="flex items-center gap-3">
                    <Settings className="h-4 w-4 group-data-[active=true]:text-primary" />
                    <span>Administração</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {generalDept && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[#06402B] text-xs tracking-widest font-bold mb-3 px-2 uppercase flex items-center gap-2 font-sans">
              {generalDept.name}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5">
                {generalProjects.map((proj: any) => {
                  const isEscalas = proj.name === 'Gestão de Escalas'
                  const linkTo = isEscalas ? '/admin#escalas' : `/project/${proj.id}`
                  const isActive = isEscalas
                    ? location.pathname === '/admin' && location.hash === '#escalas'
                    : location.pathname === `/project/${proj.id}`

                  return (
                    <SidebarMenuItem key={proj.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="h-9 transition-all duration-200 rounded-md px-3 group hover:bg-slate-50 hover:text-[#06402B] data-[active=true]:bg-[#06402B]/10 data-[active=true]:text-[#06402B] data-[active=true]:font-medium"
                      >
                        <Link to={linkTo} className="flex items-center gap-3 font-sans">
                          <div className="w-1.5 h-1.5 rounded-sm bg-slate-300 group-data-[active=true]:bg-[#06402B] group-hover:bg-[#06402B] shrink-0 transition-colors" />
                          <span className="line-clamp-1">{proj.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-slate-500 text-xs tracking-widest font-semibold mb-3 px-2 uppercase">
            Departamentos
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {otherDepts.map((dept: any) => (
                <SidebarMenuItem key={dept.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === `/department/${dept.id}`}
                    className="h-9 transition-all duration-200 rounded-md px-3 group hover:bg-slate-50 hover:text-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium"
                  >
                    <Link
                      to={`/department/${dept.id}`}
                      className="flex items-center gap-3 font-sans"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-data-[active=true]:bg-primary group-hover:bg-primary shrink-0 transition-colors" />
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
