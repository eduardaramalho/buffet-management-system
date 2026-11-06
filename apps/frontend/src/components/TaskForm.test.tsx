import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskForm } from './TaskForm'
import { createTask, updateTask } from '../api/tasksApi'
import { listTeamsByEvent } from '../api/teamsApi'
import type { Task } from '../types/task'
import type { Event } from '../types/event'
import type { Team } from '../types/team'

vi.mock('../api/tasksApi', () => ({ createTask: vi.fn(), updateTask: vi.fn() }))
vi.mock('../api/teamsApi', () => ({ listTeamsByEvent: vi.fn() }))

const baseEvent = { endDate: null, location: 'Salão', serviceType: 'CASAMENTO' as const, guestsCount: 100, observations: null, createdById: 'u', createdAt: '', updatedAt: '', deletedAt: null, services: [], clientId: null, client: null }
const events: Event[] = [
  { ...baseEvent, id: 'event-1', name: 'Casamento Ana', eventDate: '2026-11-10T15:00:00.000Z', status: 'CONFIRMADO' },
  { ...baseEvent, id: 'event-2', name: 'Formatura Beto', eventDate: '2026-12-01T15:00:00.000Z', status: 'PLANEJAMENTO' },
  { ...baseEvent, id: 'event-3', name: 'Evento concluído', eventDate: '2026-01-01T15:00:00.000Z', status: 'CONCLUIDO' },
  { ...baseEvent, id: 'event-4', name: 'Evento cancelado', eventDate: '2026-02-01T15:00:00.000Z', status: 'CANCELADO' },
]
const team = (id: string, name: string, status: Team['status'] = 'ATIVA'): Team => ({ id, name, specialty: 'COZINHA', status, observations: null, createdById: 'a', createdAt: '', updatedAt: '', deletedAt: null, members: [], events: [] })
const teams = [team('team-1', 'Equipe Cozinha A'), team('team-2', 'Equipe Bar'), team('team-3', 'Equipe Inativa', 'INATIVA')]
const allocation = (teamId: string) => ({ eventId: 'event-1', teamId, assignedAt: '', assignedById: 'a' })
const task = (overrides: Partial<Task> = {}): Task => ({ id: 'task-1', eventId: 'event-1', title: 'Confirmar decoração', description: 'Detalhes', dueDate: null, status: 'PENDENTE', assignedTeamId: null, assignedAt: null, sourceRuleId: null, createdAt: '', updatedAt: '', deletedAt: null, ...overrides })

const save = () => fireEvent.click(screen.getByRole('button', { name: /^Salvar (tarefa|alterações)$/ }))
const setup = (props: Partial<Parameters<typeof TaskForm>[0]> = {}) => {
  const onClose = vi.fn(); const onSaved = vi.fn()
  render(<TaskForm events={events} teams={teams} onClose={onClose} onSaved={onSaved} {...props} />)
  return { onClose, onSaved }
}

describe('TaskForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listTeamsByEvent).mockResolvedValue([allocation('team-1'), allocation('team-3')])
  })

  it('lista só eventos não terminais ao criar', () => {
    setup()
    const options = screen.getAllByRole('option').map((option) => option.textContent)
    expect(options).toContain('Casamento Ana')
    expect(options).toContain('Formatura Beto')
    expect(options).not.toContain('Evento concluído')
    expect(options).not.toContain('Evento cancelado')
  })

  it('exige evento e título antes de chamar a API', async () => {
    setup()
    save()
    expect(await screen.findByText('Selecione o evento.')).toBeInTheDocument()
    expect(screen.getByText('Informe o título da tarefa.')).toBeInTheDocument()
    expect(screen.getByLabelText('Evento')).toHaveFocus()
    fireEvent.change(screen.getByLabelText('Evento'), { target: { value: 'event-1' } })
    save()
    expect(await screen.findByText('Informe o título da tarefa.')).toBeInTheDocument()
    expect(createTask).not.toHaveBeenCalled()
  })

  it('mostra o sucesso só quando algo foi salvo', async () => {
    vi.mocked(createTask).mockResolvedValue(task())
    const { onSaved } = setup({ defaultEventId: 'event-1' })
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Montar mesas' } })
    save()
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it('rejeita título acima de 150 caracteres', async () => {
    setup()
    fireEvent.change(screen.getByLabelText('Evento'), { target: { value: 'event-1' } })
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'a'.repeat(151) } })
    save()
    expect(await screen.findByText('Use no máximo 150 caracteres.')).toBeInTheDocument()
    expect(createTask).not.toHaveBeenCalled()
  })

  it('só oferece equipes ativas vinculadas ao evento escolhido', async () => {
    setup()
    expect(screen.getByLabelText('Equipe')).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Evento'), { target: { value: 'event-1' } })
    await waitFor(() => expect(listTeamsByEvent).toHaveBeenCalledWith('event-1'))
    const options = await screen.findAllByRole('option', { name: 'Equipe Cozinha A' })
    expect(options).toHaveLength(1)
    expect(screen.queryByRole('option', { name: 'Equipe Bar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Equipe Inativa' })).not.toBeInTheDocument()
  })

  it('ignora a resposta atrasada de um evento anterior ao trocar de evento', async () => {
    let resolveFirst: (value: Awaited<ReturnType<typeof listTeamsByEvent>>) => void = () => {}
    vi.mocked(listTeamsByEvent).mockImplementation((eventId: string) => eventId === 'event-1'
      ? new Promise((resolve) => { resolveFirst = resolve })
      : Promise.resolve([{ ...allocation('team-2'), eventId: 'event-2' }]))
    setup()
    fireEvent.change(screen.getByLabelText('Evento'), { target: { value: 'event-1' } })
    fireEvent.change(screen.getByLabelText('Evento'), { target: { value: 'event-2' } })
    expect(await screen.findByRole('option', { name: 'Equipe Bar' })).toBeInTheDocument()
    resolveFirst([allocation('team-1')])
    await waitFor(() => expect(screen.getByRole('option', { name: 'Equipe Bar' })).toBeInTheDocument())
    expect(screen.queryByRole('option', { name: 'Equipe Cozinha A' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Equipe')).toBeEnabled()
  })

  it('avisa quando o evento não tem equipes alocadas', async () => {
    vi.mocked(listTeamsByEvent).mockResolvedValue([])
    setup()
    fireEvent.change(screen.getByLabelText('Evento'), { target: { value: 'event-1' } })
    expect(await screen.findByText('Nenhuma equipe ativa alocada a este evento.')).toBeInTheDocument()
  })

  it('cria a tarefa com os dados normalizados', async () => {
    const created = task({ id: 'new' })
    vi.mocked(createTask).mockResolvedValue(created)
    const { onSaved, onClose } = setup()
    fireEvent.change(screen.getByLabelText('Evento'), { target: { value: 'event-1' } })
    await screen.findByRole('option', { name: 'Equipe Cozinha A' })
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: '  Montar mesas  ' } })
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Prazo'), { target: { value: '2026-11-08' } })
    fireEvent.change(screen.getByLabelText('Equipe'), { target: { value: 'team-1' } })
    save()

    await waitFor(() => expect(createTask).toHaveBeenCalledTimes(1))
    const payload = vi.mocked(createTask).mock.calls[0][0]
    expect(payload).toMatchObject({ eventId: 'event-1', title: 'Montar mesas', assignedTeamId: 'team-1' })
    expect(payload.description).toBeUndefined()
    expect(new Date(payload.dueDate as string).getFullYear()).toBe(2026)
    expect(new Date(payload.dueDate as string).getDate()).toBe(8)
    expect(onSaved).toHaveBeenCalledWith(created)
    expect(onClose).toHaveBeenCalled()
  })

  it('mostra a mensagem da API quando a criação falha', async () => {
    vi.mocked(createTask).mockRejectedValue(new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, { status: 400, data: { message: 'Aloque a equipe ao evento antes de atribuí-la à tarefa' } } as never))
    const { onSaved } = setup({ defaultEventId: 'event-1' })
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Montar mesas' } })
    save()
    expect(await screen.findByRole('alert')).toHaveTextContent('Aloque a equipe ao evento antes de atribuí-la à tarefa')
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('edita enviando só o que mudou e permite desatribuir a equipe', async () => {
    vi.mocked(updateTask).mockResolvedValue(task({ assignedTeamId: null }))
    const { onSaved } = setup({ task: task({ assignedTeamId: 'team-1', description: 'Detalhes' }) })
    expect(screen.getByLabelText('Evento')).toBeDisabled()
    await screen.findByRole('option', { name: 'Equipe Cozinha A' })
    fireEvent.change(screen.getByLabelText('Equipe'), { target: { value: '' } })
    save()
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith('task-1', { assignedTeamId: null }))
    expect(onSaved).toHaveBeenCalled()
  })

  it('não altera o título de tarefa gerada por regra e explica o motivo', async () => {
    setup({ task: task({ sourceRuleId: 'rule-1' }) })
    expect(screen.getByLabelText('Título')).toBeDisabled()
    expect(screen.getByText('Tarefa gerada por regra: o evento e o título não podem ser alterados.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Editar tarefa' })).toHaveTextContent('Casamento Ana')
    expect(screen.getByText('Pendente')).toBeInTheDocument()
  })

  it('fecha sem chamar a API quando nada mudou', async () => {
    const { onClose } = setup({ task: task() })
    await waitFor(() => expect(listTeamsByEvent).toHaveBeenCalled())
    save()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(updateTask).not.toHaveBeenCalled()
  })
})
