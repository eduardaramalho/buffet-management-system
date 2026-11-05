import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'
import { getDashboardSummary, getTasksByStatus, getUpcomingEvents } from '../api/dashboardApi'

vi.mock('../api/dashboardApi', () => ({ getDashboardSummary: vi.fn(), getUpcomingEvents: vi.fn(), getTasksByStatus: vi.fn() }))

const summary = { eventsThisMonth: 2, pendingTasks: 4, overdueTasks: 1, activeTeams: 3, completedOnTimePercentage: 75 }
const statuses = { PENDENTE: 1, EM_ANDAMENTO: 2, CONCLUIDA: 3, CANCELADA: 0 } as const

beforeEach(() => vi.clearAllMocks())

describe('DashboardPage', () => {
  it('renders summary, upcoming events and task status legend without the recent activity card', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(summary)
    vi.mocked(getUpcomingEvents).mockResolvedValue([{ id: 'event-1', name: 'Casamento', eventDate: '2026-10-10T15:00:00.000Z', location: 'Salao', status: 'CONFIRMADO' }])
    vi.mocked(getTasksByStatus).mockResolvedValue(statuses)

    render(<DashboardPage />)

    expect(await screen.findByText('Casamento')).toBeInTheDocument()
    expect(screen.getByText('Eventos este mês').previousElementSibling).toHaveTextContent('2')
    expect(screen.getByText('Tarefas atrasadas').previousElementSibling).toHaveTextContent('1')
    expect(screen.getByText('75.0%')).toBeInTheDocument()
    expect(screen.getByText('Concluída')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Atividades recentes' })).not.toBeInTheDocument()
  })

  it('renders empty states without breaking when the API has no data', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue({ eventsThisMonth: 0, pendingTasks: 0, overdueTasks: 0, activeTeams: 0, completedOnTimePercentage: null })
    vi.mocked(getUpcomingEvents).mockResolvedValue([])
    vi.mocked(getTasksByStatus).mockResolvedValue({ PENDENTE: 0, EM_ANDAMENTO: 0, CONCLUIDA: 0, CANCELADA: 0 })

    render(<DashboardPage />)

    expect(await screen.findByText('Nenhum próximo evento.')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('Pendente')).toBeInTheDocument()
    expect(screen.getByText('Cancelada')).toBeInTheDocument()
  })

  it('keeps successful blocks visible and retries only the failed block', async () => {
    vi.mocked(getDashboardSummary).mockRejectedValueOnce(new Error('Falha no resumo')).mockResolvedValue(summary)
    vi.mocked(getUpcomingEvents).mockResolvedValue([{ id: 'event-1', name: 'Casamento', eventDate: '2026-10-10T15:00:00.000Z', location: 'Salao', status: 'CONFIRMADO' }])
    vi.mocked(getTasksByStatus).mockResolvedValue(statuses)

    render(<DashboardPage />)

    expect(await screen.findByText('Falha no resumo')).toBeInTheDocument()
    expect(screen.getByText('Casamento')).toBeInTheDocument()
    expect(screen.getByText('Concluída')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    await waitFor(() => expect(getDashboardSummary).toHaveBeenCalledTimes(2))
    expect(getUpcomingEvents).toHaveBeenCalledTimes(1)
    expect(getTasksByStatus).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Eventos este mês').previousElementSibling).toHaveTextContent('2')
  })
})

describe('DashboardPage: falhas e formatação', () => {
  it('isola a falha de cada bloco com mensagem padrão e recarrega cada um separadamente', async () => {
    vi.mocked(getDashboardSummary).mockRejectedValueOnce('x').mockResolvedValue(summary)
    vi.mocked(getUpcomingEvents).mockRejectedValueOnce('x').mockResolvedValue([])
    vi.mocked(getTasksByStatus).mockRejectedValueOnce('x').mockResolvedValue(statuses)

    render(<DashboardPage />)

    expect(await screen.findByText('Não foi possível carregar o resumo.')).toBeInTheDocument()
    expect(screen.getByText('Não foi possível carregar os próximos eventos.')).toBeInTheDocument()
    expect(screen.getByText('Não foi possível carregar as tarefas por status.')).toBeInTheDocument()

    for (const button of screen.getAllByRole('button', { name: 'Tentar de novo' })) await userEvent.click(button)

    await waitFor(() => expect(screen.queryByText('Não foi possível carregar o resumo.')).not.toBeInTheDocument())
    expect(screen.queryByText('Não foi possível carregar os próximos eventos.')).not.toBeInTheDocument()
    expect(screen.queryByText('Não foi possível carregar as tarefas por status.')).not.toBeInTheDocument()
  })

  it('rotula cada status de evento', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(summary)
    vi.mocked(getUpcomingEvents).mockResolvedValue((['PLANEJAMENTO', 'CONFIRMADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO'] as const)
      .map((status, index) => ({ id: `e${index}`, name: `Evento ${index}`, eventDate: '2026-11-10T15:00:00.000Z', location: 'Salão', status })))
    vi.mocked(getTasksByStatus).mockResolvedValue(statuses)

    render(<DashboardPage />)

    expect(await screen.findByText('Evento 0')).toBeInTheDocument()
    for (const label of ['Planejamento', 'Confirmado', 'Concluído', 'Cancelado']) expect(screen.getByText(label)).toBeInTheDocument()
  })
})
