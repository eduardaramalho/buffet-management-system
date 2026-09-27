import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CollaboratorForm } from './CollaboratorForm'
import { createCollaborator, setCollaboratorActive, updateCollaborator } from '../api/collaboratorsApi'
import type { Collaborator } from '../types/collaborator'

vi.mock('../api/collaboratorsApi', () => ({
  createCollaborator: vi.fn(),
  updateCollaborator: vi.fn(),
  setCollaboratorActive: vi.fn(),
}))

const collaborator: Collaborator = {
  id: 'collaborator-1', name: 'Ana Silva', phone: '11999999999', position: 'Cozinheira',
  status: 'ATIVO', createdAt: '', updatedAt: '', deletedAt: null,
}

describe('CollaboratorForm', () => {
  it('validates required fields before creating a collaborator', async () => {
    render(<CollaboratorForm onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Informe o nome do colaborador.')).toBeInTheDocument()
    expect(createCollaborator).not.toHaveBeenCalled()
  })

  it('creates a collaborator with the provided data', async () => {
    const created = { ...collaborator, id: 'collaborator-new' }
    vi.mocked(createCollaborator).mockResolvedValue(created)
    const onCreated = vi.fn()
    render(<CollaboratorForm onClose={vi.fn()} onCreated={onCreated} onUpdated={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana Silva' } })
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '11999999999' } })
    fireEvent.change(screen.getByLabelText('Função'), { target: { value: 'Cozinheira' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(createCollaborator).toHaveBeenCalledWith({ name: 'Ana Silva', phone: '11999999999', position: 'Cozinheira' }))
    expect(onCreated).toHaveBeenCalledWith(created)
  })

  it('updates a collaborator and its active status', async () => {
    vi.mocked(updateCollaborator).mockResolvedValue({ ...collaborator, position: 'Chefe de cozinha' })
    vi.mocked(setCollaboratorActive).mockResolvedValue({ ...collaborator, position: 'Chefe de cozinha', status: 'INATIVO' })
    const onUpdated = vi.fn()
    render(<CollaboratorForm collaborator={collaborator} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={onUpdated} />)

    fireEvent.change(screen.getByLabelText('Função'), { target: { value: 'Chefe de cozinha' } })
    fireEvent.click(screen.getByLabelText('Colaborador ativo'))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(updateCollaborator).toHaveBeenCalledWith('collaborator-1', { name: 'Ana Silva', phone: '11999999999', position: 'Chefe de cozinha' }))
    expect(setCollaboratorActive).toHaveBeenCalledWith('collaborator-1', false)
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ status: 'INATIVO' }))
  })
})
