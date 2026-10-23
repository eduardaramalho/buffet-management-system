import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReplicateEventDialog } from './ReplicateEventDialog'
import { getReplicationPreview, replicateEvent } from '../api/eventsApi'
import { listServices } from '../api/servicesApi'
import { listClients } from '../api/clientsApi'
import type { Event } from '../types/event'
import type { ReplicationPreview } from '../types/replication'

vi.mock('../api/eventsApi', () => ({ getReplicationPreview: vi.fn(), replicateEvent: vi.fn() }))
vi.mock('../api/servicesApi', () => ({ listServices: vi.fn() }))
vi.mock('../api/clientsApi', () => ({ listClients: vi.fn() }))

const local = (year: number, month: number, day: number, hour = 0, minute = 0) => new Date(year, month - 1, day, hour, minute).toISOString()

const services = [
  { id: 'service-bar', name: 'Bar', isCustom: false, createdAt: '', deletedAt: null },
  { id: 'service-outro', name: 'Outro', isCustom: true, createdAt: '', deletedAt: null },
  { id: 'service-deco', name: 'Decoração', isCustom: false, createdAt: '', deletedAt: null },
]
const clients = [
  { id: 'client-1', type: 'PF' as const, name: 'Ana Souza', document: null, email: null, phone: null, notes: null, createdAt: '', updatedAt: '', deletedAt: null },
  { id: 'client-2', type: 'PF' as const, name: 'Bruna Lima', document: null, email: null, phone: null, notes: null, createdAt: '', updatedAt: '', deletedAt: null },
]

const source: Event = {
  id: 'source-1', name: 'Casamento de Alice', eventDate: local(2026, 6, 20, 18), endDate: null, location: 'Salão Principal', serviceType: 'CASAMENTO',
  guestsCount: 180, observations: 'Sem glúten', status: 'CONCLUIDO', createdById: 'actor', createdAt: '', updatedAt: '', deletedAt: null,
  services: [
    { serviceId: 'service-bar', customLabel: null, service: services[0] },
    { serviceId: 'service-outro', customLabel: 'Fotógrafo', service: services[1] },
  ],
  clientId: 'client-1', client: { id: 'client-1', name: 'Ana Souza', email: null, phone: null, deletedAt: null },
}

const makePreview = (overrides: Partial<ReplicationPreview> = {}): ReplicationPreview => ({
  source: { id: 'source-1', name: 'Casamento de Alice', status: 'CONCLUIDO', eventDate: source.eventDate, endDate: null },
  draft: { location: 'Salão Principal', serviceType: 'CASAMENTO', guestsCount: 180, observations: 'Sem glúten', clientId: 'client-1', services: [] },
  warnings: [],
  tasks: [
    { sourceTaskId: 'task-1', title: 'Confirmar flores', description: null, sourceStatus: 'CONCLUIDA', originalDueDate: local(2026, 6, 13, 9, 30), dueDate: local(2026, 12, 5, 9, 30), dueDateInPast: false, assignedTeamId: 'team-deco', selected: true },
    { sourceTaskId: 'task-2', title: 'Reunião com noivos', description: null, sourceStatus: 'PENDENTE', originalDueDate: null, dueDate: null, dueDateInPast: false, assignedTeamId: null, selected: true },
    { sourceTaskId: 'task-3', title: 'Degustação extra', description: null, sourceStatus: 'CANCELADA', originalDueDate: local(2026, 6, 1, 15), dueDate: local(2026, 11, 22, 15), dueDateInPast: true, assignedTeamId: null, selected: false },
  ],
  teams: [
    { teamId: 'team-deco', name: 'Decoração A', specialty: 'DECORACAO', available: true, reason: null, conflictingEvent: null },
    { teamId: 'team-bar', name: 'Bar 1', specialty: 'BAR', available: false, reason: 'SCHEDULE_CONFLICT', conflictingEvent: { id: 'event-9', name: 'Formatura X' } },
  ],
  ...overrides,
})

const renderDialog = () => {
  const onClose = vi.fn()
  const onReplicated = vi.fn()
  render(<ReplicateEventDialog source={source} onClose={onClose} onReplicated={onReplicated} />)
  return { onClose, onReplicated }
}

const fillNameAndDate = () => {
  fireEvent.change(screen.getByLabelText('Nome do evento'), { target: { value: 'Casamento de Bruna' } })
  fireEvent.change(screen.getByLabelText('Data do evento'), { target: { value: '2026-12-12T18:00' } })
}

const goToReview = async () => {
  await waitFor(() => expect(screen.getByLabelText('Bar')).toBeChecked())
  fillNameAndDate()
  fireEvent.click(screen.getByRole('button', { name: 'Revisar itens copiados' }))
  await screen.findByRole('heading', { name: 'Revise o que será copiado' })
}

describe('ReplicateEventDialog (RF25)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listServices).mockResolvedValue(services)
    vi.mocked(listClients).mockResolvedValue(clients)
    vi.mocked(getReplicationPreview).mockResolvedValue(makePreview())
  })

  it('prefills the copyable data, leaves name and date empty and keeps everything editable', async () => {
    renderDialog()

    expect(screen.getByRole('dialog', { name: 'Replicar evento' })).toBeInTheDocument()
    expect(screen.getByText(/Casamento de Alice/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Bar')).toBeChecked())
    expect(screen.getByLabelText('Nome do evento')).toHaveValue('')
    expect(screen.getByLabelText('Data do evento')).toHaveValue('')
    expect(screen.getByLabelText('Local')).toHaveValue('Salão Principal')
    expect(screen.getByLabelText('Tipo de serviço')).toHaveValue('CASAMENTO')
    expect(screen.getByLabelText('Número de convidados')).toHaveValue(180)
    expect(screen.getByLabelText('Observações')).toHaveValue('Sem glúten')
    expect(screen.getByLabelText('Cliente')).toHaveValue('client-1')
    expect(screen.getByLabelText('Outro')).toBeChecked()
    expect(screen.getByLabelText('Especifique...')).toHaveValue('Fotógrafo')
    expect(screen.getByLabelText('Decoração')).not.toBeChecked()

    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'client-2' } })
    fireEvent.change(screen.getByLabelText('Local'), { target: { value: 'Salão Jardim' } })
    expect(screen.getByLabelText('Cliente')).toHaveValue('client-2')
    expect(screen.getByLabelText('Local')).toHaveValue('Salão Jardim')
  })

  it('does not preselect an inactive client of the source event', async () => {
    render(<ReplicateEventDialog source={{ ...source, client: { ...source.client!, deletedAt: '2026-08-01T00:00:00.000Z' } }} onClose={vi.fn()} onReplicated={vi.fn()} />)

    await waitFor(() => expect(screen.getByLabelText('Bar')).toBeChecked())
    expect(screen.getByLabelText('Cliente')).toHaveValue('')
  })

  it('requires name and date before building the review', async () => {
    renderDialog()
    await waitFor(() => expect(screen.getByLabelText('Bar')).toBeChecked())

    fireEvent.click(screen.getByRole('button', { name: 'Revisar itens copiados' }))
    expect(await screen.findByText('Informe o nome do novo evento.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Nome do evento'), { target: { value: 'Casamento de Bruna' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar itens copiados' }))
    expect(await screen.findByText('Informe a data do novo evento.')).toBeInTheDocument()
    expect(getReplicationPreview).not.toHaveBeenCalled()
  })

  it('shows the attention step with recalculated deadlines, cancelled and overdue tasks, and unavailable teams', async () => {
    renderDialog()
    await goToReview()

    expect(getReplicationPreview).toHaveBeenCalledWith('source-1', { eventDate: new Date(2026, 11, 12, 18).toISOString(), endDate: null })
    const notice = screen.getByRole('note')
    expect(notice).toHaveTextContent("Confira os itens copiados de 'Casamento de Alice'")
    expect(notice).toHaveTextContent('Tarefas geradas por regras não são copiadas')

    expect(screen.getByLabelText('Copiar tarefa Confirmar flores')).toBeChecked()
    expect(screen.getByLabelText('Prazo da tarefa Confirmar flores')).toHaveValue('2026-12-05T09:30')
    expect(screen.getByLabelText('Copiar tarefa Degustação extra')).not.toBeChecked()
    expect(screen.getByText('Cancelada na origem')).toBeInTheDocument()
    expect(screen.getByText('Prazo já passou')).toBeInTheDocument()

    expect(screen.getByLabelText('Copiar equipe Decoração A')).toBeChecked()
    const busyTeam = screen.getByLabelText('Copiar equipe Bar 1')
    expect(busyTeam).not.toBeChecked()
    expect(busyTeam).toBeDisabled()
    expect(screen.getByText('Conflito com Formatura X')).toBeInTheDocument()
  })

  it('lists the warnings of the preview', async () => {
    vi.mocked(getReplicationPreview).mockResolvedValue(makePreview({ warnings: [{ code: 'CLIENT_UNAVAILABLE' }, { code: 'SERVICE_UNAVAILABLE', serviceId: 'service-old', name: 'Som' }] }))
    renderDialog()
    await goToReview()

    expect(screen.getByText('O cliente do evento de origem não está mais disponível.')).toBeInTheDocument()
    expect(screen.getByText('O serviço Som não está mais disponível e não será copiado.')).toBeInTheDocument()
  })

  it('warns that a task will lose its team when that team is left out', async () => {
    renderDialog()
    await goToReview()
    const flowersRow = screen.getByLabelText('Copiar tarefa Confirmar flores').closest('li') as HTMLElement

    expect(within(flowersRow).queryByText('Ficará sem equipe')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Copiar equipe Decoração A'))
    expect(within(flowersRow).getByText('Ficará sem equipe')).toBeInTheDocument()
  })

  it('updates the overdue warning when the deadline is edited', async () => {
    renderDialog()
    await goToReview()

    fireEvent.change(screen.getByLabelText('Prazo da tarefa Confirmar flores'), { target: { value: '2020-01-01T10:00' } })

    expect(screen.getAllByText('Prazo já passou')).toHaveLength(2)
  })

  it('creates the replica with only the selected items and the edited values, then hands it over', async () => {
    const replica = { ...source, id: 'replica-1', name: 'Casamento de Bruna', status: 'PLANEJAMENTO' as const }
    vi.mocked(replicateEvent).mockResolvedValue(replica)
    const { onReplicated } = renderDialog()
    await waitFor(() => expect(screen.getByLabelText('Bar')).toBeChecked())
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'client-2' } })
    fireEvent.change(screen.getByLabelText('Número de convidados'), { target: { value: '150' } })
    await goToReview()

    fireEvent.change(screen.getByLabelText('Título da tarefa Reunião com noivos'), { target: { value: 'Reunião com noivos (2ª)' } })
    fireEvent.change(screen.getByLabelText('Prazo da tarefa Confirmar flores'), { target: { value: '' } })
    fireEvent.click(screen.getByLabelText('Copiar tarefa Degustação extra'))
    fireEvent.click(screen.getByRole('button', { name: 'Criar evento' }))

    await waitFor(() => expect(onReplicated).toHaveBeenCalledWith(replica))
    expect(replicateEvent).toHaveBeenCalledWith('source-1', {
      name: 'Casamento de Bruna',
      eventDate: new Date(2026, 11, 12, 18).toISOString(),
      endDate: null,
      location: 'Salão Principal',
      serviceType: 'CASAMENTO',
      guestsCount: 150,
      observations: 'Sem glúten',
      clientId: 'client-2',
      services: [{ serviceId: 'service-bar', customLabel: null }, { serviceId: 'service-outro', customLabel: 'Fotógrafo' }],
      tasks: [
        { sourceTaskId: 'task-1', dueDate: null },
        { sourceTaskId: 'task-2', title: 'Reunião com noivos (2ª)' },
        { sourceTaskId: 'task-3' },
      ],
      teamIds: ['team-deco'],
    })
  })

  it('does not submit a copied task with an empty title', async () => {
    renderDialog()
    await goToReview()

    fireEvent.change(screen.getByLabelText('Título da tarefa Reunião com noivos'), { target: { value: '  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar evento' }))

    expect(await screen.findByText('Informe o título de todas as tarefas copiadas.')).toBeInTheDocument()
    expect(replicateEvent).not.toHaveBeenCalled()
  })

  it('on a team conflict (409) explains it and refreshes the teams of the review', async () => {
    const conflict = new AxiosError('Conflict', '409', undefined, undefined, {
      status: 409, statusText: 'Conflict', headers: {}, config: { headers: new AxiosHeaders() },
      data: { message: 'Há equipes indisponíveis para a nova data', conflicts: [{ teamId: 'team-deco', reason: 'SCHEDULE_CONFLICT', conflictingEvent: { id: 'event-7', name: 'Aniversário Y' } }] },
    })
    vi.mocked(replicateEvent).mockRejectedValueOnce(conflict)
    renderDialog()
    await goToReview()
    vi.mocked(getReplicationPreview).mockResolvedValueOnce(makePreview({
      teams: [{ teamId: 'team-deco', name: 'Decoração A', specialty: 'DECORACAO', available: false, reason: 'SCHEDULE_CONFLICT', conflictingEvent: { id: 'event-7', name: 'Aniversário Y' } }],
    }))

    fireEvent.click(screen.getByRole('button', { name: 'Criar evento' }))

    expect(await screen.findByText('Há equipes indisponíveis para a nova data. A revisão foi atualizada: desmarque ou ajuste antes de criar.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Copiar equipe Decoração A')).toBeDisabled())
    expect(screen.getByText('Conflito com Aniversário Y')).toBeInTheDocument()
    expect(getReplicationPreview).toHaveBeenCalledTimes(2)
  })

  it('shows a business error from the API and keeps the review open', async () => {
    vi.mocked(replicateEvent).mockRejectedValueOnce(new Error('Serviço não encontrado'))
    renderDialog()
    await goToReview()

    fireEvent.click(screen.getByRole('button', { name: 'Criar evento' }))

    expect(await screen.findByText('Serviço não encontrado')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Revise o que será copiado' })).toBeInTheDocument()
  })

  it('goes back to the data step keeping what was typed, and closes on cancel', async () => {
    const { onClose } = renderDialog()
    await goToReview()

    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByLabelText('Nome do evento')).toHaveValue('Casamento de Bruna')

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('explains empty task and team lists and a preview failure', async () => {
    vi.mocked(getReplicationPreview).mockResolvedValueOnce(makePreview({ tasks: [], teams: [] }))
    renderDialog()
    await goToReview()

    expect(screen.getByText('Nenhuma tarefa manual para copiar.')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma equipe alocada no evento de origem.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    vi.mocked(getReplicationPreview).mockRejectedValueOnce(new Error('Falha de rede'))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar itens copiados' }))
    expect(await screen.findByText('Falha de rede')).toBeInTheDocument()
  })

  it('lets the user change the contracted services and validates the Outro label', async () => {
    renderDialog()
    await waitFor(() => expect(screen.getByLabelText('Bar')).toBeChecked())
    fillNameAndDate()

    fireEvent.click(screen.getByLabelText('Decoração'))
    fireEvent.click(screen.getByLabelText('Bar'))
    fireEvent.change(screen.getByLabelText('Especifique...'), { target: { value: ' ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar itens copiados' }))

    expect(await screen.findByText('Especifique o serviço Outro.')).toBeInTheDocument()
    expect(screen.getByLabelText('Decoração')).toBeChecked()
    expect(screen.getByLabelText('Bar')).not.toBeChecked()
    expect(getReplicationPreview).not.toHaveBeenCalled()
  })

  it('validates location, guests and client before the review', async () => {
    renderDialog()
    await waitFor(() => expect(screen.getByLabelText('Bar')).toBeChecked())
    fillNameAndDate()
    const next = () => fireEvent.click(screen.getByRole('button', { name: 'Revisar itens copiados' }))

    fireEvent.change(screen.getByLabelText('Local'), { target: { value: '' } })
    next()
    expect(await screen.findByText('Informe o local do evento.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Local'), { target: { value: 'Salão' } })
    fireEvent.change(screen.getByLabelText('Número de convidados'), { target: { value: '' } })
    next()
    expect(await screen.findByText('Informe o número de convidados.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Número de convidados'), { target: { value: '90' } })
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: '' } })
    next()
    expect(await screen.findByText('Selecione o cliente do evento.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tipo de serviço'), { target: { value: 'ANIVERSARIO' } })
    fireEvent.change(screen.getByLabelText('Observações'), { target: { value: '' } })
    expect(screen.getByLabelText('Tipo de serviço')).toHaveValue('ANIVERSARIO')
    expect(getReplicationPreview).not.toHaveBeenCalled()
  })
})
