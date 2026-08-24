import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from '../src/pages/Dashboard'
import * as authHook from '../src/hooks/use-auth'
import pb from '../src/lib/pocketbase/client'

// Mock de ToolUsageChart para isolar testes da renderização do SVG/Recharts
vi.mock('../src/components/ToolUsageChart', () => ({
  ToolUsageChart: ({ tool }: { tool: any }) => (
    <div data-testid={`tool-chart-${tool.id}`}>Chart for {tool.name}</div>
  ),
}))

// Mock do hook useRealtime
vi.mock('../src/hooks/use-realtime', () => ({
  useRealtime: vi.fn(),
}))

describe('Dashboard Visual Refinement & Functionality Tests', () => {
  const mockTools = [
    {
      id: 'tool-1',
      name: 'Gerador de Escalas IA',
      description: 'Criação e otimização automatizada de escalas médicas.',
      status: 'active',
      associated_departments: ['dept-1'],
    },
    {
      id: 'tool-2',
      name: 'Análise de Prontuários',
      description: 'Extração inteligente de dados clínicos.',
      status: 'inactive',
      associated_departments: ['dept-1', 'dept-2'],
    },
  ]

  const mockDepartments = [
    {
      id: 'dept-1',
      name: 'Pronto Socorro',
      icon: 'Activity',
      sort_order: 1,
    },
    {
      id: 'dept-2',
      name: 'UTI Adulto',
      icon: 'Building2',
      sort_order: 2,
    },
  ]

  const mockProjects = [
    {
      id: 'proj-1',
      name: 'Projeto Escala PS',
      status: 'active',
      department: 'dept-1',
      associated_departments: ['dept-1'],
      members: ['user-1'],
    },
    {
      id: 'proj-2',
      name: 'Projeto UTI Eficiência',
      status: 'active',
      department: 'dept-2',
      associated_departments: ['dept-2'],
      members: ['user-1'],
    },
  ]

  const mockLogs = [
    {
      id: 'log-1',
      tool: 'tool-1',
      created: new Date().toISOString(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    vi.spyOn(authHook, 'useAuth').mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Dra. Ana Silva',
        email: 'ana.silva@hospital.com',
        role: 'Admin',
      },
      isAuthenticated: true,
      token: 'mock-token',
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshUser: vi.fn(),
    } as any)

    vi.spyOn(pb, 'collection').mockImplementation((collectionName: string) => {
      return {
        getFullList: vi.fn().mockImplementation(async (options?: any) => {
          if (collectionName === 'ia_tools') return mockTools
          if (collectionName === 'departments') return mockDepartments
          if (collectionName === 'projects') return mockProjects
          if (collectionName === 'audit_logs') return mockLogs
          return []
        }),
      } as any
    })
  })

  it('1. Renderiza o Dashboard com mock de useAuth e pb exibindo saudação personalizada', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/Olá,/i)).toBeInTheDocument()
      expect(screen.getByText(/Dra\. Ana Silva/i)).toBeInTheDocument()
      expect(
        screen.getByText(/Acompanhamento de uso, módulos e performance dos projetos\./i),
      ).toBeInTheDocument()
    })
  })

  it('2. Verifica hierarquia de headings (h1, h2) e classes de tipografia', async () => {
    const { container } = render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      const h1 = container.querySelector('h1')
      expect(h1).toBeInTheDocument()
      expect(h1?.textContent).toContain('Olá, Dra. Ana Silva. Bem-vindo(a).')
      expect(h1?.className).toContain('font-heading')

      const h2s = container.querySelectorAll('h2')
      expect(h2s.length).toBe(2)
      expect(h2s[0].textContent).toBe('Ferramentas de IA')
      expect(h2s[0].className).toContain('font-heading')
      expect(h2s[1].textContent).toBe('Módulos & Departamentos')
      expect(h2s[1].className).toContain('font-heading')
    })
  })

  it('3. Verifica que a tipografia Outfit é preservada via classes font-heading / font-sans / font-metrics / font-interactive', async () => {
    const { container } = render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(container.querySelector('.font-heading')).toBeInTheDocument()
      expect(container.querySelector('.font-sans')).toBeInTheDocument()
      expect(container.querySelector('.font-metrics')).toBeInTheDocument()
      expect(container.querySelector('.font-interactive')).toBeInTheDocument()
    })
  })

  it('4. Verifica que os 3 KPIs estão presentes com os números esperados', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Modelos Ativos')).toBeInTheDocument()
      expect(screen.getByText('Projetos em Andamento')).toBeInTheDocument()
      expect(screen.getByText('Departamentos')).toBeInTheDocument()

      // Modelos ativos: 1 (status: 'active' em mockTools)
      // Projetos em andamento: 2 (status: 'active' em mockProjects)
      // Departamentos: 2 (mockDepartments.length)
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('5. Verifica cards de ferramentas renderizam nomes e links "Acessar Ferramenta →"', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Gerador de Escalas IA')).toBeInTheDocument()
      expect(screen.getByText('Análise de Prontuários')).toBeInTheDocument()

      const toolLinks = screen.getAllByRole('link', { name: /Acessar Ferramenta/i })
      expect(toolLinks.length).toBe(2)
      expect(toolLinks[0]).toHaveAttribute('href', '/ai/tool-1')
      expect(toolLinks[1]).toHaveAttribute('href', '/ai/tool-2')
    })
  })

  it('6. Verifica cards de departamentos renderizam nomes e links "Ver detalhes →"', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Pronto Socorro')).toBeInTheDocument()
      expect(screen.getByText('UTI Adulto')).toBeInTheDocument()

      const deptLinks = screen.getAllByRole('link', { name: /Ver detalhes/i })
      expect(deptLinks.length).toBe(2)
      expect(deptLinks[0]).toHaveAttribute('href', '/department/dept-1')
      expect(deptLinks[1]).toHaveAttribute('href', '/department/dept-2')
    })
  })

  it('7. Verifica foco acessível nos links (focus-visible) e classes de acessibilidade', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      const toolLinks = screen.getAllByRole('link', { name: /Acessar Ferramenta/i })
      toolLinks.forEach((link) => {
        expect(link.className).toContain('focus-visible:outline-2')
        expect(link.className).toContain('focus-visible:outline-primary')
      })

      const deptLinks = screen.getAllByRole('link', { name: /Ver detalhes/i })
      deptLinks.forEach((link) => {
        expect(link.className).toContain('focus-visible:outline-2')
        expect(link.className).toContain('focus-visible:outline-primary')
      })
    })
  })

  it('8. Verifica suporte a prefers-reduced-motion com classes motion-reduce', async () => {
    const { container } = render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      const reducedMotionElements = container.querySelectorAll(
        '[class*="motion-reduce:animate-none"], [class*="motion-reduce:transition-none"]',
      )
      expect(reducedMotionElements.length).toBeGreaterThan(0)
    })
  })

  it('9. Verifica estado vazio de ferramentas quando nenhuma está disponível', async () => {
    vi.spyOn(pb, 'collection').mockImplementation((collectionName: string) => {
      return {
        getFullList: vi.fn().mockImplementation(async () => {
          if (collectionName === 'ia_tools') return []
          if (collectionName === 'departments') return mockDepartments
          if (collectionName === 'projects') return mockProjects
          return []
        }),
      } as any
    })

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Nenhuma ferramenta disponível.')).toBeInTheDocument()
    })
  })

  it('10. Verifica estado vazio de departamentos quando nenhum está cadastrado', async () => {
    vi.spyOn(pb, 'collection').mockImplementation((collectionName: string) => {
      return {
        getFullList: vi.fn().mockImplementation(async () => {
          if (collectionName === 'ia_tools') return mockTools
          if (collectionName === 'departments') return []
          if (collectionName === 'projects') return []
          return []
        }),
      } as any
    })

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Nenhum departamento cadastrado.')).toBeInTheDocument()
    })
  })

  it('11. Verifica que dados não são alterados pela renderização (preservação 100%)', async () => {
    const getFullListMock = vi.fn().mockImplementation(async (options?: any) => {
      return mockTools
    })

    vi.spyOn(pb, 'collection').mockReturnValue({
      getFullList: getFullListMock,
    } as any)

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(getFullListMock).toHaveBeenCalledWith({ sort: 'name' })
    })
  })
})
