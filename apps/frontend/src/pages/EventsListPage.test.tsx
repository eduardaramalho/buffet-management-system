import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { EventsListPage } from './EventsListPage'
import { createEvent, listEvents } from '../api/eventsApi'
import { listServices } from '../api/servicesApi'

vi.mock('../api/eventsApi', () => ({ listEvents: vi.fn(), createEvent: vi.fn(), updateEvent: vi.fn(), removeEvent: vi.fn(), attachEventService: vi.fn(), detachEventService: vi.fn() }))
vi.mock('../api/servicesApi', () => ({ listServices: vi.fn() }))

const event = (status: 'PLANEJAMENTO' | 'CONFIRMADO') => ({ id: status, name: status === 'CONFIRMADO' ? 'Evento confirmado' : 'Evento planejamento', eventDate: '2026-10-10T15:00:00.000Z', endDate: null, location: 'Salao', serviceType: 'CASAMENTO' as const, guestsCount: 100, observations: null, status, createdById: 'user', createdAt: '', updatedAt: '', deletedAt: null, services: [] })

describe('EventsListPage', () => {
  it('applies the status filter and loads the filtered events', async () => {
    vi.mocked(listEvents).mockResolvedValue([event('PLANEJAMENTO'), event('CONFIRMADO')])
    vi.mocked(listServices).mockResolvedValue([])
    render(<MemoryRouter><EventsListPage /></MemoryRouter>)
    await screen.findByText('Evento confirmado')

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'CONFIRMADO' } })

    await waitFor(() => expect(listEvents).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'CONFIRMADO' })))
  })

  it('opens the creation form from Novo Evento', async () => {
    vi.mocked(listEvents).mockResolvedValue([])
    vi.mocked(listServices).mockResolvedValue([])
    render(<MemoryRouter><EventsListPage /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Novo Evento' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(createEvent).not.toHaveBeenCalled()
  })
})