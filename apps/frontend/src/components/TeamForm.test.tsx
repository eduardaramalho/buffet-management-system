import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TeamForm } from './TeamForm'
import { addTeamMember, createTeam, removeTeamMember, updateTeam } from '../api/teamsApi'
import { listCollaborators } from '../api/collaboratorsApi'
import type { Team } from '../types/team'

vi.mock('../api/teamsApi', () => ({
  addTeamMember: vi.fn(),
  createTeam: vi.fn(),
  updateTeam: vi.fn(),
  removeTeamMember: vi.fn(),
}))
vi.mock('../api/collaboratorsApi', () => ({
  listCollaborators: vi.fn(),
}))

const createdTeam: Team = {
  id: 'team-1', name: 'Equipe Cozinha A', specialty: 'COZINHA', status: 'ATIVA', observations: null,
  createdById: 'actor-1', createdAt: '', updatedAt: '', deletedAt: null, members: [], events: [],
}

const ana = { id: 'collaborator-1', name: 'Ana Silva', phone: null, position: 'Cozinheira', status: 'ATIVO' as const, createdAt: '', updatedAt: '', deletedAt: null }

describe('TeamForm', () => {
  it('validates required fields before creating a team', async () => {
    vi.mocked(listCollaborators).mockResolvedValue([])
    render(<TeamForm onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Informe o nome da equipe.')).toBeInTheDocument()
    expect(createTeam).not.toHaveBeenCalled()
  })

  it('creates a team and adds a selected collaborator', async () => {
    vi.mocked(listCollaborators).mockResolvedValue([ana])
    vi.mocked(createTeam).mockResolvedValue(createdTeam)
    vi.mocked(addTeamMember).mockResolvedValue({ ...createdTeam, members: [] })
    const onCreated = vi.fn()
    render(<TeamForm onClose={vi.fn()} onCreated={onCreated} onUpdated={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Nome da equipe'), { target: { value: 'Equipe Cozinha A' } })
    fireEvent.change(screen.getByLabelText('Especialidade'), { target: { value: 'COZINHA' } })
    fireEvent.click(await screen.findByLabelText('Ana Silva'))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(createTeam).toHaveBeenCalled())
    expect(addTeamMember).toHaveBeenCalledWith('team-1', 'collaborator-1', false)
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'team-1' }))
  })

  it('removes an existing member when editing a team', async () => {
    const existingTeam: Team = { ...createdTeam, members: [{ collaboratorId: 'collaborator-1', isLeader: false, collaborator: ana }] }
    vi.mocked(listCollaborators).mockResolvedValue([ana])
    vi.mocked(updateTeam).mockResolvedValue(existingTeam)
    vi.mocked(removeTeamMember).mockResolvedValue(undefined)
    const onUpdated = vi.fn()
    render(<TeamForm team={existingTeam} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={onUpdated} />)

    expect(await screen.findByLabelText('Ana Silva')).toBeChecked()
    fireEvent.click(screen.getByLabelText('Ana Silva'))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(removeTeamMember).toHaveBeenCalledWith('team-1', 'collaborator-1'))
    expect(onUpdated).toHaveBeenCalled()
  })
})
