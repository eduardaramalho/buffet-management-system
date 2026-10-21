import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TasksBoardPage } from './TasksBoardPage'
import { createTask, listTasks, removeTask, updateTask, updateTaskStatus } from '../api/tasksApi'
import { listEvents } from '../api/eventsApi'
import { listTeams, listTeamsByEvent } from '../api/teamsApi'
import type { Task } from '../types/task'

vi.mock('../api/tasksApi', () => ({ listTasks: vi.fn(), getTask: vi.fn(), updateTaskStatus: vi.fn(), createTask: vi.fn(), updateTask: vi.fn(), removeTask: vi.fn() }))
vi.mock('../api/eventsApi', () => ({ listEvents: vi.fn() }))
vi.mock('../api/teamsApi', () => ({ listTeams: vi.fn(), listTeamsByEvent: vi.fn() }))
let permissions = ['tasks:list', 'tasks:create', 'tasks:update', 'tasks:delete', 'tasks:update-status']
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: { roles: [{ name: 'Administrador', permissions }] } }) }))

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  eventId: 'event-1',
  title: 'Confirmar decoração',
  description: null,
  dueDate: null,
  status: 'PENDENTE',
  assignedTeamId: null,
  sourceRuleId: null,
  createdAt: '2026-09-28T00:00:00.000Z',
  updatedAt: '2026-09-28T00:00:00.000Z',
  deletedAt: null,
  ...overrides,
})

const event = { id: 'event-1', name: 'Casamento Ana', eventDate: '2026-11-10T15:00:00.000Z', endDate: null, location: 'Salão', serviceType: 'CASAMENTO' as const, guestsCount: 100, observations: null, status: 'CONFIRMADO' as const, createdById: 'user', createdAt: '', updatedAt: '', deletedAt: null, services: [] }
const team = { id: 'team-1', name: 'Equipe Cozinha A', specialty: 'COZINHA' as const, status: 'ATIVA' as const, observations: null, createdById: 'actor', createdAt: '', updatedAt: '', deletedAt: null, members: [], events: [] }

describe('TasksBoardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    permissions = ['tasks:list', 'tasks:create', 'tasks:update', 'tasks:delete', 'tasks:update-status']
    vi.mocked(listTeamsByEvent).mockResolvedValue([{ eventId: 'event-1', teamId: 'team-1', assignedAt: '', assignedById: 'a' }])
  })

  it('atualiza silenciosamente via botão e mantém os dados quando a atualização falha', async () => {
    vi.mocked(listTasks).mockResolvedValueOnce([task({ title: 'Confirmar decoração' })])
    vi.mocked(listEvents).mockResolvedValue([event])
    vi.mocked(listTeams).mockResolvedValue([team])
    render(<TasksBoardPage />)
    await screen.findByText('Confirmar decoração')

    vi.mocked(listTasks).mockRejectedValueOnce(new Error('rede'))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }))
    await waitFor(() => expect(listTasks).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Confirmar decoração')).toBeInTheDocument()
    expect(screen.queryByText('rede')).not.toBeInTheDocument()
  })

  it('loads tasks and groups them by status column', async () => {
    vi.mocked(listTasks).mockResolvedValue([
      task({ id: 'task-1', title: 'Confirmar decoração', status: 'PENDENTE' }),
      task({ id: 'task-2', title: 'Preparar bar', status: 'EM_ANDAMENTO' }),
    ])
    vi.mocked(listEvents).mockResolvedValue([event])
    vi.mocked(listTeams).mockResolvedValue([team])

    render(<TasksBoardPage />)

    const pendingColumn = await screen.findByRole('region', { name: 'Pendente' })
    expect(within(pendingColumn).getByText('Confirmar decoração')).toBeInTheDocument()
    const inProgressColumn = screen.getByRole('region', { name: 'Em andamento' })
    expect(within(inProgressColumn).getByText('Preparar bar')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Concluída' })).queryByText('Preparar bar')).not.toBeInTheDocument()
  })

  it('moves a task to another status by calling the API and updating the board', async () => {
    const pendingTask = task({ id: 'task-1', title: 'Confirmar decoração', status: 'PENDENTE' })
    vi.mocked(listTasks).mockResolvedValue([pendingTask])
    vi.mocked(listEvents).mockResolvedValue([event])
    vi.mocked(listTeams).mockResolvedValue([team])
    vi.mocked(updateTaskStatus).mockResolvedValue({ ...pendingTask, status: 'EM_ANDAMENTO' })

    render(<TasksBoardPage />)
    await screen.findByText('Confirmar decoração')

    fireEvent.change(screen.getByLabelText('Mover Confirmar decoração'), { target: { value: 'EM_ANDAMENTO' } })

    await waitFor(() => expect(updateTaskStatus).toHaveBeenCalledWith('task-1', 'EM_ANDAMENTO'))
    const inProgressColumn = await screen.findByRole('region', { name: 'Em andamento' })
    expect(within(inProgressColumn).getByText('Confirmar decoração')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Pendente' })).queryByText('Confirmar decoração')).not.toBeInTheDocument()
  })

  it('offers no destination options for a CONCLUIDA/CANCELADA task', async () => {
    vi.mocked(listTasks).mockResolvedValue([
      task({ id: 'task-1', title: 'Tarefa concluída', status: 'CONCLUIDA' }),
      task({ id: 'task-2', title: 'Tarefa cancelada', status: 'CANCELADA' }),
    ])
    vi.mocked(listEvents).mockResolvedValue([event])
    vi.mocked(listTeams).mockResolvedValue([team])

    render(<TasksBoardPage />)
    await screen.findByText('Tarefa concluída')

    const concludedSelect = screen.getByLabelText('Mover Tarefa concluída') as HTMLSelectElement
    const cancelledSelect = screen.getByLabelText('Mover Tarefa cancelada') as HTMLSelectElement
    expect(concludedSelect).toBeDisabled()
    expect(cancelledSelect).toBeDisabled()
    expect(within(concludedSelect).getAllByRole('option')).toHaveLength(1)
    expect(within(cancelledSelect).getAllByRole('option')).toHaveLength(1)
  })

  it('shows a visual indicator for a task with no assigned team', async () => {
    vi.mocked(listTasks).mockResolvedValue([task({ id: 'task-1', title: 'Confirmar decoração', assignedTeamId: null })])
    vi.mocked(listEvents).mockResolvedValue([event])
    vi.mocked(listTeams).mockResolvedValue([team])

    render(<TasksBoardPage />)

    expect(await screen.findByText('Sem equipe — ação necessária')).toBeInTheDocument()
  })

  describe('tarefas manuais', () => {
    const arrange = (tasks: Task[]) => {
      vi.mocked(listTasks).mockResolvedValue(tasks)
      vi.mocked(listEvents).mockResolvedValue([event])
      vi.mocked(listTeams).mockResolvedValue([team])
    }

    it('cria uma tarefa pelo botão "Nova tarefa" e a mostra na coluna Pendente', async () => {
      arrange([])
      vi.mocked(createTask).mockResolvedValue(task({ id: 'new', title: 'Montar mesas' }))
      render(<TasksBoardPage />)
      fireEvent.click(await screen.findByRole('button', { name: 'Nova tarefa' }))
      fireEvent.change(screen.getByLabelText('Evento'), { target: { value: 'event-1' } })
      fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Montar mesas' } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
      await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'event-1', title: 'Montar mesas' })))
      expect(within(await screen.findByRole('region', { name: 'Pendente' })).getByText('Montar mesas')).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('edita uma tarefa existente e atualiza o card', async () => {
      arrange([task({ title: 'Confirmar decoração' })])
      vi.mocked(updateTask).mockResolvedValue(task({ title: 'Confirmar decoração', description: 'Nova descrição' }))
      render(<TasksBoardPage />)
      fireEvent.click(await screen.findByRole('button', { name: 'Editar Confirmar decoração' }))
      fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Nova descrição' } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
      await waitFor(() => expect(updateTask).toHaveBeenCalledWith('task-1', { description: 'Nova descrição' }))
    })

    it('abre o formulário de edição ao clicar em "Atribuir equipe" numa tarefa sem equipe', async () => {
      arrange([task()])
      render(<TasksBoardPage />)
      fireEvent.click(await screen.findByRole('button', { name: 'Atribuir equipe a Confirmar decoração' }))
      expect(screen.getByRole('heading', { name: 'Editar tarefa' })).toBeInTheDocument()
    })

    it('exclui após confirmação e remove o card', async () => {
      arrange([task()])
      vi.mocked(removeTask).mockResolvedValue(undefined)
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<TasksBoardPage />)
      fireEvent.click(await screen.findByRole('button', { name: 'Excluir Confirmar decoração' }))
      await waitFor(() => expect(removeTask).toHaveBeenCalledWith('task-1'))
      await waitFor(() => expect(screen.queryByText('Confirmar decoração')).not.toBeInTheDocument())
    })

    it('não exclui quando a confirmação é recusada', async () => {
      arrange([task()])
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<TasksBoardPage />)
      fireEvent.click(await screen.findByRole('button', { name: 'Excluir Confirmar decoração' }))
      expect(removeTask).not.toHaveBeenCalled()
      expect(screen.getByText('Confirmar decoração')).toBeInTheDocument()
    })

    it('mostra o erro da API quando a exclusão falha', async () => {
      arrange([task()])
      vi.mocked(removeTask).mockRejectedValue(new Error('Tarefas concluídas ou canceladas não podem ser excluídas'))
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<TasksBoardPage />)
      fireEvent.click(await screen.findByRole('button', { name: 'Excluir Confirmar decoração' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Tarefas concluídas ou canceladas não podem ser excluídas')
      expect(screen.getByText('Confirmar decoração')).toBeInTheDocument()
    })

    it('esconde as ações de tarefas terminais', async () => {
      arrange([task({ status: 'CONCLUIDA', title: 'Feita' })])
      render(<TasksBoardPage />)
      await screen.findByText('Feita')
      expect(screen.queryByRole('button', { name: 'Editar Feita' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Excluir Feita' })).not.toBeInTheDocument()
    })

    it('esconde as ações sem a permissão correspondente', async () => {
      permissions = ['tasks:list', 'tasks:update-status']
      arrange([task()])
      render(<TasksBoardPage />)
      await screen.findByText('Confirmar decoração')
      expect(screen.queryByRole('button', { name: 'Nova tarefa' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Editar Confirmar decoração' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Excluir Confirmar decoração' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Atribuir equipe a Confirmar decoração' })).not.toBeInTheDocument()
    })

    it('mantém o card de tarefa gerada com o selo e permite excluí-la', async () => {
      arrange([task({ sourceRuleId: 'rule-1' })])
      render(<TasksBoardPage />)
      expect(await screen.findByText('Gerada automaticamente')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Excluir Confirmar decoração' })).toBeInTheDocument()
    })
  })
})
