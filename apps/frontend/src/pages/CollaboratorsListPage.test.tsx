import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CollaboratorsListPage } from './CollaboratorsListPage'
import { listCollaborators, setCollaboratorActive } from '../api/collaboratorsApi'

vi.mock('../api/collaboratorsApi', () => ({
  listCollaborators: vi.fn(),
  setCollaboratorActive: vi.fn(),
  createCollaborator: vi.fn(),
  updateCollaborator: vi.fn(),
}))

const collaborators = [
  { id: 'collaborator-1', name: 'Ana Silva', phone: '11999999999', position: 'Cozinheira', status: 'ATIVO' as const, createdAt: '', updatedAt: '', deletedAt: null },
  { id: 'collaborator-2', name: 'Bia Souza', phone: null, position: 'Garçonete', status: 'INATIVO' as const, createdAt: '', updatedAt: '', deletedAt: null },
]

describe('CollaboratorsListPage', () => {
  it('shows collaborator summary, search and status action', async () => {
    vi.mocked(listCollaborators).mockResolvedValue(collaborators)
    vi.mocked(setCollaboratorActive).mockResolvedValue({ ...collaborators[1], status: 'ATIVO' })
    render(<CollaboratorsListPage />)

    expect(await screen.findByText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByText('Total de colaboradores')).toBeInTheDocument()
    expect(screen.getByText('Ativos')).toBeInTheDocument()
    expect(screen.getByText('Inativos')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), { target: { value: 'Bia' } })
    expect(screen.getByDisplayValue('Bia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ativar Bia Souza' }))

    await waitFor(() => expect(setCollaboratorActive).toHaveBeenCalledWith('collaborator-2', true))
  })
})

describe('CollaboratorsListPage: carregamento inicial (KAN-79)', () => {
  it('does not show zeroed totals or the empty message before the API answers', () => {
    vi.mocked(listCollaborators).mockReturnValue(new Promise<never>(() => {}))
    render(<CollaboratorsListPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Colaboradores' })).toBeInTheDocument()
    expect(screen.queryByText('Total de colaboradores')).not.toBeInTheDocument()
    expect(screen.queryByText('Nenhum colaborador encontrado.')).not.toBeInTheDocument()
  })

  it('shows the error instead of zeroed data and recovers on retry', async () => {
    vi.mocked(listCollaborators).mockRejectedValueOnce(new Error('Falha de rede')).mockResolvedValue(collaborators)
    render(<CollaboratorsListPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha de rede')
    expect(screen.queryByText('Total de colaboradores')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByText('Total de colaboradores')).toBeInTheDocument()
  })
})
