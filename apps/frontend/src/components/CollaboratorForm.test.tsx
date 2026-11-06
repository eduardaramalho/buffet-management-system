import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CollaboratorForm } from './CollaboratorForm'
import { createCollaborator, listCollaborators, setCollaboratorActive, updateCollaborator } from '../api/collaboratorsApi'
import type { Collaborator } from '../types/collaborator'

vi.mock('../api/collaboratorsApi', () => ({
  createCollaborator: vi.fn(),
  updateCollaborator: vi.fn(),
  setCollaboratorActive: vi.fn(),
  listCollaborators: vi.fn(),
}))

const collaborator: Collaborator = {
  id: 'collaborator-1', name: 'Ana Silva', phone: '11999999999', position: 'Cozinheira',
  status: 'ATIVO', createdAt: '', updatedAt: '', deletedAt: null,
}
const save = (name = 'Salvar colaborador') => fireEvent.click(screen.getByRole('button', { name }))

describe('CollaboratorForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listCollaborators).mockResolvedValue([])
  })

  it('validates name and cargo before creating a collaborator', async () => {
    render(<CollaboratorForm onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)

    save()

    expect(await screen.findByText('Informe o nome do colaborador.')).toBeInTheDocument()
    expect(screen.getByText('Informe o cargo do colaborador.')).toBeInTheDocument()
    expect(createCollaborator).not.toHaveBeenCalled()
  })

  it('creates a collaborator with the masked phone', async () => {
    const created = { ...collaborator, id: 'collaborator-new' }
    vi.mocked(createCollaborator).mockResolvedValue(created)
    const onCreated = vi.fn()
    render(<CollaboratorForm onClose={vi.fn()} onCreated={onCreated} onUpdated={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana Silva' } })
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '11999999999' } })
    fireEvent.change(screen.getByLabelText('Cargo'), { target: { value: 'Cozinheira' } })
    save()

    await waitFor(() => expect(createCollaborator).toHaveBeenCalledWith({ name: 'Ana Silva', phone: '(11) 99999-9999', position: 'Cozinheira' }))
    expect(onCreated).toHaveBeenCalledWith(created)
  })

  it('suggests the cargos already in use', async () => {
    vi.mocked(listCollaborators).mockResolvedValue([
      collaborator, { ...collaborator, id: 'c2', position: 'Garçom' }, { ...collaborator, id: 'c3', position: 'Garçom' },
    ])
    render(<CollaboratorForm onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Usar o cargo Garçom' }))

    expect(screen.getByLabelText('Cargo')).toHaveValue('Garçom')
    expect(screen.queryByRole('button', { name: 'Usar o cargo Garçom' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Usar o cargo Cozinheira' })).toBeInTheDocument()
  })

  it('keeps the field free when the suggestions fail to load', async () => {
    vi.mocked(listCollaborators).mockRejectedValue(new Error('offline'))
    render(<CollaboratorForm onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)
    await waitFor(() => expect(listCollaborators).toHaveBeenCalled())
    expect(screen.queryByRole('group', { name: 'Cargos já usados' })).not.toBeInTheDocument()
  })

  it('updates a collaborator and its active status', async () => {
    vi.mocked(updateCollaborator).mockResolvedValue({ ...collaborator, position: 'Chefe de cozinha' })
    vi.mocked(setCollaboratorActive).mockResolvedValue({ ...collaborator, position: 'Chefe de cozinha', status: 'INATIVO' })
    const onUpdated = vi.fn()
    render(<CollaboratorForm collaborator={collaborator} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={onUpdated} />)

    expect(screen.getByLabelText('Telefone')).toHaveValue('(11) 99999-9999')
    fireEvent.change(screen.getByLabelText('Cargo'), { target: { value: 'Chefe de cozinha' } })
    fireEvent.click(screen.getByRole('switch', { name: /Colaborador ativo/ }))
    save('Salvar alterações')

    await waitFor(() => expect(updateCollaborator).toHaveBeenCalledWith('collaborator-1', { name: 'Ana Silva', phone: '(11) 99999-9999', position: 'Chefe de cozinha' }))
    expect(setCollaboratorActive).toHaveBeenCalledWith('collaborator-1', false)
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ status: 'INATIVO' }))
  })

  it('shows the API message and stays open', async () => {
    vi.mocked(createCollaborator).mockRejectedValue(new Error('Falha'))
    const onClose = vi.fn()
    render(<CollaboratorForm onClose={onClose} onCreated={vi.fn()} onUpdated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Cargo'), { target: { value: 'Copeira' } })
    save()
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha')
    expect(onClose).not.toHaveBeenCalled()
  })
})
