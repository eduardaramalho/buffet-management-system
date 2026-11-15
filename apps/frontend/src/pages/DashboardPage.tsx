import { useState } from 'react'
import { getDashboardSummary, getTasksByStatus, getUpcomingEvents } from '../api/dashboardApi'
import { Badge } from '../components/Badge'
import { LoadBoundary } from '../components/LoadBoundary'
import { StatCard } from '../components/StatCard'
import { RefreshIndicator } from '../components/RefreshIndicator'
import { useInitialLoad } from '../hooks/useInitialLoad'
import { usePolling } from '../hooks/usePolling'
import { Table } from '../components/Table'
import type { DashboardSummary, TaskStatusCounts, UpcomingEvent } from '../types/dashboard'
import type { EventStatus } from '../types/event'
import type { TaskStatus } from '../types/task'
import { usePageTitle } from '../hooks/usePageTitle'

const emptyTasks: TaskStatusCounts = { PENDENTE: 0, EM_ANDAMENTO: 0, CONCLUIDA: 0, CANCELADA: 0 }
const statusLabels: Record<EventStatus, string> = { PLANEJAMENTO: 'Planejamento', CONFIRMADO: 'Confirmado', EM_ANDAMENTO: 'Em andamento', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' }
const statusTone: Record<EventStatus, 'admin' | 'editor' | 'viewer' | 'active' | 'inactive'> = { PLANEJAMENTO: 'viewer', CONFIRMADO: 'active', EM_ANDAMENTO: 'editor', CONCLUIDO: 'active', CANCELADO: 'inactive' }
const taskStatusLabels: Record<TaskStatus, string> = { PENDENTE: 'Pendente', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada' }
const taskStatusColors: Record<TaskStatus, string> = { PENDENTE: '#e5a72d', EM_ANDAMENTO: '#0d56bd', CONCLUIDA: '#278243', CANCELADA: '#c24c43' }
const taskStatuses: TaskStatus[] = ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA']
const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))

export function DashboardPage() {
  usePageTitle('Dashboard')
  const [summary, setSummary] = useState<DashboardSummary>()
  const [events, setEvents] = useState<UpcomingEvent[]>([])
  const [tasksByStatus, setTasksByStatus] = useState<TaskStatusCounts>(emptyTasks)

  // Cada bloco carrega e falha de forma independente: um bloco lento não segura os outros.
  const summaryLoad = useInitialLoad(getDashboardSummary, { onData: setSummary, errorMessage: 'Não foi possível carregar o resumo.' })
  const eventsLoad = useInitialLoad(getUpcomingEvents, { onData: setEvents, errorMessage: 'Não foi possível carregar os próximos eventos.' })
  const tasksLoad = useInitialLoad(getTasksByStatus, { onData: setTasksByStatus, errorMessage: 'Não foi possível carregar as tarefas por status.' })

  // O polling de cada bloco só começa depois da primeira carga; falha silenciosa mantém os dados e não exibe erro.
  const summaryPolling = usePolling(async () => setSummary(await getDashboardSummary()), { enabled: summaryLoad.status === 'ready' })
  const eventsPolling = usePolling(async () => setEvents(await getUpcomingEvents()), { enabled: eventsLoad.status === 'ready' })
  const tasksPolling = usePolling(async () => setTasksByStatus(await getTasksByStatus()), { enabled: tasksLoad.status === 'ready' })
  const pollings = [summaryPolling, eventsPolling, tasksPolling]
  const lastUpdatedAt = Math.max(...pollings.map((polling) => polling.lastUpdatedAt))
  const refreshing = pollings.some((polling) => polling.refreshing)
  const refreshAll = () => { pollings.forEach((polling) => void polling.refresh()) }

  const totalTasks = taskStatuses.reduce((total, status) => total + (tasksByStatus[status] ?? 0), 0)
  const donut = totalTasks === 0 ? 'var(--neutral-bg)' : `conic-gradient(${taskStatuses.map((status, index) => { const start = taskStatuses.slice(0, index).reduce((total, item) => total + (tasksByStatus[item] ?? 0), 0) / totalTasks * 100; const end = start + (tasksByStatus[status] ?? 0) / totalTasks * 100; return `${taskStatusColors[status]} ${start}% ${end}%` }).join(', ')})`

  return <main className="app-shell dashboard-page"><header><div><span className="eyebrow">PAINEL OPERACIONAL</span><h1>Dashboard</h1></div><RefreshIndicator lastUpdatedAt={lastUpdatedAt} refreshing={refreshing} onRefresh={refreshAll} /></header>
    <LoadBoundary status={summaryLoad.status} error={summaryLoad.error} onRetry={summaryLoad.retry} label="Carregando resumo...">{summary && <section className="summary"><StatCard icon="◈" value={summary.eventsThisMonth} label="Eventos este mês" tone="blue" /><StatCard icon="☰" value={summary.pendingTasks} label="Tarefas pendentes" tone="gold" /><StatCard icon="⚠" value={summary.overdueTasks} label="Tarefas atrasadas" tone="red" /><StatCard icon="♜" value={summary.activeTeams} label="Equipes ativas" tone="green" /><StatCard icon="✓" value={summary.completedOnTimePercentage === null ? '—' : `${summary.completedOnTimePercentage.toFixed(1)}%`} label="Concluídas no prazo" tone="purple" /></section>}</LoadBoundary>
    <div className="dashboard-grid"><section className="dashboard-panel"><div className="panel-heading"><h2>Próximos Eventos</h2></div><LoadBoundary status={eventsLoad.status} error={eventsLoad.error} onRetry={eventsLoad.retry} label="Carregando eventos..."><Table headers={['Data', 'Evento', 'Local', 'Status']}>{events.map((event) => <tr key={event.id}><td>{formatDate(event.eventDate)}</td><td><strong>{event.name}</strong></td><td>{event.location}</td><td><Badge tone={statusTone[event.status]}>{statusLabels[event.status]}</Badge></td></tr>)}</Table>{events.length === 0 && <p className="empty-state">Nenhum próximo evento.</p>}</LoadBoundary></section>
      <section className="dashboard-panel"><div className="panel-heading"><h2>Tarefas por Status</h2></div><LoadBoundary status={tasksLoad.status} error={tasksLoad.error} onRetry={tasksLoad.retry} label="Carregando tarefas..."><div className="task-chart"><div className="donut" style={{ background: donut }}><strong>{totalTasks}</strong><small>tarefas</small></div><ul className="chart-legend">{taskStatuses.map((status) => <li key={status}><span style={{ background: taskStatusColors[status] }} />{taskStatusLabels[status]}<strong>{tasksByStatus[status] ?? 0}</strong></li>)}</ul></div></LoadBoundary></section>
    </div>
  </main>
}
