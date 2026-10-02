import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TasksBoardPage } from './TasksBoardPage'
import { listTasks, updateTaskStatus } from '../api/tasksApi'
import { listEvents } from '../api/eventsApi'
import { listTeams } from '../api/teamsApi'
import type { Task } from '../types/task'

vi.mock('../api/tasksApi', () => ({ listTasks: vi.fn(), getTask: vi.fn(), updateTaskStatus: vi.fn() }))
vi.mock('../api/eventsApi', () => ({ listEvents: vi.fn() }))
vi.mock('../api/teamsApi', () => ({ listTeams: vi.fn() }))

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

    expect(await screen.findByText('⚠ Sem equipe — ação necessária')).toBeInTheDocument()
  })
})
