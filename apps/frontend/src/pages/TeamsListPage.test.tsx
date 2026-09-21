import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TeamsListPage } from './TeamsListPage'
import { listTeams, setTeamActive } from '../api/teamsApi'

vi.mock('../api/teamsApi', () => ({
  listTeams: vi.fn(),
  setTeamActive: vi.fn(),
  createTeam: vi.fn(),
  updateTeam: vi.fn(),
  listCollaborators: vi.fn(),
  addTeamMember: vi.fn(),
  removeTeamMember: vi.fn(),
}))
vi.mock('../components/TeamForm', () => ({ TeamForm: () => <div role="dialog">Team form</div> }))

const teams = [
  { id: 'team-1', name: 'Equipe Cozinha A', specialty: 'COZINHA' as const, status: 'ATIVA' as const, observations: null, createdById: 'actor', createdAt: '', updatedAt: '', deletedAt: null, members: [{ collaboratorId: 'c-1', isLeader: true, collaborator: { id: 'c-1', name: 'Ana', phone: null, position: 'Cozinheira', status: 'ATIVO' as const, createdAt: '', updatedAt: '', deletedAt: null } }], events: [] },
  { id: 'team-2', name: 'Equipe Bar B', specialty: 'BAR' as const, status: 'INATIVA' as const, observations: null, createdById: 'actor', createdAt: '', updatedAt: '', deletedAt: null, members: [], events: [] },
]

describe('TeamsListPage', () => {
  it('shows team summary, search and status action', async () => {
    vi.mocked(listTeams).mockResolvedValue(teams)
    vi.mocked(setTeamActive).mockResolvedValue({ ...teams[1], status: 'ATIVA' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TeamsListPage />)

    expect(await screen.findByText('Equipe Cozinha A')).toBeInTheDocument()
    expect(screen.getByText('Total de equipes')).toBeInTheDocument()
    expect(screen.getByText('Equipes ativas')).toBeInTheDocument()
    expect(screen.getByText('Inativas')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), { target: { value: 'Bar' } })
    expect(screen.getByDisplayValue('Bar')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ativar Equipe Bar B' }))

    await waitFor(() => expect(setTeamActive).toHaveBeenCalledWith('team-2', true))
  })
})
