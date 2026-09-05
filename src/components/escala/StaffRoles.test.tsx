import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { StaffRoles } from '@/components/escala/StaffRoles'
import * as escalaService from '@/services/escala'

const mockToast = vi.fn()
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/hooks/use-realtime', () => ({
  useRealtime: vi.fn(),
}))

vi.mock('@/services/escala', () => ({
  getStaffRoles: vi.fn(),
  createStaffRole: vi.fn(),
  updateStaffRole: vi.fn(),
  deleteStaffRole: vi.fn(),
}))

describe('StaffRoles - Alteração do Nome de Função e Critérios de Aceite', () => {
  const initialRoles = [
    {
      id: 'role-enf-01',
      name: 'Enfermeiro Assistencial',
      hierarchy_rank: 20,
      requires_supervision: false,
    },
    {
      id: 'role-tec-02',
      name: 'Técnico de Enfermagem',
      hierarchy_rank: 10,
      requires_supervision: true,
    },
    {
      id: 'role-coord-03',
      name: 'Coordenador de Enfermagem',
      hierarchy_rank: 30,
      requires_supervision: false,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(escalaService.getStaffRoles).mockResolvedValue([...initialRoles] as any)
    vi.mocked(escalaService.createStaffRole).mockResolvedValue({ id: 'role-new' } as any)
    vi.mocked(escalaService.updateStaffRole).mockResolvedValue({ id: 'role-enf-01' } as any)
    vi.mocked(escalaService.deleteStaffRole).mockResolvedValue(true as any)
  })

  it('1. Deve exibir a ação clara "Editar" para cada função listada', async () => {
    render(<StaffRoles />)

    await waitFor(() => {
      expect(screen.getByText('Enfermeiro Assistencial')).toBeDefined()
    })

    const editButtons = screen.getAllByRole('button', { name: /Editar/i })
    expect(editButtons.length).toBe(3)
  })

  it('2. Ao clicar em Editar, abre modal/diálogo preenchido com o nome atual totalmente editável', async () => {
    render(<StaffRoles />)

    await waitFor(() => {
      expect(screen.getByText('Enfermeiro Assistencial')).toBeDefined()
    })

    const editButtons = screen.getAllByRole('button', {
      name: /Editar função Enfermeiro Assistencial/i,
    })
    fireEvent.click(editButtons[0])

    // Verifica que o modal abriu com título Editar Função
    expect(screen.getByRole('heading', { name: 'Editar Função' })).toBeDefined()

    // Campo "Nome da função" deve ter o valor atual
    const nameInput = screen.getByLabelText(/Nome da função/i) as HTMLInputElement
    expect(nameInput.value).toBe('Enfermeiro Assistencial')

    // Deve ser editável
    fireEvent.change(nameInput, { target: { value: 'Enfermeiro Sênior' } })
    expect(nameInput.value).toBe('Enfermeiro Sênior')
  })

  it('3. Ao salvar, atualiza o MESMO registro da função preservando seu ID e relações (sem delete nem novo create)', async () => {
    render(<StaffRoles />)

    await waitFor(() => {
      expect(screen.getByText('Enfermeiro Assistencial')).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /Editar função Enfermeiro Assistencial/i }))

    const nameInput = screen.getByLabelText(/Nome da função/i)
    fireEvent.change(nameInput, { target: { value: 'Enfermeiro Especialista UTI' } })

    const saveButton = screen.getByRole('button', { name: /Salvar Alterações/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(escalaService.updateStaffRole).toHaveBeenCalledWith(
        'role-enf-01', // MESMO ID do registro original
        expect.objectContaining({
          name: 'Enfermeiro Especialista UTI',
          hierarchy_rank: 20,
          requires_supervision: false,
        }),
      )
    })

    // Garante que NÃO chamou delete nem create para substituição
    expect(escalaService.deleteStaffRole).not.toHaveBeenCalled()
    expect(escalaService.createStaffRole).not.toHaveBeenCalled()

    // Verifica mensagem de sucesso
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sucesso',
        description: expect.stringContaining('alterado com sucesso'),
      }),
    )
  })

  it('4. Validação: impede nome vazio ou apenas com espaços (trim) com mensagem clara', async () => {
    render(<StaffRoles />)

    await waitFor(() => {
      expect(screen.getByText('Enfermeiro Assistencial')).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /Editar função Enfermeiro Assistencial/i }))

    const nameInput = screen.getByLabelText(/Nome da função/i)
    fireEvent.change(nameInput, { target: { value: '    ' } })

    const saveButton = screen.getByRole('button', { name: /Salvar Alterações/i })
    fireEvent.click(saveButton)

    // NÃO deve chamar updateStaffRole
    expect(escalaService.updateStaffRole).not.toHaveBeenCalled()

    // Mostra toast de validação
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Atenção',
        description: 'Nome da função é obrigatório.',
        variant: 'destructive',
      }),
    )
  })

  it('5. Validação: impede duplicidade de nome case-insensitive e com espaços extras', async () => {
    render(<StaffRoles />)

    await waitFor(() => {
      expect(screen.getByText('Enfermeiro Assistencial')).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /Editar função Enfermeiro Assistencial/i }))

    // Tenta renomear para "técnico de enfermagem" (já existe com outra capitalização)
    const nameInput = screen.getByLabelText(/Nome da função/i)
    fireEvent.change(nameInput, { target: { value: '   técnico de enfermagem   ' } })

    const saveButton = screen.getByRole('button', { name: /Salvar Alterações/i })
    fireEvent.click(saveButton)

    expect(escalaService.updateStaffRole).not.toHaveBeenCalled()
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Atenção',
        description: 'Já existe uma função cadastrada com este nome.',
        variant: 'destructive',
      }),
    )
  })

  it('6. Edição sem alteração de nome: o próprio registro NÃO é tratado como duplicado', async () => {
    render(<StaffRoles />)

    await waitFor(() => {
      expect(screen.getByText('Enfermeiro Assistencial')).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /Editar função Enfermeiro Assistencial/i }))

    // Salva sem alterar o nome
    const saveButton = screen.getByRole('button', { name: /Salvar Alterações/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(escalaService.updateStaffRole).toHaveBeenCalledWith(
        'role-enf-01',
        expect.objectContaining({
          name: 'Enfermeiro Assistencial',
        }),
      )
    })
  })

  it('7. Erro de persistência no backend: exibe mensagem amigável de erro', async () => {
    vi.mocked(escalaService.updateStaffRole).mockRejectedValueOnce(
      new Error('Conexão perdida com o servidor'),
    )

    render(<StaffRoles />)

    await waitFor(() => {
      expect(screen.getByText('Enfermeiro Assistencial')).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /Editar função Enfermeiro Assistencial/i }))

    const nameInput = screen.getByLabelText(/Nome da função/i)
    fireEvent.change(nameInput, { target: { value: 'Enfermeiro Supervisor' } })

    const saveButton = screen.getByRole('button', { name: /Salvar Alterações/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Erro de persistência',
          description: expect.stringContaining('Conexão perdida com o servidor'),
          variant: 'destructive',
        }),
      )
    })
  })

  it('8. Ausência de regressão: criação de nova função continua funcionando perfeitamente com validações', async () => {
    render(<StaffRoles />)

    await waitFor(() => {
      expect(screen.getByText('Nova Função')).toBeDefined()
    })

    // Tenta cadastrar com nome vazio
    const createBtn = screen.getByRole('button', { name: /Adicionar Função/i })
    fireEvent.click(createBtn)

    expect(escalaService.createStaffRole).not.toHaveBeenCalled()
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Atenção',
        description: 'Nome da função é obrigatório.',
        variant: 'destructive',
      }),
    )

    // Tenta cadastrar duplicado case-insensitive
    const nameInput = screen.getByLabelText(/Nome da Função \*/i)
    fireEvent.change(nameInput, { target: { value: '  ENFERMEIRO ASSISTENCIAL  ' } })
    fireEvent.click(createBtn)

    expect(escalaService.createStaffRole).not.toHaveBeenCalled()
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Atenção',
        description: 'Já existe uma função cadastrada com este nome.',
        variant: 'destructive',
      }),
    )

    // Cadastra função inédita com sucesso
    fireEvent.change(nameInput, { target: { value: 'Fisioterapeuta Respiratório' } })
    fireEvent.click(createBtn)

    await waitFor(() => {
      expect(escalaService.createStaffRole).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Fisioterapeuta Respiratório',
        }),
      )
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sucesso',
        description: expect.stringContaining('criada com sucesso'),
      }),
    )
  })
})
