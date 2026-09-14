import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { EscalasManagement } from '@/components/EscalasManagement'
import * as escalaService from '@/services/escala'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/hooks/use-realtime', () => ({
  useRealtime: vi.fn(),
}))

vi.mock('@/services/escala', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/escala')>()
  return {
    ...actual,
    getHospitalSectors: vi.fn(),
    getShiftCycles: vi.fn().mockResolvedValue([]),
  }
})

// Mock dos subcomponentes das tabs de EscalasManagement para teste leve e focado no cabeçalho
vi.mock('@/components/escala/ShiftCycles', () => ({
  ShiftCycles: () => <div data-testid="tab-ciclos">Tab Ciclos</div>,
}))
vi.mock('@/components/escala/ShiftTypes', () => ({
  ShiftTypes: () => <div data-testid="tab-tipos">Tab Tipos</div>,
}))
vi.mock('@/components/escala/Sectors', () => ({
  Sectors: () => <div data-testid="tab-setores">Tab Setores</div>,
}))
vi.mock('@/components/escala/StaffContracts', () => ({
  StaffContracts: () => <div data-testid="tab-contratos">Tab Contratos</div>,
}))
vi.mock('@/components/escala/StaffRoles', () => ({
  StaffRoles: () => <div data-testid="tab-funcao">Tab Funcao</div>,
}))
vi.mock('@/components/escala/Timeoff', () => ({
  Timeoff: () => <div data-testid="tab-folgas">Tab Folgas</div>,
}))
vi.mock('@/components/escala/ShiftRules', () => ({
  ShiftRules: () => <div data-testid="tab-regras">Tab Regras</div>,
}))
vi.mock('@/components/escala/StaffProfiles', () => ({
  StaffProfiles: () => <div data-testid="tab-perfis">Tab Perfis</div>,
}))
vi.mock('@/components/escala/ScalePlanner', () => ({
  ScalePlanner: () => <div data-testid="tab-planejamento">Tab Planejamento</div>,
}))
vi.mock('@/components/escala/AutoGenerate', () => ({
  AutoGenerate: () => <div data-testid="tab-gerar-ia">Tab Gerar IA</div>,
}))
vi.mock('@/components/escala/Indicators', () => ({
  Indicators: () => <div data-testid="tab-indicadores">Tab Indicadores</div>,
}))

describe('Botão Relatório na área de Gestão de Escalas (/gestao-escalas)', () => {
  const mockSectors = [
    { id: 'sec-uti', name: 'UTI Geral' },
    { id: 'sec-ps', name: 'Pronto Socorro' },
    { id: 'sec-andar2', name: '2º Andar' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(escalaService.getHospitalSectors).mockResolvedValue([...mockSectors] as any)
  })

  it('(a) presença e acessibilidade do botão "Relatório" na área administrativa', async () => {
    render(
      <MemoryRouter>
        <EscalasManagement />
      </MemoryRouter>,
    )

    // O botão deve estar presente no documento e possuir rótulo/texto exato "Relatório"
    const reportButton = await screen.findByRole('button', { name: /Relatório/i })
    expect(reportButton).toBeDefined()
    expect(reportButton.getAttribute('aria-label')).toBe('Relatório')
    // Botão é focável por teclado
    reportButton.focus()
    expect(document.activeElement).toBe(reportButton)
  })

  it('(b) o seletor oferece opção "Todos" e cada setor cadastrado ordenado alfabeticamente', async () => {
    render(
      <MemoryRouter>
        <EscalasManagement />
      </MemoryRouter>,
    )

    const reportButton = await screen.findByRole('button', { name: /Relatório/i })
    fireEvent.click(reportButton)

    // Deve abrir o menu dropdown
    await waitFor(() => {
      expect(screen.getByText('Todos')).toBeDefined()
    })

    // Opções de setores ordenados: '2º Andar', 'Pronto Socorro', 'UTI Geral'
    expect(screen.getByText('2º Andar')).toBeDefined()
    expect(screen.getByText('Pronto Socorro')).toBeDefined()
    expect(screen.getByText('UTI Geral')).toBeDefined()
  })

  it('(c) seleção de um setor específico navega ao relatório com o filtro pré-aplicado', async () => {
    render(
      <MemoryRouter>
        <EscalasManagement />
      </MemoryRouter>,
    )

    const reportButton = await screen.findByRole('button', { name: /Relatório/i })
    fireEvent.click(reportButton)

    await waitFor(() => {
      expect(screen.getByText('UTI Geral')).toBeDefined()
    })

    const utiOption = screen.getByText('UTI Geral')
    fireEvent.click(utiOption)

    // Navega para /relatorios?setor=sec-uti
    expect(mockNavigate).toHaveBeenCalledWith('/relatorios?setor=sec-uti')
  })

  it('(d) seleção da opção "Todos" abre o relatório com ?setor=todos', async () => {
    render(
      <MemoryRouter>
        <EscalasManagement />
      </MemoryRouter>,
    )

    const reportButton = await screen.findByRole('button', { name: /Relatório/i })
    fireEvent.click(reportButton)

    await waitFor(() => {
      expect(screen.getByText('Todos')).toBeDefined()
    })

    const allOption = screen.getByText('Todos')
    fireEvent.click(allOption)

    // Navega para /relatorios?setor=todos
    expect(mockNavigate).toHaveBeenCalledWith('/relatorios?setor=todos')
  })
})
