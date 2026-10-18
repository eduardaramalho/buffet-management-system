import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EventForm } from './EventForm'
import { createEvent, updateEvent } from '../api/eventsApi'
import { listServices } from '../api/servicesApi'
import { assignTeamToEvent, listTeams, listTeamsByEvent } from '../api/teamsApi'

vi.mock('../api/eventsApi', () => ({ createEvent: vi.fn(), updateEvent: vi.fn(), attachEventService: vi.fn(), detachEventService: vi.fn() }))
vi.mock('../api/servicesApi', () => ({ listServices: vi.fn() }))
vi.mock('../api/teamsApi', () => ({ assignTeamToEvent: vi.fn(), listTeams: vi.fn(), listTeamsByEvent: vi.fn(), unassignTeamFromEvent: vi.fn() }))

const services = [
  { id: 'service-other', name: 'Outro', isCustom: true, createdAt: '', deletedAt: null },
  { id: 'service-buffet', name: 'Buffet', isCustom: false, createdAt: '', deletedAt: null },
]

describe('EventForm', () => {
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
      services: [{ serviceId: 'service-buffet', customLabel: null, service: services[1] }],
    }} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)

    expect(await screen.findByDisplayValue('Casamento de Alice')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Salao Principal')).toBeInTheDocument()
    expect(screen.getByLabelText('Buffet')).toBeChecked()
    expect(updateEvent).not.toHaveBeenCalled()
  })

  it('creates an event and notifies the list after successful submission', async () => {
    const created = { id: 'event-new', name: 'Novo evento', eventDate: '2026-10-10T15:00:00.000Z', endDate: null, location: 'Salao', serviceType: 'CASAMENTO' as const, guestsCount: 50, observations: null, status: 'PLANEJAMENTO' as const, createdById: 'actor', createdAt: '', updatedAt: '', deletedAt: null, services: [] }
    vi.mocked(listServices).mockResolvedValue([])
    vi.mocked(createEvent).mockResolvedValue(created)
    const onCreated = vi.fn()
    render(<EventForm onClose={vi.fn()} onCreated={onCreated} onUpdated={vi.fn()} />)
    fireEvent.change(await screen.findByLabelText('Nome do evento'), { target: { value: 'Novo evento' } })
    fireEvent.change(screen.getByLabelText('Data do evento'), { target: { value: '2026-10-10T15:00' } })
    fireEvent.change(screen.getByLabelText('Local'), { target: { value: 'Salao' } })
    fireEvent.change(screen.getByLabelText('Tipo de serviço'), { target: { value: 'CASAMENTO' } })
    fireEvent.change(screen.getByLabelText('Número de convidados'), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(createEvent).toHaveBeenCalled())
    expect(onCreated).toHaveBeenCalledWith(created)
  })

  it('links a team from the event editor', async () => {
    vi.mocked(listServices).mockResolvedValue([])
    vi.mocked(listTeams).mockResolvedValue([{ id: 'team-1', name: 'Equipe Salao A', specialty: 'SALAO', status: 'ATIVA', observations: null, createdById: 'actor', createdAt: '', updatedAt: '', deletedAt: null, members: [], events: [] }])
    vi.mocked(listTeamsByEvent).mockResolvedValue([])
    vi.mocked(assignTeamToEvent).mockResolvedValue({ eventId: 'event-1', teamId: 'team-1', assignedAt: '', assignedById: 'actor' })
    render(<EventForm event={{ id: 'event-1', name: 'Evento', eventDate: '2026-10-10T15:00:00.000Z', endDate: null, location: 'Salao', serviceType: 'CASAMENTO', guestsCount: 50, observations: null, status: 'PLANEJAMENTO', createdById: 'actor', createdAt: '', updatedAt: '', deletedAt: null, services: [] }} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)

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
    render(<EventForm event={{ id: 'event-1', name: 'Evento', eventDate: '2026-10-10T15:00:00.000Z', endDate: null, location: 'Salao', serviceType: 'CASAMENTO', guestsCount: 50, observations: null, status: 'PLANEJAMENTO', createdById: 'actor', createdAt: '', updatedAt: '', deletedAt: null, services: [] }} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)

    await screen.findByRole('option', { name: 'Equipe Salao A' })
    fireEvent.change(screen.getByLabelText('Equipe para adicionar'), { target: { value: 'team-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vincular equipe' }))

    expect(await screen.findByText('conflito de agenda')).toBeInTheDocument()
  })
})