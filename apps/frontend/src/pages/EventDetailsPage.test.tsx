import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventDetailsPage } from './EventDetailsPage'
import { getEvent, getEventHistory, updateEvent } from '../api/eventsApi'
import { listTasks } from '../api/tasksApi'
import { listTeams, listTeamsByEvent } from '../api/teamsApi'
import { applyEventRules, listEventRuleApplications } from '../api/rulesApi'

vi.mock('../api/eventsApi', () => ({ getEvent: vi.fn(), getEventHistory: vi.fn(), updateEvent: vi.fn() }))
vi.mock('../api/tasksApi', () => ({ listTasks: vi.fn() }))
vi.mock('../api/teamsApi', () => ({ listTeams: vi.fn(), listTeamsByEvent: vi.fn() }))
vi.mock('../api/rulesApi', () => ({ applyEventRules: vi.fn(), getEventRuleMatches: vi.fn(), listEventRuleApplications: vi.fn() }))
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: { roles: [{ permissions: ['events:read', 'events:update', 'rules:apply'] }] } }) }))

const event = (status: 'PLANEJAMENTO' | 'CONFIRMADO' | 'EM_ANDAMENTO' | 'CONCLUIDO' = 'CONFIRMADO') => ({ id: 'event-1', name: 'Casamento Ana', eventDate: '2026-11-10T15:00:00.000Z', endDate: null, location: 'Salao', serviceType: 'CASAMENTO' as const, guestsCount: 100, observations: null, status, createdById: 'user', createdAt: '', updatedAt: '', deletedAt: null, services: [] })
const renderPage = () => render(<MemoryRouter initialEntries={['/events/event-1']}><Routes><Route path="/events/:id" element={<EventDetailsPage />} /></Routes></MemoryRouter>)

describe('EventDetailsPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders independent event blocks and the next status action', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    vi.mocked(listTasks).mockResolvedValue([])
    vi.mocked(listTeamsByEvent).mockResolvedValue([])
    vi.mocked(listTeams).mockResolvedValue([])
    vi.mocked(listEventRuleApplications).mockResolvedValue([{ ruleId: 'rule-1', ruleName: 'Casamento', appliedAt: '2026-10-01T10:00:00.000Z' }])
    vi.mocked(getEventHistory).mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('Casamento Ana')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar evento' })).toBeInTheDocument()
    expect(screen.getByText('Regras aplicadas')).toBeInTheDocument()
  })

  it('hides a forbidden block and retries other errors locally', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    vi.mocked(listTasks).mockRejectedValue({ response: { status: 403 } })
    vi.mocked(listTeamsByEvent).mockResolvedValue([])
    vi.mocked(listTeams).mockResolvedValue([])
    vi.mocked(listEventRuleApplications).mockRejectedValue(new Error('falha de regras'))
    vi.mocked(getEventHistory).mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('falha de regras')).toBeInTheDocument()
    expect(screen.queryByText('Tarefas do evento')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(listEventRuleApplications).toHaveBeenCalledTimes(2))
  })

  it('requires a reason when cancelling a confirmed event', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    vi.mocked(listTasks).mockResolvedValue([])
    vi.mocked(listTeamsByEvent).mockResolvedValue([])
    vi.mocked(listTeams).mockResolvedValue([])
    vi.mocked(listEventRuleApplications).mockResolvedValue([])
    vi.mocked(getEventHistory).mockResolvedValue([])
    renderPage()
    await screen.findByText('Casamento Ana')

    fireEvent.click(screen.getByRole('button', { name: 'Mais ações' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar evento' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }))

    expect(await screen.findByText('Informe o motivo do cancelamento.')).toBeInTheDocument()
    expect(updateEvent).not.toHaveBeenCalled()
  })

  it('reapplies rules and reports created and skipped tasks', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    vi.mocked(listTasks).mockResolvedValue([])
    vi.mocked(listTeamsByEvent).mockResolvedValue([])
    vi.mocked(listTeams).mockResolvedValue([])
    vi.mocked(listEventRuleApplications).mockResolvedValue([])
    vi.mocked(getEventHistory).mockResolvedValue([])
    vi.mocked(applyEventRules).mockResolvedValue({ tasksCreated: 2, tasksSkipped: 1, teamsAutoAssigned: 0, alertsGenerated: 0 })
    renderPage()
    await screen.findByText('Casamento Ana')
    fireEvent.click(screen.getByRole('button', { name: 'Reaplicar' }))
    await waitFor(() => expect(applyEventRules).toHaveBeenCalledWith('event-1'))
    expect(await screen.findByText('2 tarefas criadas, 1 ignorada')).toBeInTheDocument()
  })
})