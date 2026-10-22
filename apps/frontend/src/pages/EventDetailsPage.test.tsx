import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventDetailsPage } from './EventDetailsPage'
import { getEvent, getEventHistory, updateEvent } from '../api/eventsApi'
import { listTasks } from '../api/tasksApi'
import { listTeams, listTeamsByEvent } from '../api/teamsApi'
import { applyEventRules, getEventRuleMatches, listEventRuleApplications } from '../api/rulesApi'
import type { Event } from '../types/event'
import type { MatchedRule } from '../types/rule'

vi.mock('../api/eventsApi', () => ({ getEvent: vi.fn(), getEventHistory: vi.fn(), updateEvent: vi.fn() }))
vi.mock('../api/tasksApi', () => ({ listTasks: vi.fn() }))
vi.mock('../api/teamsApi', () => ({ listTeams: vi.fn(), listTeamsByEvent: vi.fn() }))
vi.mock('../api/rulesApi', () => ({ applyEventRules: vi.fn(), getEventRuleMatches: vi.fn(), listEventRuleApplications: vi.fn() }))
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: { roles: [{ permissions: ['events:read', 'events:update', 'rules:apply'] }] } }) }))

const event = (status: Event['status'] = 'CONFIRMADO'): Event => ({
  id: 'event-1', name: 'Casamento Ana', eventDate: '2026-11-10T15:00:00.000Z', endDate: null, location: 'Salao', serviceType: 'CASAMENTO', guestsCount: 100,
  observations: null, status, createdById: 'user', createdAt: '', updatedAt: '', deletedAt: null, services: [],
  clientId: 'client-1', client: { id: 'client-1', name: 'Ana Souza', email: 'ana@email.com', phone: '47999990000', deletedAt: null },
})
const matchedRule: MatchedRule = {
  rule: {
    id: 'rule-1', name: 'Casamento grande', description: null, conditionServiceTypeIn: ['CASAMENTO'], conditionMinGuests: 100, conditionMaxGuests: null,
    conditionRequiredServiceIds: null, isActive: true, createdById: 'user', createdAt: '', updatedAt: '', deletedAt: null, resourceRequirements: [], taskTemplates: [],
  },
  resourceRequirements: [{ id: 'req-1', specialty: 'COZINHA', minQuantity: 1 }],
}
const mockOtherBlocks = () => {
  vi.mocked(listTasks).mockResolvedValue([])
  vi.mocked(listTeamsByEvent).mockResolvedValue([])
  vi.mocked(listTeams).mockResolvedValue([])
  vi.mocked(getEventHistory).mockResolvedValue([])
}
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

  it('shows the event client contact in the client panel', async () => {
    vi.mocked(getEvent).mockResolvedValue(event())
    vi.mocked(listTasks).mockResolvedValue([])
    vi.mocked(listTeamsByEvent).mockResolvedValue([])
    vi.mocked(listTeams).mockResolvedValue([])
    vi.mocked(listEventRuleApplications).mockResolvedValue([])
    vi.mocked(getEventHistory).mockResolvedValue([])
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Cliente' })).toBeInTheDocument()
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByText('ana@email.com')).toBeInTheDocument()
    expect(screen.getByText('47999990000')).toBeInTheDocument()
  })

  it('flags legacy events without a client and inactive clients', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce({ ...event(), clientId: null, client: null })
    vi.mocked(listTasks).mockResolvedValue([])
    vi.mocked(listTeamsByEvent).mockResolvedValue([])
    vi.mocked(listTeams).mockResolvedValue([])
    vi.mocked(listEventRuleApplications).mockResolvedValue([])
    vi.mocked(getEventHistory).mockResolvedValue([])
    const { unmount } = renderPage()

    expect(await screen.findByText('Nenhum cliente vinculado. Edite o evento para vincular um cliente.')).toBeInTheDocument()
    unmount()

    vi.mocked(getEvent).mockResolvedValueOnce({ ...event(), client: { id: 'client-1', name: 'Ana Souza', email: null, phone: null, deletedAt: '2026-10-01T00:00:00.000Z' } })
    renderPage()

    expect(await screen.findByText('Cliente inativo')).toBeInTheDocument()
    expect(screen.getByText('Sem contato cadastrado')).toBeInTheDocument()
  })

  // Regressão encontrada pelo E2E: loadRules lia o status do evento de um estado ainda não atualizado
  // (closure), então um evento em planejamento consultava as regras APLICADAS e mostrava "nenhuma regra".
  it('shows the rules matching an event that is still in planning', async () => {
    vi.mocked(getEvent).mockResolvedValue(event('PLANEJAMENTO'))
    mockOtherBlocks()
    vi.mocked(getEventRuleMatches).mockResolvedValue([matchedRule])
    vi.mocked(listEventRuleApplications).mockResolvedValue([])
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Motor de regras' })).toBeInTheDocument()
    expect(await screen.findByText('Casamento grande')).toBeInTheDocument()
    expect(listEventRuleApplications).not.toHaveBeenCalled()
  })

  // Regressão da "tela branca": ao confirmar, o painel passava a renderizar regras aplicadas com os
  // dados de regras combinadas (sem appliedAt) e Intl.DateTimeFormat lançava RangeError.
  it('confirms an event and shows the applied rules without leaving the page', async () => {
    vi.mocked(getEvent).mockResolvedValue(event('PLANEJAMENTO'))
    mockOtherBlocks()
    vi.mocked(getEventRuleMatches).mockResolvedValue([matchedRule])
    vi.mocked(listEventRuleApplications).mockResolvedValue([{ ruleId: 'rule-1', ruleName: 'Casamento grande', appliedAt: '2026-10-22T20:00:00.000Z' }])
    vi.mocked(updateEvent).mockResolvedValue(event('CONFIRMADO'))
    renderPage()
    await screen.findByText('Casamento grande')

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByRole('heading', { name: 'Regras aplicadas' })).toBeInTheDocument()
    expect(await screen.findByText(/Aplicada em/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Casamento Ana' })).toBeInTheDocument()
    expect(updateEvent).toHaveBeenCalledWith('event-1', { status: 'CONFIRMADO' })
  })
})
