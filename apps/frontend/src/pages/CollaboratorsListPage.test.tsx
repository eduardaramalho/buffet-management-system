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
