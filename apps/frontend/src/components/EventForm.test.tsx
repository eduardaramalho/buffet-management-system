import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventForm } from './EventForm'
import { createEvent, updateEvent } from '../api/eventsApi'
import { listServices } from '../api/servicesApi'
import { assignTeamToEvent, listTeams, listTeamsByEvent } from '../api/teamsApi'
import { listClients } from '../api/clientsApi'
import type { Event } from '../types/event'

vi.mock('../api/eventsApi', () => ({ createEvent: vi.fn(), updateEvent: vi.fn(), attachEventService: vi.fn(), detachEventService: vi.fn() }))
vi.mock('../api/servicesApi', () => ({ listServices: vi.fn() }))
vi.mock('../api/teamsApi', () => ({ assignTeamToEvent: vi.fn(), listTeams: vi.fn(), listTeamsByEvent: vi.fn(), unassignTeamFromEvent: vi.fn() }))
vi.mock('../api/clientsApi', () => ({ listClients: vi.fn() }))

const services = [
  { id: 'service-other', name: 'Outro', isCustom: true, createdAt: '', deletedAt: null },
  { id: 'service-buffet', name: 'Buffet', isCustom: false, createdAt: '', deletedAt: null },
]

const activeClients = [
  { id: 'client-1', type: 'PF' as const, name: 'Ana Souza', document: null, email: null, phone: null, notes: null, createdAt: '', updatedAt: '', deletedAt: null },
  { id: 'client-2', type: 'PJ' as const, name: 'Buffet Alegria Ltda', document: null, email: null, phone: null, notes: null, createdAt: '', updatedAt: '', deletedAt: null },
]
const makeEvent = (overrides: Partial<Event> = {}): Event => ({
  id: 'event-1', name: 'Evento', eventDate: '2026-10-10T15:00:00.000Z', endDate: null, location: 'Salao', serviceType: 'CASAMENTO', guestsCount: 50,
  observations: null, status: 'PLANEJAMENTO', createdById: 'actor', createdAt: '', updatedAt: '', deletedAt: null, services: [],
  clientId: 'client-1', client: { id: 'client-1', name: 'Ana Souza', email: null, phone: null, deletedAt: null }, ...overrides,
})

describe('EventForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listClients).mockResolvedValue(activeClients)
    vi.mocked(listTeams).mockResolvedValue([])
    vi.mocked(listTeamsByEvent).mockResolvedValue([])
  })

  it('shows validation errors and does not submit incomplete data', async () => {
    vi.mocked(listServices).mockResolvedValue(services)
    render(<EventForm onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)

    await waitFor(() => expect(screen.getByLabelText('Nome do evento')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Informe o nome do evento.')).toBeInTheDocument()
    expect(createEvent).not.toHaveBeenCalled()
  })

  it('shows and clears the custom label when Outro is toggled', async () => {
    vi.mocked(listServices).mockResolvedValue(services)
    render(<EventForm onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)

    const checkbox = await screen.findByLabelText('Outro')
    fireEvent.click(checkbox)
    expect(screen.getByLabelText('Especifique...')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Especifique...'), { target: { value: 'Fotografia' } })
    fireEvent.click(checkbox)
    expect(screen.queryByLabelText('Especifique...')).not.toBeInTheDocument()
  })

  it('pre-fills an existing event for editing', async () => {
    vi.mocked(listServices).mockResolvedValue(services)
    render(<EventForm event={{
      id: 'event-1', name: 'Casamento de Alice', eventDate: '2026-10-10T15:00:00.000Z', endDate: null,
      location: 'Salao Principal', serviceType: 'CASAMENTO', guestsCount: 100, observations: 'Detalhes',
      status: 'PLANEJAMENTO', createdById: 'actor-1', createdAt: '', updatedAt: '', deletedAt: null,
      services: [{ serviceId: 'service-buffet', customLabel: null, service: services[1] }], clientId: null, client: null,
    }} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)

    expect(await screen.findByDisplayValue('Casamento de Alice')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Salao Principal')).toBeInTheDocument()
    expect(screen.getByLabelText('Buffet')).toBeChecked()
    expect(updateEvent).not.toHaveBeenCalled()
  })

  it('creates an event and notifies the list after successful submission', async () => {
    const created = { id: 'event-new', name: 'Novo evento', eventDate: '2026-10-10T15:00:00.000Z', endDate: null, location: 'Salao', serviceType: 'CASAMENTO' as const, guestsCount: 50, observations: null, status: 'PLANEJAMENTO' as const, createdById: 'actor', createdAt: '', updatedAt: '', deletedAt: null, services: [], clientId: 'client-2', client: null }
    vi.mocked(listServices).mockResolvedValue([])
    vi.mocked(createEvent).mockResolvedValue(created)
    const onCreated = vi.fn()
    render(<EventForm onClose={vi.fn()} onCreated={onCreated} onUpdated={vi.fn()} />)
    fireEvent.change(await screen.findByLabelText('Nome do evento'), { target: { value: 'Novo evento' } })
    fireEvent.change(screen.getByLabelText('Data do evento'), { target: { value: '2026-10-10T15:00' } })
    fireEvent.change(screen.getByLabelText('Local'), { target: { value: 'Salao' } })
    fireEvent.change(screen.getByLabelText('Tipo de serviço'), { target: { value: 'CASAMENTO' } })
    fireEvent.change(screen.getByLabelText('Número de convidados'), { target: { value: '50' } })
    await screen.findByRole('option', { name: 'Buffet Alegria Ltda' })
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'client-2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'client-2' })))
    expect(onCreated).toHaveBeenCalledWith(created)
  })

  it('links a team from the event editor', async () => {
    vi.mocked(listServices).mockResolvedValue([])
    vi.mocked(listTeams).mockResolvedValue([{ id: 'team-1', name: 'Equipe Salao A', specialty: 'SALAO', status: 'ATIVA', observations: null, createdById: 'actor', createdAt: '', updatedAt: '', deletedAt: null, members: [], events: [] }])
    vi.mocked(listTeamsByEvent).mockResolvedValue([])
    vi.mocked(assignTeamToEvent).mockResolvedValue({ eventId: 'event-1', teamId: 'team-1', assignedAt: '', assignedById: 'actor' })
    render(<EventForm event={{ id: 'event-1', name: 'Evento', eventDate: '2026-10-10T15:00:00.000Z', endDate: null, location: 'Salao', serviceType: 'CASAMENTO', guestsCount: 50, observations: null, status: 'PLANEJAMENTO', createdById: 'actor', createdAt: '', updatedAt: '', deletedAt: null, services: [], clientId: 'client-1', client: null }} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)

    await screen.findByRole('option', { name: 'Equipe Salao A' })
    fireEvent.change(screen.getByLabelText('Equipe para adicionar'), { target: { value: 'team-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vincular equipe' }))

    await waitFor(() => expect(assignTeamToEvent).toHaveBeenCalledWith('team-1', 'event-1'))
    expect(await screen.findByText('Equipe Salao A')).toBeInTheDocument()
  })

  it('shows a conflict error when linking a team fails', async () => {
    vi.mocked(listServices).mockResolvedValue([])
    vi.mocked(listTeams).mockResolvedValue([{ id: 'team-1', name: 'Equipe Salao A', specialty: 'SALAO', status: 'ATIVA', observations: null, createdById: 'actor', createdAt: '', updatedAt: '', deletedAt: null, members: [], events: [] }])
    vi.mocked(listTeamsByEvent).mockResolvedValue([])
    vi.mocked(assignTeamToEvent).mockRejectedValue(new Error('conflito de agenda'))
    render(<EventForm event={{ id: 'event-1', name: 'Evento', eventDate: '2026-10-10T15:00:00.000Z', endDate: null, location: 'Salao', serviceType: 'CASAMENTO', guestsCount: 50, observations: null, status: 'PLANEJAMENTO', createdById: 'actor', createdAt: '', updatedAt: '', deletedAt: null, services: [], clientId: 'client-1', client: null }} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)

    await screen.findByRole('option', { name: 'Equipe Salao A' })
    fireEvent.change(screen.getByLabelText('Equipe para adicionar'), { target: { value: 'team-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vincular equipe' }))

    expect(await screen.findByText('conflito de agenda')).toBeInTheDocument()
  })

  it('requires a client before creating an event', async () => {
    vi.mocked(listServices).mockResolvedValue([])
    render(<EventForm onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)
    fireEvent.change(await screen.findByLabelText('Nome do evento'), { target: { value: 'Novo evento' } })
    fireEvent.change(screen.getByLabelText('Data do evento'), { target: { value: '2026-10-10T15:00' } })
    fireEvent.change(screen.getByLabelText('Local'), { target: { value: 'Salao' } })
    fireEvent.change(screen.getByLabelText('Tipo de serviço'), { target: { value: 'CASAMENTO' } })
    fireEvent.change(screen.getByLabelText('Número de convidados'), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Selecione o cliente do evento.')).toBeInTheDocument()
    expect(createEvent).not.toHaveBeenCalled()
  })

  it('sends clientId on update only when the client changes', async () => {
    vi.mocked(listServices).mockResolvedValue([])
    vi.mocked(updateEvent).mockResolvedValue(makeEvent())
    const { unmount } = render(<EventForm event={makeEvent()} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)
    await screen.findByRole('option', { name: 'Buffet Alegria Ltda' })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(updateEvent).toHaveBeenCalledTimes(1))
    expect(vi.mocked(updateEvent).mock.calls[0][1]).not.toHaveProperty('clientId')
    unmount()

    render(<EventForm event={makeEvent()} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)
    await screen.findByRole('option', { name: 'Buffet Alegria Ltda' })
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'client-2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(updateEvent).toHaveBeenLastCalledWith('event-1', expect.objectContaining({ clientId: 'client-2' })))
  })

  it('keeps a deleted client visible as inactive when editing an event', async () => {
    vi.mocked(listServices).mockResolvedValue([])
    render(<EventForm event={makeEvent({ clientId: 'client-old', client: { id: 'client-old', name: 'Carlos Lima', email: null, phone: null, deletedAt: '2026-10-01T00:00:00.000Z' } })} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)

    expect(await screen.findByRole('option', { name: 'Carlos Lima (inativo)' })).toBeInTheDocument()
    expect(screen.getByLabelText('Cliente')).toHaveValue('client-old')
  })

  it('asks to link a client when editing a legacy event without one', async () => {
    vi.mocked(listServices).mockResolvedValue([])
    render(<EventForm event={makeEvent({ clientId: null, client: null })} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)
    await screen.findByRole('option', { name: 'Ana Souza' })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Selecione o cliente do evento.')).toBeInTheDocument()
    expect(updateEvent).not.toHaveBeenCalled()
  })

  it('shows an error when clients cannot be loaded', async () => {
    vi.mocked(listServices).mockResolvedValue([])
    vi.mocked(listClients).mockRejectedValue(new Error('Permissão insuficiente'))
    render(<EventForm onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)

    expect(await screen.findByText('Permissão insuficiente')).toBeInTheDocument()
  })

  // Regressão encontrada pelo E2E: o campo usava toISOString() (UTC), então um evento das 18h em
  // Brasília aparecia como 21h na edição e cada "Salvar" adiantava o evento em 3 horas.
  it('shows the event date in local time and keeps it unchanged when saving', async () => {
    vi.stubEnv('TZ', 'America/Sao_Paulo')
    try {
      vi.mocked(listServices).mockResolvedValue([])
      vi.mocked(updateEvent).mockResolvedValue(makeEvent())
      render(<EventForm event={makeEvent({ eventDate: '2026-11-01T21:00:00.000Z' })} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)

      expect(await screen.findByLabelText('Data do evento')).toHaveValue('2026-11-01T18:00')
      await screen.findByRole('option', { name: 'Ana Souza' })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

      await waitFor(() => expect(updateEvent).toHaveBeenCalledWith('event-1', expect.objectContaining({ eventDate: '2026-11-01T21:00:00.000Z' })))
    } finally {
      vi.unstubAllEnvs()
    }
  })

  // Regressão encontrada pelo E2E: o botão ficava dentro de um <label> com o nome da equipe, então
  // leitores de tela anunciavam "Cozinha Central, botão" em vez da ação.
  it('names the unlink action after the team it removes', async () => {
    vi.mocked(listServices).mockResolvedValue([])
    vi.mocked(listTeams).mockResolvedValue([{ id: 'team-1', name: 'Equipe Salao A', specialty: 'SALAO', status: 'ATIVA', observations: null, createdById: 'actor', createdAt: '', updatedAt: '', deletedAt: null, members: [], events: [] }])
    vi.mocked(listTeamsByEvent).mockResolvedValue([{ eventId: 'event-1', teamId: 'team-1', assignedAt: '', assignedById: 'actor' }])
    render(<EventForm event={makeEvent()} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)

    expect(await screen.findByRole('button', { name: 'Desvincular Equipe Salao A' })).toBeInTheDocument()
  })
})
