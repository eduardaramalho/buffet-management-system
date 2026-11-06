import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TeamForm } from './TeamForm'
import { addTeamMember, createTeam, removeTeamMember, updateTeam } from '../api/teamsApi'
import { createCollaborator, listCollaborators } from '../api/collaboratorsApi'
import type { Collaborator } from '../types/collaborator'
import type { Team } from '../types/team'

vi.mock('../api/teamsApi', () => ({
  addTeamMember: vi.fn(),
  createTeam: vi.fn(),
  updateTeam: vi.fn(),
  removeTeamMember: vi.fn(),
}))
vi.mock('../api/collaboratorsApi', () => ({
  listCollaborators: vi.fn(),
  createCollaborator: vi.fn(),
  updateCollaborator: vi.fn(),
  setCollaboratorActive: vi.fn(),
}))

const createdTeam: Team = {
  id: 'team-1', name: 'Equipe Cozinha A', specialty: 'COZINHA', status: 'ATIVA', observations: null,
  createdById: 'actor-1', createdAt: '', updatedAt: '', deletedAt: null, members: [], events: [],
}
const person = (id: string, name: string, position: string): Collaborator => ({ id, name, phone: null, position, status: 'ATIVO', createdAt: '', updatedAt: '', deletedAt: null })
const ana = person('collaborator-1', 'Ana Silva', 'Cozinheira')
const bruno = person('collaborator-2', 'Bruno Lima', 'Auxiliar de cozinha')

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Salvar equipe' }))
const goToMembers = () => fireEvent.click(screen.getByRole('button', { name: /Membros e líder/ }))
const fillData = () => {
  fireEvent.change(screen.getByLabelText('Nome da equipe'), { target: { value: 'Equipe Cozinha A' } })
  fireEvent.change(screen.getByLabelText('Especialidade'), { target: { value: 'COZINHA' } })
}

describe('TeamForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listCollaborators).mockResolvedValue([ana, bruno])
    vi.mocked(addTeamMember).mockResolvedValue(createdTeam)
    vi.mocked(removeTeamMember).mockResolvedValue(undefined)
  })

  it('validates the required data and returns to its section', async () => {
    render(<TeamForm onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)
    goToMembers()
    expect(screen.queryByText('Informe o nome da equipe.')).not.toBeInTheDocument()

    save()

    expect(await screen.findByText('Informe o nome da equipe.')).toBeInTheDocument()
    expect(screen.getByText('Selecione a especialidade.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome da equipe')).toBeVisible()
    expect(screen.getByLabelText('Nome da equipe')).toHaveFocus()
    expect(screen.getByRole('button', { name: /Dados da equipe/ })).toHaveTextContent('contém erros')
    expect(createTeam).not.toHaveBeenCalled()
  })

  it('shows the cargo of each collaborator and creates the team with its members', async () => {
    vi.mocked(createTeam).mockResolvedValue(createdTeam)
    const onCreated = vi.fn()
    render(<TeamForm onClose={vi.fn()} onCreated={onCreated} onUpdated={vi.fn()} />)

    fillData()
    goToMembers()
    expect(await screen.findByText('Cozinheira')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Ana Silva' }))
    save()

    await waitFor(() => expect(createTeam).toHaveBeenCalledWith({ name: 'Equipe Cozinha A', specialty: 'COZINHA', observations: null }))
    expect(addTeamMember).toHaveBeenCalledWith('team-1', 'collaborator-1', false)
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'team-1', members: [expect.objectContaining({ collaboratorId: 'collaborator-1', isLeader: false })] }))
  })

  it('offers the leader in a single control that only lists the members', async () => {
    render(<TeamForm onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)
    goToMembers()

    const leader = screen.getByRole('combobox', { name: 'Líder da equipe' })
    expect(leader).toBeDisabled()
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar Ana Silva' }))
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Bruno Lima' }))

    expect(within(leader).getAllByRole('option').map((option) => option.textContent)).toEqual(['Sem líder (opcional)', 'Ana Silva · Cozinheira', 'Bruno Lima · Auxiliar de cozinha'])
    fireEvent.change(leader, { target: { value: 'collaborator-1' } })

    // Com o líder definido, o controle vira um cartão com "Trocar": não existe botão de líder por membro.
    expect(screen.queryByRole('combobox', { name: 'Líder da equipe' })).not.toBeInTheDocument()
    expect(screen.getByText('Cozinheira · Líder da equipe')).toBeInTheDocument()
    expect(screen.getAllByRole('button').filter((button) => /líder/i.test(button.getAttribute('aria-label') ?? ''))).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Trocar líder' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Líder da equipe' }), { target: { value: 'collaborator-2' } })
    expect(screen.getByText('Auxiliar de cozinha · Líder da equipe')).toBeInTheDocument()
    expect(screen.queryByText('Cozinheira · Líder da equipe')).not.toBeInTheDocument()
  })

  it('creates the leader after the other members', async () => {
    vi.mocked(createTeam).mockResolvedValue(createdTeam)
    render(<TeamForm onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)
    fillData()
    goToMembers()
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar Ana Silva' }))
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Bruno Lima' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Líder da equipe' }), { target: { value: 'collaborator-1' } })
    save()

    await waitFor(() => expect(addTeamMember).toHaveBeenCalledTimes(2))
    expect(vi.mocked(addTeamMember).mock.calls).toEqual([['team-1', 'collaborator-2', false], ['team-1', 'collaborator-1', true]])
  })

  it('demotes the previous leader before promoting the new one when editing', async () => {
    const existingTeam: Team = { ...createdTeam, members: [
      { collaboratorId: ana.id, isLeader: true, collaborator: ana },
      { collaboratorId: bruno.id, isLeader: false, collaborator: bruno },
    ] }
    vi.mocked(updateTeam).mockResolvedValue(existingTeam)
    const calls: string[] = []
    vi.mocked(removeTeamMember).mockImplementation(async (_team, id) => { calls.push(`remove ${id}`) })
    vi.mocked(addTeamMember).mockImplementation(async (_team, id, isLeader) => { calls.push(`add ${id} ${isLeader}`); return existingTeam })
    const onUpdated = vi.fn()
    render(<TeamForm team={existingTeam} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={onUpdated} />)
    goToMembers()

    fireEvent.click(screen.getByRole('button', { name: 'Trocar líder' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Líder da equipe' }), { target: { value: bruno.id } })
    save()

    await waitFor(() => expect(onUpdated).toHaveBeenCalled())
    expect(calls).toEqual([`remove ${ana.id}`, `add ${ana.id} false`, `remove ${bruno.id}`, `add ${bruno.id} true`])
    expect(onUpdated.mock.calls[0][0].members.filter((member: { isLeader: boolean }) => member.isLeader)).toHaveLength(1)
  })

  it('removes an existing member when editing a team', async () => {
    const existingTeam: Team = { ...createdTeam, members: [{ collaboratorId: ana.id, isLeader: false, collaborator: ana }] }
    vi.mocked(updateTeam).mockResolvedValue(existingTeam)
    const onUpdated = vi.fn()
    render(<TeamForm team={existingTeam} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={onUpdated} />)
    goToMembers()

    fireEvent.click(screen.getByRole('button', { name: 'Remover Ana Silva' }))
    save()

    await waitFor(() => expect(removeTeamMember).toHaveBeenCalledWith('team-1', ana.id))
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ members: [] }))
  })

  it('filters the available collaborators through the API search', async () => {
    render(<TeamForm onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)
    goToMembers()
    fireEvent.change(screen.getByLabelText('Buscar por nome ou cargo'), { target: { value: 'cozinha' } })
    await waitFor(() => expect(listCollaborators).toHaveBeenLastCalledWith({ search: 'cozinha' }))
  })

  it('shows the API error and stays open', async () => {
    vi.mocked(createTeam).mockRejectedValue(new Error('Já existe uma equipe com este nome'))
    const onClose = vi.fn()
    render(<TeamForm onClose={onClose} onCreated={vi.fn()} onUpdated={vi.fn()} />)
    fillData()
    save()
    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe uma equipe com este nome')
    expect(onClose).not.toHaveBeenCalled()
  })

  // Regressão encontrada pelo E2E: o formulário de colaborador era renderizado DENTRO do <form> da equipe e o
  // "Salvar" dele submetia o formulário da equipe. Agora ele é um modal irmão, fora da árvore do modal da equipe.
  it('creates a collaborator inline without submitting the team form', async () => {
    vi.mocked(listCollaborators).mockResolvedValue([])
    vi.mocked(createCollaborator).mockResolvedValue(person('collaborator-3', 'Carlos Lima', 'Chef'))
    render(<TeamForm onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)
    goToMembers()

    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar novo colaborador' }))
    const collaboratorDialog = screen.getByRole('dialog', { name: 'Novo colaborador' })
    expect(document.querySelector('form form')).toBeNull()

    fireEvent.change(within(collaboratorDialog).getByLabelText('Nome'), { target: { value: 'Carlos Lima' } })
    fireEvent.change(within(collaboratorDialog).getByLabelText('Cargo'), { target: { value: 'Chef' } })
    fireEvent.click(within(collaboratorDialog).getByRole('button', { name: 'Salvar colaborador' }))

    expect(await screen.findByText('Chef')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Membros da equipe' })).getByText('Carlos Lima')).toBeInTheDocument()
    expect(createTeam).not.toHaveBeenCalled()
    expect(screen.queryByText('Informe o nome da equipe.')).not.toBeInTheDocument()
  })
})
