import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportsPage } from './ReportsPage'
import { downloadReport, getEventsReport, getTasksReport, getTeamPerformanceReport } from '../api/reportsApi'
import { listTeams } from '../api/teamsApi'
import { listClients } from '../api/clientsApi'
import { currentMonthRange, toApiPeriod } from '../utils/reportPeriod'
import type { EventsReport, TasksReport, TeamPerformanceReport } from '../types/report'

vi.mock('../api/reportsApi', () => ({ getEventsReport: vi.fn(), getTasksReport: vi.fn(), getTeamPerformanceReport: vi.fn(), downloadReport: vi.fn() }))
vi.mock('../api/teamsApi', () => ({ listTeams: vi.fn() }))
vi.mock('../api/clientsApi', () => ({ listClients: vi.fn() }))

const period = toApiPeriod(currentMonthRange())
const pagination = { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 }

const eventsReport: EventsReport = {
  period,
  summary: {
    total: 1,
    byStatus: { PLANEJAMENTO: 0, CONFIRMADO: 1, EM_ANDAMENTO: 0, CONCLUIDO: 0, CANCELADO: 0 },
    byServiceType: { CASAMENTO: 1, ANIVERSARIO: 0, FORMATURA: 0, CORPORATIVO: 0, CONFRATERNIZACAO: 0, BATIZADO: 0, OUTRO: 0 },
  },
  items: [{ id: 'event-1', name: 'Casamento Ana', eventDate: '2026-10-10T22:00:00.000Z', status: 'CONFIRMADO', serviceType: 'CASAMENTO', guestsCount: 120, clientName: null, tasksTotal: 4, tasksCompleted: 1 }],
  pagination,
}

const tasksReport: TasksReport = {
  period,
  summary: {
    total: 1,
    byStatus: { PENDENTE: 1, EM_ANDAMENTO: 0, CONCLUIDA: 0, CANCELADA: 0 },
    byOrigin: { REGRA: 1, MANUAL: 0 },
    overdueOpen: 1,
    completedOnTime: 0,
    completedLate: 0,
    canceled: 0,
    onTimePercentage: null,
  },
  items: [{
    id: 'task-1', title: 'Comprar insumos', status: 'PENDENTE', dueDate: '2026-10-20T12:00:00.000Z', completedAt: null, createdAt: '2026-10-01T12:00:00.000Z', assignedAt: null,
    eventId: 'event-1', eventName: 'Casamento Ana', eventDate: '2026-10-25T22:00:00.000Z', teamName: null, origin: 'REGRA', overdue: true, completedLate: false,
  }],
  pagination,
}

const teamsReport: TeamPerformanceReport = {
  period,
  summary: { teams: 1, tasks: 10, completedOnTime: 3, completedLate: 1, overdueOpen: 2, canceled: 1, onTimePercentage: 75, avgAssignmentMinutes: { REGRA: 60, MANUAL: null } },
  items: [{ teamId: 'team-1', teamName: 'Cozinha A', specialty: 'COZINHA', total: 10, completed: 6, completedOnTime: 3, completedLate: 1, overdueOpen: 2, canceled: 1, onTimePercentage: 75, avgAssignmentMinutes: { REGRA: 60, MANUAL: null } }],
}

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getEventsReport).mockResolvedValue(eventsReport)
    vi.mocked(getTasksReport).mockResolvedValue(tasksReport)
    vi.mocked(getTeamPerformanceReport).mockResolvedValue(teamsReport)
    vi.mocked(listTeams).mockResolvedValue([{ id: 'team-1', name: 'Cozinha A' }] as never)
    vi.mocked(listClients).mockResolvedValue([{ id: 'client-1', name: 'Ana Souza' }] as never)
  })

  it('opens on the events report for the current month with summary, chart and table', async () => {
    render(<ReportsPage />)

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Casamento Ana')).toBeInTheDocument()
    expect(within(table).getByText('1/4')).toBeInTheDocument()
    expect(within(table).getByText('-')).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: 'Eventos por status' })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: 'Eventos por tipo' })).toBeInTheDocument()
    expect(screen.getByText('Total de eventos')).toBeInTheDocument()
    expect(getEventsReport).toHaveBeenCalledWith(period, { status: '', serviceType: '', clientId: '' }, { page: 1, pageSize: 20 })
  })

  it('refetches from the first page when a filter changes and offers clients as a filter', async () => {
    vi.mocked(getEventsReport).mockResolvedValue({ ...eventsReport, pagination: { page: 1, pageSize: 20, totalItems: 45, totalPages: 3 } })
    render(<ReportsPage />)
    await screen.findByText('Casamento Ana')

    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    await waitFor(() => expect(getEventsReport).toHaveBeenLastCalledWith(period, expect.anything(), { page: 2, pageSize: 20 }))
    fireEvent.change(await screen.findByLabelText('Cliente'), { target: { value: 'client-1' } })
    fireEvent.change(screen.getByLabelText('Status do evento'), { target: { value: 'CONFIRMADO' } })

    await waitFor(() => expect(getEventsReport).toHaveBeenLastCalledWith(period, { status: 'CONFIRMADO', serviceType: '', clientId: 'client-1' }, { page: 1, pageSize: 20 }))
  })

  it('validates the period before calling the API', async () => {
    render(<ReportsPage />)
    await screen.findByText('Casamento Ana')
    const calls = vi.mocked(getEventsReport).mock.calls.length

    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2000-01-01' } })

    expect(await screen.findByText('A data final deve ser igual ou posterior à data inicial.')).toBeInTheDocument()
    expect(getEventsReport).toHaveBeenCalledTimes(calls)
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled()
  })

  it('shows the tasks report with origin, team filter and the forgotten-task flag', async () => {
    render(<ReportsPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Tarefas' }))

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Comprar insumos')).toBeInTheDocument()
    expect(within(table).getByText('Regra')).toBeInTheDocument()
    expect(within(table).getByText('Atrasada')).toBeInTheDocument()
    expect(screen.getByText('Atrasadas em aberto (esquecidas)')).toBeInTheDocument()

    fireEvent.change(await screen.findByLabelText('Equipe'), { target: { value: 'team-1' } })
    fireEvent.change(screen.getByLabelText('Origem'), { target: { value: 'MANUAL' } })
    await waitFor(() => expect(getTasksReport).toHaveBeenLastCalledWith(period, { status: '', teamId: 'team-1', origin: 'MANUAL' }, { page: 1, pageSize: 20 }))
  })

  it('shows team performance with punctuality and assignment time by origin', async () => {
    render(<ReportsPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Desempenho das equipes' }))

    const table = await screen.findByRole('table')
    const row = within(table).getByText('Cozinha A').closest('tr') as HTMLElement
    expect(within(row).getByText('75%')).toBeInTheDocument()
    expect(within(row).getByText('60 min')).toBeInTheDocument()
    expect(within(row).getByText('Sem dados')).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: 'Pontualidade por equipe' })).toBeInTheDocument()
    expect(getTeamPerformanceReport).toHaveBeenCalledWith(period)
  })

  it('exports the current report with its filters as CSV and PDF', async () => {
    vi.mocked(downloadReport).mockResolvedValue(undefined)
    render(<ReportsPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Tarefas' }))
    await screen.findByText('Comprar insumos')

    fireEvent.change(screen.getByLabelText('Origem'), { target: { value: 'REGRA' } })
    fireEvent.click(screen.getByRole('button', { name: 'Exportar PDF' }))
    await waitFor(() => expect(downloadReport).toHaveBeenCalledWith('tasks', period, { status: '', teamId: '', origin: 'REGRA' }, 'pdf'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar PDF' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))

    await waitFor(() => expect(downloadReport).toHaveBeenLastCalledWith('tasks', period, { status: '', teamId: '', origin: 'REGRA' }, 'csv'))
  })

  it('shows export failures', async () => {
    vi.mocked(downloadReport).mockRejectedValue(new Error('Falha ao gerar o arquivo'))
    render(<ReportsPage />)
    await screen.findByText('Casamento Ana')

    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))

    expect(await screen.findByText('Falha ao gerar o arquivo')).toBeInTheDocument()
  })

  it('shows load errors with a retry action', async () => {
    vi.mocked(getEventsReport).mockRejectedValueOnce(new Error('Servidor indisponível')).mockResolvedValueOnce(eventsReport)
    render(<ReportsPage />)

    expect(await screen.findByText('Servidor indisponível')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByText('Casamento Ana')).toBeInTheDocument()
  })

  it('shows an empty state and hides filters whose options could not be loaded', async () => {
    vi.mocked(listClients).mockRejectedValue(new Error('403'))
    vi.mocked(getEventsReport).mockResolvedValue({ ...eventsReport, summary: { ...eventsReport.summary, total: 0 }, items: [], pagination: { ...pagination, totalItems: 0, totalPages: 0 } })
    render(<ReportsPage />)

    expect(await screen.findByText('Nenhum evento no período.')).toBeInTheDocument()
    await waitFor(() => expect(listClients).toHaveBeenCalled())
    expect(screen.queryByLabelText('Cliente')).not.toBeInTheDocument()
  })
})
