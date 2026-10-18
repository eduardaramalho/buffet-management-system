import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'
import { getDashboardSummary, getRecentActivity, getTasksByStatus, getUpcomingEvents } from '../api/dashboardApi'

vi.mock('../api/dashboardApi', () => ({ getDashboardSummary: vi.fn(), getUpcomingEvents: vi.fn(), getTasksByStatus: vi.fn(), getRecentActivity: vi.fn() }))

const summary = { eventsThisMonth: 2, pendingTasks: 4, activeTeams: 3, completedOnTimePercentage: 75 }
const statuses = { PENDENTE: 1, EM_ANDAMENTO: 2, CONCLUIDA: 3, CANCELADA: 0 } as const

beforeEach(() => vi.clearAllMocks())

describe('DashboardPage', () => {
  it('renders summary, upcoming events, task status legend and recent activity', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(summary)
    vi.mocked(getUpcomingEvents).mockResolvedValue([{ id: 'event-1', name: 'Casamento', eventDate: '2026-10-10T15:00:00.000Z', location: 'Salao', status: 'CONFIRMADO' }])
    vi.mocked(getTasksByStatus).mockResolvedValue(statuses)
    vi.mocked(getRecentActivity).mockResolvedValue([{ id: 'audit-1', message: "Evento 'Casamento' criado", action: 'EVENT_CREATED', entity: 'Event', createdAt: new Date().toISOString() }])

    render(<DashboardPage />)

    expect(await screen.findByText('Casamento')).toBeInTheDocument()
    expect(screen.getByText('Eventos este mês').previousElementSibling).toHaveTextContent('2')
    expect(screen.getByText('75.0%')).toBeInTheDocument()
    expect(screen.getByText('Concluída')).toBeInTheDocument()
    expect(screen.getByText("Evento 'Casamento' criado")).toBeInTheDocument()
  })

  it('renders empty states without breaking when the API has no data', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue({ eventsThisMonth: 0, pendingTasks: 0, activeTeams: 0, completedOnTimePercentage: null })
    vi.mocked(getUpcomingEvents).mockResolvedValue([])
    vi.mocked(getTasksByStatus).mockResolvedValue({ PENDENTE: 0, EM_ANDAMENTO: 0, CONCLUIDA: 0, CANCELADA: 0 })
    vi.mocked(getRecentActivity).mockResolvedValue([])

    render(<DashboardPage />)

    expect(await screen.findByText('Nenhum próximo evento.')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma atividade recente.')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('Pendente')).toBeInTheDocument()
    expect(screen.getByText('Cancelada')).toBeInTheDocument()
  })

  it('keeps successful blocks visible and retries only the failed block', async () => {
    vi.mocked(getDashboardSummary).mockRejectedValueOnce(new Error('Falha no resumo')).mockResolvedValue(summary)
    vi.mocked(getUpcomingEvents).mockResolvedValue([{ id: 'event-1', name: 'Casamento', eventDate: '2026-10-10T15:00:00.000Z', location: 'Salao', status: 'CONFIRMADO' }])
    vi.mocked(getTasksByStatus).mockResolvedValue(statuses)
    vi.mocked(getRecentActivity).mockResolvedValue([])

    render(<DashboardPage />)

    expect(await screen.findByText('Falha no resumo')).toBeInTheDocument()
    expect(screen.getByText('Casamento')).toBeInTheDocument()
    expect(screen.getByText('Concluída')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    await waitFor(() => expect(getDashboardSummary).toHaveBeenCalledTimes(2))
    expect(getUpcomingEvents).toHaveBeenCalledTimes(1)
    expect(getTasksByStatus).toHaveBeenCalledTimes(1)
    expect(getRecentActivity).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Eventos este mês').previousElementSibling).toHaveTextContent('2')
  })
})
