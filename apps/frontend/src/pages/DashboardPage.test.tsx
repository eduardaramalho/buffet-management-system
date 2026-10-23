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

describe('DashboardPage: falhas e formatação', () => {
  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString()

  it('isola a falha de cada bloco com mensagem padrão e recarrega cada um separadamente', async () => {
    vi.mocked(getDashboardSummary).mockRejectedValueOnce('x').mockResolvedValue(summary)
    vi.mocked(getUpcomingEvents).mockRejectedValueOnce('x').mockResolvedValue([])
    vi.mocked(getTasksByStatus).mockRejectedValueOnce('x').mockResolvedValue(statuses)
    vi.mocked(getRecentActivity).mockRejectedValueOnce('x').mockRejectedValueOnce('x').mockResolvedValue([])

    render(<DashboardPage />)

    expect(await screen.findByText('Não foi possível carregar o resumo.')).toBeInTheDocument()
    expect(screen.getByText('Não foi possível carregar os próximos eventos.')).toBeInTheDocument()
    expect(screen.getByText('Não foi possível carregar as tarefas por status.')).toBeInTheDocument()
    expect(screen.getByText('Não foi possível carregar as atividades recentes.')).toBeInTheDocument()

    for (const button of screen.getAllByRole('button', { name: 'Tentar de novo' })) await userEvent.click(button)

    await waitFor(() => expect(screen.queryByText('Não foi possível carregar o resumo.')).not.toBeInTheDocument())
    expect(screen.queryByText('Não foi possível carregar os próximos eventos.')).not.toBeInTheDocument()
    expect(screen.queryByText('Não foi possível carregar as tarefas por status.')).not.toBeInTheDocument()
    // A atividade falha de novo no retry: o erro continua visível, sem afetar os outros blocos.
    expect(screen.getByText('Não foi possível carregar as atividades recentes.')).toBeInTheDocument()
  })

  it('rotula cada status de evento e formata o tempo relativo das atividades', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(summary)
    vi.mocked(getUpcomingEvents).mockResolvedValue((['PLANEJAMENTO', 'CONFIRMADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO'] as const)
      .map((status, index) => ({ id: `e${index}`, name: `Evento ${index}`, eventDate: '2026-11-10T15:00:00.000Z', location: 'Salão', status })))
    vi.mocked(getTasksByStatus).mockResolvedValue(statuses)
    vi.mocked(getRecentActivity).mockResolvedValue([
      { id: 'a1', message: 'agora', action: 'X', entity: 'Event', createdAt: minutesAgo(0) },
      { id: 'a2', message: 'minutos', action: 'X', entity: 'Event', createdAt: minutesAgo(15) },
      { id: 'a3', message: 'horas', action: 'X', entity: 'Event', createdAt: minutesAgo(180) },
      { id: 'a4', message: 'dias', action: 'X', entity: 'Event', createdAt: minutesAgo(60 * 24 * 2) },
      { id: 'a5', message: 'relógio adiantado', action: 'X', entity: 'Event', createdAt: minutesAgo(-5) },
    ])

    render(<DashboardPage />)

    expect(await screen.findByText('Evento 0')).toBeInTheDocument()
    for (const label of ['Planejamento', 'Confirmado', 'Concluído', 'Cancelado']) expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getAllByText('Agora')).toHaveLength(2)
    expect(screen.getByText('Há 15 min')).toBeInTheDocument()
    expect(screen.getByText('Há 3h')).toBeInTheDocument()
    expect(screen.getByText('Há 2d')).toBeInTheDocument()
  })
})
