import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TasksBoardPage } from './TasksBoardPage'
import { createTask, listTaskComments, listTasks, removeTask, updateTask, updateTaskStatus } from '../api/tasksApi'
import { listEvents } from '../api/eventsApi'
import { listTeams, listTeamsByEvent } from '../api/teamsApi'
import { ToastProvider } from '../contexts/ToastContext'
import type { Task } from '../types/task'

vi.mock('../api/tasksApi', () => ({
  listTasks: vi.fn(), getTask: vi.fn(), updateTaskStatus: vi.fn(), createTask: vi.fn(), updateTask: vi.fn(), removeTask: vi.fn(),
  listTaskComments: vi.fn(), createTaskComment: vi.fn(),
}))
vi.mock('../api/eventsApi', () => ({ listEvents: vi.fn() }))
vi.mock('../api/teamsApi', () => ({ listTeams: vi.fn(), listTeamsByEvent: vi.fn() }))
let permissions = ['tasks:list', 'tasks:read', 'tasks:create', 'tasks:update', 'tasks:delete', 'tasks:update-status', 'tasks:comment', 'teams:list']
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: { roles: [{ name: 'Administrador', permissions }] } }) }))

// O arraste real depende de geometria que o jsdom não calcula: o teste captura os callbacks do DndContext
// e simula o início e o fim do arraste, que é exatamente o contrato entre a biblioteca e o quadro.
type DndProps = ComponentProps<typeof import('@dnd-kit/core').DndContext>
let dnd: DndProps
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  return { ...actual, DndContext: (props: DndProps) => { dnd = props; return <actual.DndContext {...props} /> } }
})

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

const event = { id: 'event-1', name: 'Casamento Ana', eventDate: '2026-11-10T15:00:00.000Z', endDate: null, location: 'Salão', serviceType: 'CASAMENTO' as const, guestsCount: 100, observations: null, status: 'CONFIRMADO' as const, createdById: 'user', createdAt: '', updatedAt: '', deletedAt: null, services: [], clientId: null, client: null }
const otherEvent = { ...event, id: 'event-2', name: 'Formatura Medicina', eventDate: '2026-11-21T15:00:00.000Z' }
const team = { id: 'team-1', name: 'Equipe Cozinha A', specialty: 'COZINHA' as const, status: 'ATIVA' as const, observations: null, createdById: 'actor', createdAt: '', updatedAt: '', deletedAt: null, members: [], events: [] }

const arrange = (tasks: Task[], events = [event]) => {
  vi.mocked(listTasks).mockResolvedValue(tasks)
  vi.mocked(listEvents).mockResolvedValue(events)
  vi.mocked(listTeams).mockResolvedValue([team])
}
const renderBoard = () => render(<ToastProvider><TasksBoardPage /></ToastProvider>)
const column = (name: string) => screen.getByRole('region', { name })
const drag = async (taskId: string, title: string, target: string | null) => {
  act(() => { dnd.onDragStart?.({ active: { id: taskId, data: { current: { title } } } } as never) })
  await act(async () => { dnd.onDragEnd?.({ active: { id: taskId, data: { current: { title } } }, over: target ? { id: target } : null } as never) })
}

describe('TasksBoardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    permissions = ['tasks:list', 'tasks:read', 'tasks:create', 'tasks:update', 'tasks:delete', 'tasks:update-status', 'tasks:comment', 'teams:list']
    vi.mocked(listTeamsByEvent).mockResolvedValue([{ eventId: 'event-1', teamId: 'team-1', assignedAt: '', assignedById: 'a' }])
    vi.mocked(listTaskComments).mockResolvedValue([])
  })

  it('atualiza silenciosamente via botão e mantém os dados quando a atualização falha', async () => {
    arrange([task()])
    vi.mocked(listTasks).mockResolvedValueOnce([task()])
    renderBoard()
    await screen.findByText('Confirmar decoração')

    vi.mocked(listTasks).mockRejectedValueOnce(new Error('rede'))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }))
    await waitFor(() => expect(listTasks).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Confirmar decoração')).toBeInTheDocument()
    expect(screen.queryByText('rede')).not.toBeInTheDocument()
  })

  it('shows the API error when the board cannot load', async () => {
    vi.mocked(listTasks).mockRejectedValue(new Error('Falha geral'))
    vi.mocked(listEvents).mockResolvedValue([])
    vi.mocked(listTeams).mockResolvedValue([])
    renderBoard()

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha geral')
  })

  it('loads tasks and groups them by status column', async () => {
    arrange([
      task({ id: 'task-1', title: 'Confirmar decoração', status: 'PENDENTE' }),
      task({ id: 'task-2', title: 'Preparar bar', status: 'EM_ANDAMENTO' }),
    ])
    renderBoard()

    const pendingColumn = await screen.findByRole('region', { name: 'Pendente' })
    expect(within(pendingColumn).getByText('Confirmar decoração')).toBeInTheDocument()
    expect(within(column('Em andamento')).getByText('Preparar bar')).toBeInTheDocument()
    expect(within(column('Concluída')).queryByText('Preparar bar')).not.toBeInTheDocument()
    expect(within(column('Concluída')).getByText('Nenhuma tarefa.')).toBeInTheDocument()
  })

  it('no longer has a "Mover" control on the card', async () => {
    arrange([task()])
    renderBoard()
    await screen.findByText('Confirmar decoração')

    expect(screen.queryByLabelText(/Mover/)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /Mover/ })).not.toBeInTheDocument()
  })

  describe('arrastar e soltar', () => {
    it('moves the card at once and confirms with the API, without reloading the board', async () => {
      const pendingTask = task({ status: 'PENDENTE' })
      arrange([pendingTask])
      let resolve!: (value: Task) => void
      vi.mocked(updateTaskStatus).mockReturnValue(new Promise((done) => { resolve = done }))
      renderBoard()
      await screen.findByText('Confirmar decoração')

      await drag('task-1', 'Confirmar decoração', 'EM_ANDAMENTO')

      // Atualização otimista: o card já está na coluna de destino enquanto a API responde.
      expect(within(column('Em andamento')).getByText('Confirmar decoração')).toBeInTheDocument()
      expect(within(column('Em andamento')).getByRole('status', { name: 'Salvando' })).toBeInTheDocument()
      expect(updateTaskStatus).toHaveBeenCalledWith('task-1', 'EM_ANDAMENTO')

      await act(async () => { resolve({ ...pendingTask, status: 'EM_ANDAMENTO' }) })
      expect(await screen.findByText('Tarefa movida para Em andamento.')).toBeInTheDocument()
      expect(listTasks).toHaveBeenCalledTimes(1)
    })

    it('refuses Pendente → Concluída with visual feedback and keeps the card in its column', async () => {
      arrange([task({ status: 'PENDENTE' })])
      renderBoard()
      await screen.findByText('Confirmar decoração')

      await drag('task-1', 'Confirmar decoração', 'CONCLUIDA')

      expect(updateTaskStatus).not.toHaveBeenCalled()
      expect(screen.getByText('Inicie a tarefa antes de concluir: mova primeiro para Em andamento.')).toBeInTheDocument()
      const card = within(column('Pendente')).getByText('Confirmar decoração').closest('article')
      expect(card).toHaveClass('is-rejected')
    })

    it('lets an in-progress task go back to Pendente', async () => {
      const running = task({ status: 'EM_ANDAMENTO' })
      arrange([running])
      vi.mocked(updateTaskStatus).mockResolvedValue({ ...running, status: 'PENDENTE' })
      renderBoard()
      await screen.findByText('Confirmar decoração')

      await drag('task-1', 'Confirmar decoração', 'PENDENTE')

      expect(updateTaskStatus).toHaveBeenCalledWith('task-1', 'PENDENTE')
      expect(within(column('Pendente')).getByText('Confirmar decoração')).toBeInTheDocument()
    })

    it('returns the card to its origin and explains when the API refuses the move', async () => {
      arrange([task({ status: 'PENDENTE' })])
      vi.mocked(updateTaskStatus).mockRejectedValue(new Error('Em eventos concluídos ou cancelados, as tarefas em aberto só podem ser canceladas'))
      renderBoard()
      await screen.findByText('Confirmar decoração')

      await drag('task-1', 'Confirmar decoração', 'EM_ANDAMENTO')

      expect(await screen.findByText('Em eventos concluídos ou cancelados, as tarefas em aberto só podem ser canceladas. A tarefa voltou para Pendente.')).toBeInTheDocument()
      expect(within(column('Pendente')).getByText('Confirmar decoração')).toBeInTheDocument()
      expect(within(column('Em andamento')).queryByText('Confirmar decoração')).not.toBeInTheDocument()
    })

    it('asks for confirmation before cancelling and only then calls the API', async () => {
      const pendingTask = task()
      arrange([pendingTask])
      vi.mocked(updateTaskStatus).mockResolvedValue({ ...pendingTask, status: 'CANCELADA' })
      renderBoard()
      await screen.findByText('Confirmar decoração')

      await drag('task-1', 'Confirmar decoração', 'CANCELADA')
      const confirm = screen.getByRole('alertdialog', { name: 'Cancelar a tarefa?' })
      expect(updateTaskStatus).not.toHaveBeenCalled()

      fireEvent.click(within(confirm).getByRole('button', { name: 'Voltar' }))
      expect(updateTaskStatus).not.toHaveBeenCalled()

      await drag('task-1', 'Confirmar decoração', 'CANCELADA')
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancelar tarefa' })) })
      expect(updateTaskStatus).toHaveBeenCalledWith('task-1', 'CANCELADA')
      expect(within(column('Cancelada')).getByText('Confirmar decoração')).toBeInTheDocument()
    })

    it('ignores a drop outside the columns or on the same column', async () => {
      arrange([task()])
      renderBoard()
      await screen.findByText('Confirmar decoração')

      await drag('task-1', 'Confirmar decoração', null)
      await drag('task-1', 'Confirmar decoração', 'PENDENTE')
      act(() => { dnd.onDragCancel?.({} as never) })

      expect(updateTaskStatus).not.toHaveBeenCalled()
    })

    it('highlights the allowed columns and explains the blocked ones while dragging', async () => {
      arrange([task({ status: 'PENDENTE' })])
      renderBoard()
      await screen.findByText('Confirmar decoração')

      act(() => { dnd.onDragStart?.({ active: { id: 'task-1', data: { current: { title: 'Confirmar decoração' } } } } as never) })

      expect(column('Em andamento')).toHaveClass('is-allowed')
      expect(within(column('Em andamento')).getByText('Solte aqui para mover')).toBeInTheDocument()
      expect(column('Concluída')).toHaveClass('is-blocked')
      expect(within(column('Concluída')).getByText('Inicie a tarefa antes de concluir: mova primeiro para Em andamento.')).toBeInTheDocument()
      expect(column('Pendente')).not.toHaveClass('is-allowed')
    })

    it('announces the drag in Portuguese for screen readers', () => {
      arrange([])
      renderBoard()
      const announcements = dnd.accessibility?.announcements
      const active = { id: 'task-1', data: { current: { title: 'Montar bar' } } }

      expect(announcements?.onDragStart({ active } as never)).toBe('Tarefa Montar bar selecionada.')
      expect(announcements?.onDragOver({ active, over: { id: 'EM_ANDAMENTO' } } as never)).toBe('Sobre a coluna Em andamento.')
      expect(announcements?.onDragOver({ active, over: null } as never)).toBe('Fora das colunas.')
      expect(announcements?.onDragEnd({ active, over: { id: 'CONCLUIDA' } } as never)).toBe('Tarefa Montar bar solta na coluna Concluída.')
      expect(announcements?.onDragEnd({ active, over: null } as never)).toBe('Tarefa Montar bar solta fora das colunas.')
      expect(announcements?.onDragCancel({ active } as never)).toBe('Movimento de Montar bar cancelado.')
    })
  })

  describe('detalhe da tarefa', () => {
    it('opens the detail when clicking the card and moves from there', async () => {
      const pendingTask = task()
      arrange([pendingTask])
      vi.mocked(updateTaskStatus).mockResolvedValue({ ...pendingTask, status: 'EM_ANDAMENTO' })
      renderBoard()

      fireEvent.click(await screen.findByRole('button', { name: 'Confirmar decoração' }))
      const dialog = screen.getByRole('dialog', { name: 'Confirmar decoração' })
      await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Em andamento' })) })

      expect(updateTaskStatus).toHaveBeenCalledWith('task-1', 'EM_ANDAMENTO')
      expect(within(screen.getByRole('dialog')).getAllByText('Em andamento').length).toBeGreaterThan(0)
    })

    it('updates the card after the description is saved in the detail', async () => {
      arrange([task()])
      vi.mocked(updateTask).mockResolvedValue(task({ description: 'Ligar para a noiva' }))
      renderBoard()

      fireEvent.click(await screen.findByRole('button', { name: 'Confirmar decoração' }))
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar descrição' }))
      fireEvent.change(screen.getByLabelText('Descrição da tarefa'), { target: { value: 'Ligar para a noiva' } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar descrição' }))

      await waitFor(() => expect(screen.queryByLabelText('Descrição da tarefa')).not.toBeInTheDocument())
      expect(within(screen.getByRole('dialog')).getByText('Ligar para a noiva')).toBeInTheDocument()
      expect(screen.getByText('Descrição salva.')).toBeInTheDocument()
    })

    it('opens the full edit form from the detail', async () => {
      arrange([task()])
      vi.mocked(updateTask).mockResolvedValue(task({ title: 'Confirmar decoração', description: 'Nova descrição' }))
      renderBoard()

      fireEvent.click(await screen.findByRole('button', { name: 'Confirmar decoração' }))
      fireEvent.click(screen.getByRole('button', { name: 'Editar tarefa' }))
      expect(screen.getByRole('heading', { name: 'Editar tarefa' })).toBeInTheDocument()
      fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Nova descrição' } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
      await waitFor(() => expect(updateTask).toHaveBeenCalledWith('task-1', { description: 'Nova descrição' }))
    })

    it('deletes after confirmation, closes the detail and removes the card', async () => {
      arrange([task({ sourceRuleId: 'rule-1' })])
      vi.mocked(removeTask).mockResolvedValue(undefined)
      renderBoard()

      fireEvent.click(await screen.findByRole('button', { name: 'Confirmar decoração' }))
      fireEvent.click(screen.getByRole('button', { name: 'Excluir tarefa' }))
      const confirm = screen.getByRole('alertdialog', { name: 'Excluir a tarefa?' })
      expect(confirm).toHaveTextContent('Ela foi gerada por uma regra e não será recriada.')
      await act(async () => { fireEvent.click(within(confirm).getByRole('button', { name: 'Excluir' })) })

      expect(removeTask).toHaveBeenCalledWith('task-1')
      await waitFor(() => expect(screen.queryByText('Confirmar decoração')).not.toBeInTheDocument())
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('keeps the card and shows the API error when deleting fails', async () => {
      arrange([task()])
      vi.mocked(removeTask).mockRejectedValue(new Error('Tarefas concluídas ou canceladas não podem ser excluídas'))
      renderBoard()

      fireEvent.click(await screen.findByRole('button', { name: 'Confirmar decoração' }))
      fireEvent.click(screen.getByRole('button', { name: 'Excluir tarefa' }))
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Excluir' })) })

      expect(await screen.findByText('Tarefas concluídas ou canceladas não podem ser excluídas')).toBeInTheDocument()
      expect(screen.getAllByText('Confirmar decoração').length).toBeGreaterThan(0)
    })
  })

  describe('filtros', () => {
    it('filters by event and by team from the three-dots menu and clears them', async () => {
      arrange([
        task({ id: 'task-1', title: 'Decoração do casamento', eventId: 'event-1', assignedTeamId: 'team-1' }),
        task({ id: 'task-2', title: 'Bar da formatura', eventId: 'event-2' }),
      ], [event, otherEvent])
      renderBoard()
      await screen.findByText('Decoração do casamento')

      fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))
      fireEvent.change(screen.getByLabelText('Evento'), { target: { value: 'event-2' } })
      expect(screen.queryByText('Decoração do casamento')).not.toBeInTheDocument()
      expect(screen.getByText('Bar da formatura')).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('Evento'), { target: { value: '' } })
      fireEvent.change(screen.getByLabelText('Equipe'), { target: { value: 'team-1' } })
      expect(screen.getByText('Decoração do casamento')).toBeInTheDocument()
      expect(screen.queryByText('Bar da formatura')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
      expect(screen.getByText('Bar da formatura')).toBeInTheDocument()
    })

    it('searches by event name or task title', async () => {
      arrange([task({ id: 'task-1', title: 'Montar mesas' }), task({ id: 'task-2', title: 'Bar da formatura', eventId: 'event-2' })], [event, otherEvent])
      renderBoard()
      await screen.findByText('Montar mesas')

      fireEvent.change(screen.getByLabelText('Buscar por evento ou tarefa'), { target: { value: 'formatura' } })
      expect(screen.queryByText('Montar mesas')).not.toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('Buscar por evento ou tarefa'), { target: { value: 'mesas' } })
      expect(screen.getByText('Montar mesas')).toBeInTheDocument()
      expect(screen.queryByText('Bar da formatura')).not.toBeInTheDocument()
    })
  })

  it('flags open tasks past their deadline and summarises the board', async () => {
    arrange([
      task({ id: 'task-1', title: 'Tarefa vencida', status: 'EM_ANDAMENTO', dueDate: '2020-01-01T12:00:00.000Z' }),
      task({ id: 'task-2', title: 'Tarefa no prazo', status: 'PENDENTE', dueDate: '2999-01-01T12:00:00.000Z', assignedTeamId: 'team-1' }),
      task({ id: 'task-3', title: 'Concluída com atraso', status: 'CONCLUIDA', dueDate: '2020-01-01T12:00:00.000Z', assignedTeamId: 'team-1' }),
    ])
    renderBoard()
    await screen.findByText('Tarefa vencida')

    expect(screen.getAllByText(/^Atrasada · /)).toHaveLength(1)
    expect(screen.getByText(/^Atrasada · /).closest('.task-chip')).toHaveClass('is-overdue')
    expect(screen.getByText('3 tarefas · 1 atrasada · 1 sem equipe')).toBeInTheDocument()
  })

  // RFC 3.1.1: a sequência de execução vem do prazo de cada tarefa.
  it('orders each column by deadline, with tasks without a deadline last', async () => {
    arrange([
      task({ id: 'task-1', title: 'Sem prazo', dueDate: null }),
      task({ id: 'task-2', title: 'Prazo depois', dueDate: '2026-11-09T12:00:00.000Z' }),
      task({ id: 'task-3', title: 'Prazo antes', dueDate: '2026-11-05T12:00:00.000Z' }),
    ])
    renderBoard()
    await screen.findByText('Sem prazo')

    const titles = within(column('Pendente')).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(titles).toEqual(['Prazo antes', 'Prazo depois', 'Sem prazo'])
  })

  it('shows the team, the rule badge and a visual indicator for a task with no team', async () => {
    arrange([
      task({ id: 'task-1', title: 'Sem dono', assignedTeamId: null }),
      task({ id: 'task-2', title: 'Com equipe', assignedTeamId: 'team-1', sourceRuleId: 'rule-1' }),
    ])
    renderBoard()
    await screen.findByText('Sem dono')

    expect(screen.getByText('Sem equipe')).toBeInTheDocument()
    expect(screen.getByText('Equipe Cozinha A')).toBeInTheDocument()
    expect(screen.getByText('Regra')).toBeInTheDocument()
  })

  it('cria uma tarefa pelo botão "Nova tarefa" e a mostra na coluna Pendente', async () => {
    arrange([])
    vi.mocked(createTask).mockResolvedValue(task({ id: 'new', title: 'Montar mesas' }))
    renderBoard()
    fireEvent.click(await screen.findByRole('button', { name: 'Nova tarefa' }))
    fireEvent.change(screen.getByLabelText('Evento'), { target: { value: 'event-1' } })
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Montar mesas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }))
    await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'event-1', title: 'Montar mesas' })))
    expect(within(await screen.findByRole('region', { name: 'Pendente' })).getByText('Montar mesas')).toBeInTheDocument()
  })

  it('colaborador: sem equipes nem criação, mas abre o detalhe para mover e comentar', async () => {
    permissions = ['tasks:list', 'tasks:read', 'tasks:update-status', 'tasks:comment']
    arrange([task()])
    renderBoard()
    await screen.findByText('Confirmar decoração')

    expect(screen.queryByRole('button', { name: 'Nova tarefa' })).not.toBeInTheDocument()
    // Sem teams:list, o quadro não consulta equipes nem oferece o filtro (antes a tela inteira falhava com 403).
    expect(listTeams).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    expect(screen.queryByLabelText('Equipe')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar decoração' }))
    expect(screen.getByRole('group', { name: 'Mover para' })).toBeInTheDocument()
    expect(screen.getByLabelText('Novo comentário')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar tarefa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir tarefa' })).not.toBeInTheDocument()
  })

  it('keeps the optimistic status when a polling round returns before the move is saved', async () => {
    const pendingTask = task()
    arrange([pendingTask])
    let resolve!: (value: Task) => void
    vi.mocked(updateTaskStatus).mockReturnValue(new Promise((done) => { resolve = done }))
    renderBoard()
    await screen.findByText('Confirmar decoração')

    await drag('task-1', 'Confirmar decoração', 'EM_ANDAMENTO')
    vi.mocked(listTasks).mockResolvedValueOnce([pendingTask])
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Atualizar agora' })) })

    expect(within(column('Em andamento')).getByText('Confirmar decoração')).toBeInTheDocument()
    await act(async () => { resolve({ ...pendingTask, status: 'EM_ANDAMENTO' }) })
  })
})
