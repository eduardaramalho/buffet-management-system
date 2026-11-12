import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskDetailDialog, type TaskDetailPermissions } from './TaskDetailDialog'
import { createTaskComment, listTaskComments, updateTask } from '../../api/tasksApi'
import type { Task } from '../../types/task'

vi.mock('../../api/tasksApi', () => ({ listTaskComments: vi.fn(), createTaskComment: vi.fn(), updateTask: vi.fn() }))

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  eventId: 'event-1',
  title: 'Confirmar cardápio',
  description: null,
  dueDate: '2026-11-12T15:00:00.000Z',
  status: 'PENDENTE',
  assignedTeamId: 'team-1',
  sourceRuleId: 'rule-1',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  deletedAt: null,
  ...overrides,
})
const event = { name: 'Casamento Ana', eventDate: '2026-11-14T15:00:00.000Z', status: 'CONFIRMADO' }
const comment = { id: 'c1', taskId: 'task-1', authorId: 'u1', authorName: 'Marina Costa', body: 'Noiva pediu massa fresca.', createdAt: '2026-11-07T21:20:00.000Z' }
const all: TaskDetailPermissions = { move: true, editDetails: true, delete: true, comment: true }

const renderDialog = (overrides: Partial<Parameters<typeof TaskDetailDialog>[0]> = {}) => {
  const props = {
    task: task(),
    event,
    teamName: 'Cozinha',
    permissions: all,
    saving: false,
    onClose: vi.fn(),
    onMove: vi.fn(),
    onTaskUpdated: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  }
  render(<TaskDetailDialog {...props} />)
  return props
}

describe('TaskDetailDialog', () => {
  beforeEach(() => {
    // Relógio fixo antes do prazo da tarefa: com a data real, o teste passava a ver "(atrasada)" depois de 12/11/2026.
    // Só o Date é falso; os timers reais continuam servindo ao waitFor.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T12:00:00.000Z'))
    vi.clearAllMocks()
    vi.mocked(listTaskComments).mockResolvedValue([comment])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the task, its origin, event, team and deadline', async () => {
    renderDialog()

    const dialog = screen.getByRole('dialog', { name: 'Confirmar cardápio' })
    expect(within(dialog).getByText('Pendente')).toBeInTheDocument()
    expect(within(dialog).getByText('Gerada pelo motor de regras')).toBeInTheDocument()
    expect(within(dialog).getByText('Casamento Ana · 14/11/2026')).toBeInTheDocument()
    expect(within(dialog).getByText('Cozinha')).toBeInTheDocument()
    expect(within(dialog).getByText('12/11/2026')).toBeInTheDocument()
    expect(await within(dialog).findByText('Noiva pediu massa fresca.')).toBeInTheDocument()
    expect(listTaskComments).toHaveBeenCalledWith('task-1')
  })

  it('offers only the valid next statuses as an alternative to dragging (ADR 0014)', () => {
    const { onMove } = renderDialog()

    const moves = within(screen.getByRole('group', { name: 'Mover para' })).getAllByRole('button').map((button) => button.textContent)
    expect(moves).toEqual(['Em andamento', 'Cancelada'])

    fireEvent.click(screen.getByRole('button', { name: 'Em andamento' }))
    expect(onMove).toHaveBeenCalledWith('EM_ANDAMENTO')
  })

  it('disables the moves while a status change is being saved', () => {
    renderDialog({ saving: true })

    expect(screen.getByRole('button', { name: 'Em andamento' })).toBeDisabled()
  })

  it('explains that a terminal task no longer changes status and hides edit and delete', () => {
    renderDialog({ task: task({ status: 'CONCLUIDA' }) })

    expect(screen.getByText('Tarefa encerrada: o status não muda mais.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar tarefa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir tarefa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Adicionar descrição' })).not.toBeInTheDocument()
  })

  it('adds a description and reports the updated task', async () => {
    vi.mocked(updateTask).mockResolvedValue(task({ description: 'Ligar para a noiva' }))
    const { onTaskUpdated } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar descrição' }))
    const save = screen.getByRole('button', { name: 'Salvar descrição' })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Descrição da tarefa'), { target: { value: '  Ligar para a noiva  ' } })
    fireEvent.click(save)

    await waitFor(() => expect(updateTask).toHaveBeenCalledWith('task-1', { description: 'Ligar para a noiva' }))
    expect(onTaskUpdated).toHaveBeenCalledWith(task({ description: 'Ligar para a noiva' }))
    expect(screen.queryByLabelText('Descrição da tarefa')).not.toBeInTheDocument()
  })

  it('edits an existing description, clears it to null and can cancel', async () => {
    vi.mocked(updateTask).mockResolvedValue(task({ description: null }))
    renderDialog({ task: task({ description: 'Texto antigo' }) })

    fireEvent.click(screen.getByRole('button', { name: 'Editar descrição' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByText('Texto antigo')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Editar descrição' }))
    fireEvent.change(screen.getByLabelText('Descrição da tarefa'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar descrição' }))

    await waitFor(() => expect(updateTask).toHaveBeenCalledWith('task-1', { description: null }))
  })

  it('keeps the editor open and shows the API error when saving the description fails', async () => {
    vi.mocked(updateTask).mockRejectedValue(new Error('Tarefas concluídas ou canceladas não podem ser editadas'))
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar descrição' }))
    fireEvent.change(screen.getByLabelText('Descrição da tarefa'), { target: { value: 'Nova' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar descrição' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Tarefas concluídas ou canceladas não podem ser editadas')
    expect(screen.getByLabelText('Descrição da tarefa')).toHaveValue('Nova')
  })

  it('posts a trimmed comment and appends it to the list', async () => {
    vi.mocked(listTaskComments).mockResolvedValue([])
    vi.mocked(createTaskComment).mockResolvedValue({ ...comment, id: 'c2', body: 'Já separei os pratos.' })
    renderDialog()

    expect(await screen.findByText('Nenhum comentário ainda.')).toBeInTheDocument()
    const send = screen.getByRole('button', { name: 'Comentar' })
    expect(send).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Novo comentário'), { target: { value: '  Já separei os pratos.  ' } })
    fireEvent.click(send)

    await waitFor(() => expect(createTaskComment).toHaveBeenCalledWith('task-1', 'Já separei os pratos.'))
    expect(await screen.findByText('Já separei os pratos.')).toBeInTheDocument()
    expect(screen.getByLabelText('Novo comentário')).toHaveValue('')
    expect(screen.getByRole('heading', { name: 'Comentários (1)' })).toBeInTheDocument()
  })

  it('shows an error when the comments cannot be loaded or posted', async () => {
    vi.mocked(listTaskComments).mockRejectedValue(new Error('rede'))
    vi.mocked(createTaskComment).mockRejectedValue(new Error('Dados inválidos'))
    renderDialog()

    expect(await screen.findByText('Não foi possível carregar os comentários.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Novo comentário'), { target: { value: 'Oi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Comentar' }))
    expect(await screen.findByText('Dados inválidos')).toBeInTheDocument()
  })

  it('respects the permissions of the colaborador: moves and comments, no edit or delete', async () => {
    renderDialog({ permissions: { move: true, editDetails: false, delete: false, comment: true } })

    await screen.findByText('Noiva pediu massa fresca.')
    expect(screen.queryByRole('button', { name: 'Adicionar descrição' })).not.toBeInTheDocument()
    expect(screen.getByText('Sem descrição.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar tarefa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir tarefa' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Novo comentário')).toBeInTheDocument()
  })

  it('hides the comment box and the moves without their permissions', async () => {
    renderDialog({ permissions: { move: false, editDetails: false, delete: false, comment: false } })

    await screen.findByText('Noiva pediu massa fresca.')
    expect(screen.queryByLabelText('Novo comentário')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Mover para' })).not.toBeInTheDocument()
  })

  it('opens the full edit form, asks to delete and closes', () => {
    const { onEdit, onDelete, onClose } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Editar tarefa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir tarefa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar detalhe' }))

    expect(onEdit).toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('closes with Escape and shows the fallbacks for a manual task without team or deadline', () => {
    const { onClose } = renderDialog({ task: task({ sourceRuleId: null, assignedTeamId: null, dueDate: null }), teamName: undefined, event: undefined })

    expect(screen.getByText('Criada manualmente')).toBeInTheDocument()
    expect(screen.getByText('Sem equipe')).toBeInTheDocument()
    expect(screen.getByText('Sem prazo')).toBeInTheDocument()
    expect(screen.getByText('Evento não encontrado')).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
