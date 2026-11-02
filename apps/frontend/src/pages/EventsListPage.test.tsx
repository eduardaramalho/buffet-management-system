import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventsListPage } from './EventsListPage'
import { createEvent, listDeletedEvents, listEvents, restoreEvent } from '../api/eventsApi'
import { listServices } from '../api/servicesApi'

vi.mock('../api/eventsApi', () => ({ listEvents: vi.fn(), listDeletedEvents: vi.fn(), restoreEvent: vi.fn(), createEvent: vi.fn(), updateEvent: vi.fn(), removeEvent: vi.fn(), attachEventService: vi.fn(), detachEventService: vi.fn() }))
const { authState } = vi.hoisted(() => ({ authState: { permissions: ['events:list'] as string[] } }))
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: { roles: [{ permissions: authState.permissions }] } }) }))
vi.mock('../api/servicesApi', () => ({ listServices: vi.fn() }))

const event = (status: 'PLANEJAMENTO' | 'CONFIRMADO') => ({ id: status, name: status === 'CONFIRMADO' ? 'Evento confirmado' : 'Evento planejamento', eventDate: '2026-10-10T15:00:00.000Z', endDate: null, location: 'Salao', serviceType: 'CASAMENTO' as const, guestsCount: 100, observations: null, status, createdById: 'user', createdAt: '', updatedAt: '', deletedAt: null, services: [], clientId: null, client: null })

describe('EventsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.permissions = ['events:list']
  })

  it('applies the status filter and loads the filtered events', async () => {
    vi.mocked(listEvents).mockResolvedValue([event('PLANEJAMENTO'), event('CONFIRMADO')])
    vi.mocked(listServices).mockResolvedValue([])
    render(<MemoryRouter><EventsListPage /></MemoryRouter>)
    await screen.findByText('Evento confirmado')

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'CONFIRMADO' } })

    await waitFor(() => expect(listEvents).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'CONFIRMADO' })))
  })

  it('opens the creation form from Novo Evento', async () => {
    authState.permissions = ['events:list', 'events:create']
    vi.mocked(listEvents).mockResolvedValue([])
    vi.mocked(listServices).mockResolvedValue([])
    render(<MemoryRouter><EventsListPage /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Novo Evento' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(createEvent).not.toHaveBeenCalled()
  })

  // Colaborador: acompanha os eventos sem criar, editar ou excluir.
  it('shows only the view action to a read-only user', async () => {
    vi.mocked(listEvents).mockResolvedValue([event('CONFIRMADO')])
    vi.mocked(listServices).mockResolvedValue([])
    render(<MemoryRouter><EventsListPage /></MemoryRouter>)

    expect(await screen.findByRole('button', { name: 'Visualizar Evento confirmado' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Novo Evento' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar Evento confirmado' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir Evento confirmado' })).not.toBeInTheDocument()
  })

  it('offers edit and delete with the matching permissions', async () => {
    authState.permissions = ['events:list', 'events:update', 'events:delete']
    vi.mocked(listEvents).mockResolvedValue([event('CONFIRMADO')])
    vi.mocked(listServices).mockResolvedValue([])
    render(<MemoryRouter><EventsListPage /></MemoryRouter>)

    expect(await screen.findByRole('button', { name: 'Editar Evento confirmado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excluir Evento confirmado' })).toBeInTheDocument()
  })

  describe('excluídos e restauração', () => {
    const deleted = { ...event('CONFIRMADO'), id: 'deleted-1', name: 'Evento excluído', deletedAt: '2026-10-20T13:00:00.000Z' }

    it('offers the deleted view only with events:restore', async () => {
      vi.mocked(listEvents).mockResolvedValue([])
      render(<MemoryRouter><EventsListPage /></MemoryRouter>)
      await screen.findByText('Nenhum evento encontrado.')

      expect(screen.queryByRole('button', { name: 'Excluídos' })).not.toBeInTheDocument()
    })

    it('lists deleted events with the deletion date and restores one, keeping its status', async () => {
      authState.permissions = ['events:list', 'events:restore']
      vi.mocked(listEvents).mockResolvedValue([event('PLANEJAMENTO')])
      vi.mocked(listDeletedEvents).mockResolvedValue([deleted])
      vi.mocked(restoreEvent).mockResolvedValue({ ...deleted, deletedAt: null })
      render(<MemoryRouter><EventsListPage /></MemoryRouter>)
      await screen.findByText('Evento planejamento')

      fireEvent.click(screen.getByRole('button', { name: 'Excluídos' }))

      expect(await screen.findByText('Evento excluído')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Excluídos' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByText('Confirmado')).toBeInTheDocument()
      expect(screen.getByText(/20\/10\/2026/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Novo Evento' })).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Restaurar Evento excluído' }))

      await waitFor(() => expect(restoreEvent).toHaveBeenCalledWith('deleted-1'))
      expect(await screen.findByText("Evento 'Evento excluído' restaurado.")).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Restaurar Evento excluído' })).not.toBeInTheDocument()
      expect(screen.getByText('Nenhum evento excluído.')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Ativos' }))
      await waitFor(() => expect(listEvents).toHaveBeenCalledTimes(2))
    })

    it('shows the API message when listing or restoring fails', async () => {
      authState.permissions = ['events:list', 'events:restore']
      vi.mocked(listEvents).mockResolvedValue([])
      vi.mocked(listDeletedEvents).mockResolvedValueOnce([deleted]).mockRejectedValueOnce(new Error('Falha ao listar'))
      vi.mocked(restoreEvent).mockRejectedValue(new Error('Evento não encontrado'))
      render(<MemoryRouter><EventsListPage /></MemoryRouter>)
      await screen.findByText('Nenhum evento encontrado.')

      fireEvent.click(screen.getByRole('button', { name: 'Excluídos' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Restaurar Evento excluído' }))
      expect(await screen.findByText('Evento não encontrado')).toBeInTheDocument()
      expect(screen.getByText('Evento excluído')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Ativos' }))
      await screen.findByText('Nenhum evento encontrado.')
      fireEvent.click(screen.getByRole('button', { name: 'Excluídos' }))
      expect(await screen.findByText('Falha ao listar')).toBeInTheDocument()
    })
  })
})