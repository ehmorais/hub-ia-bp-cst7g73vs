import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import {
  LayoutDashboard,
  MessageSquare,
  LogOut,
  Briefcase,
  Building2,
  ShieldCheck,
  Settings,
  Menu,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function HoverSection({
  title,
  icon: Icon,
  children,
  isActive = false,
}: {
  title: string
  icon?: any
  children: React.ReactNode
  isActive?: boolean
}) {
  return (
    <HoverCard openDelay={50} closeDelay={150}>
      <HoverCardTrigger asChild>
        <div
          className={cn(
            'flex items-center gap-3 px-5 py-4 cursor-pointer transition-all duration-300 rounded-xl mx-4 mb-4 border border-transparent',
            isActive
              ? 'bg-[#06402B] text-white shadow-lg shadow-[#06402B]/20'
              : 'text-[#06402B] bg-white shadow-sm hover:bg-[#06402B]/5 hover:border-[#06402B]/10',
          )}
        >
          {Icon && <Icon className="w-5 h-5" />}
          <span className="font-bold text-[13px] tracking-widest uppercase">{title}</span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={16}
        className="w-72 p-2 bg-white/95 backdrop-blur-xl border border-[#06402B]/10 shadow-2xl rounded-2xl z-[100]"
      >
        <SidebarMenu className="gap-1 max-h-[75vh] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full pr-1">
          {children}
        </SidebarMenu>
      </HoverCardContent>
    </HoverCard>
  )
}

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, signOut } = useAuth()
  const [departments, setDepartments] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])

  const loadData = async () => {
    try {
      const depRecords = await pb.collection('departments').getFullList({ sort: 'sort_order,name' })
      setDepartments(depRecords)

      const projRecords = await pb.collection('projects').getFullList({
        filter: "status = 'active'",
        sort: 'sort_order,name',
      })
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

  const isNavActive =
    location.pathname === '/' ||
    location.pathname === '/dashboard' ||
    location.pathname.startsWith('/ai/') ||
    location.pathname === '/admin' ||
    location.pathname === '/settings' ||
    location.pathname === '/profile'

  const isProjectsActive = location.pathname.startsWith('/project/')
  const isDeptsActive = location.pathname.startsWith('/department/')

  return (
    <Sidebar variant="inset" className="border-r border-[#06402B]/10 shadow-sm !bg-slate-50/50">
      <SidebarHeader className="p-6 min-h-[5rem] flex items-center justify-center border-b border-[#06402B]/10 bg-transparent mb-6">
        <Link
          to="/"
          className="flex w-full items-center justify-center transition-opacity hover:opacity-80"
        >
          <span className="font-extrabold text-2xl tracking-tighter text-[#06402B]">
            HUB IA BPSCS
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-0 py-2 gap-2 bg-transparent overflow-visible">
        <HoverSection title="Navegação" icon={Menu} isActive={isNavActive}>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location.pathname === '/' || location.pathname === '/dashboard'}
              className="h-10 transition-all duration-200 rounded-lg px-3 text-[14px] group hover:bg-[#06402B]/10 hover:text-[#06402B] data-[active=true]:bg-[#06402B] data-[active=true]:text-white data-[active=true]:font-bold"
            >
              <Link to="/">
                <LayoutDashboard className="h-[18px] w-[18px] mr-2" />
                Dashboard / Home
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location.pathname.startsWith('/ai/')}
              className="h-10 transition-all duration-200 rounded-lg px-3 text-[14px] group hover:bg-[#06402B]/10 hover:text-[#06402B] data-[active=true]:bg-[#06402B] data-[active=true]:text-white data-[active=true]:font-bold"
            >
              <Link to="/ai/chat">
                <MessageSquare className="h-[18px] w-[18px] mr-2" />
                AI Chat
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location.pathname === '/admin'}
              className="h-10 transition-all duration-200 rounded-lg px-3 text-[14px] group hover:bg-[#06402B]/10 hover:text-[#06402B] data-[active=true]:bg-[#06402B] data-[active=true]:text-white data-[active=true]:font-bold"
            >
              <Link to="/admin">
                <ShieldCheck className="h-[18px] w-[18px] mr-2" />
                Administração
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location.pathname === '/settings'}
              className="h-10 transition-all duration-200 rounded-lg px-3 text-[14px] group hover:bg-[#06402B]/10 hover:text-[#06402B] data-[active=true]:bg-[#06402B] data-[active=true]:text-white data-[active=true]:font-bold"
            >
              <Link to="/settings">
                <Settings className="h-[18px] w-[18px] mr-2" />
                Configurações
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <div className="h-px bg-[#06402B]/10 my-2 mx-2" />

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                signOut()
                toast.success('Sessão encerrada com sucesso.')
                navigate('/login')
              }}
              className="h-10 transition-all duration-200 rounded-lg px-3 text-[14px] group hover:bg-red-50 hover:text-red-600 text-slate-600 mt-1 border border-transparent hover:border-red-100"
            >
              <LogOut className="h-[18px] w-[18px] mr-2" />
              <span className="font-bold">Sair do Sistema</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </HoverSection>

        <HoverSection title="Projetos Gerais HBPSCSC" icon={Briefcase} isActive={isProjectsActive}>
          {projects.map((proj) => (
            <SidebarMenuItem key={proj.id}>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === `/project/${proj.id}`}
                className="h-10 transition-all duration-200 rounded-lg px-3 text-[14px] group hover:bg-[#06402B]/10 hover:text-[#06402B] data-[active=true]:bg-[#06402B] data-[active=true]:text-white data-[active=true]:font-bold"
              >
                <Link to={`/project/${proj.id}`}>
                  <div className="w-1.5 h-1.5 rounded-sm bg-current shrink-0 transition-colors opacity-70 group-data-[active=true]:opacity-100 mr-2" />
                  <span className="line-clamp-1">{proj.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          {projects.length === 0 && (
            <div className="px-3 py-4 text-sm text-slate-400 text-center font-medium">
              Nenhum projeto ativo
            </div>
          )}
        </HoverSection>

        <HoverSection title="Departamentos" icon={Building2} isActive={isDeptsActive}>
          {departments.map((dept) => (
            <SidebarMenuItem key={dept.id}>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === `/department/${dept.id}`}
                className="h-10 transition-all duration-200 rounded-lg px-3 text-[14px] group hover:bg-[#06402B]/10 hover:text-[#06402B] data-[active=true]:bg-[#06402B] data-[active=true]:text-white data-[active=true]:font-bold"
              >
                <Link to={`/department/${dept.id}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-current shrink-0 transition-colors opacity-70 group-data-[active=true]:opacity-100 mr-2" />
                  <span className="line-clamp-1">{dept.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          {departments.length === 0 && (
            <div className="px-3 py-4 text-sm text-slate-400 text-center font-medium">
              Nenhum departamento
            </div>
          )}
        </HoverSection>
      </SidebarContent>
    </Sidebar>
  )
}
