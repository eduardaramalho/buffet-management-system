import { useEffect, useState } from 'react'
import { getDashboardSummary, getTasksByStatus, getUpcomingEvents } from '../api/dashboardApi'
import { getApiErrorMessage } from '../api/apiError'
import { Badge } from '../components/Badge'
import { StatCard } from '../components/StatCard'
import { RefreshIndicator } from '../components/RefreshIndicator'
import { usePolling } from '../hooks/usePolling'
import { Table } from '../components/Table'
import type { DashboardSummary, TaskStatusCounts, UpcomingEvent } from '../types/dashboard'
import type { EventStatus } from '../types/event'
import type { TaskStatus } from '../types/task'

type DashboardBlock = 'summary' | 'events' | 'tasks'
type BlockErrors = Partial<Record<DashboardBlock, string>>

const emptySummary: DashboardSummary = { eventsThisMonth: 0, pendingTasks: 0, overdueTasks: 0, activeTeams: 0, completedOnTimePercentage: null }
const emptyTasks: TaskStatusCounts = { PENDENTE: 0, EM_ANDAMENTO: 0, CONCLUIDA: 0, CANCELADA: 0 }
const statusLabels: Record<EventStatus, string> = { PLANEJAMENTO: 'Planejamento', CONFIRMADO: 'Confirmado', EM_ANDAMENTO: 'Em andamento', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' }
const statusTone: Record<EventStatus, 'admin' | 'editor' | 'viewer' | 'active' | 'inactive'> = { PLANEJAMENTO: 'viewer', CONFIRMADO: 'active', EM_ANDAMENTO: 'editor', CONCLUIDO: 'active', CANCELADO: 'inactive' }
const taskStatusLabels: Record<TaskStatus, string> = { PENDENTE: 'Pendente', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada' }
const taskStatusColors: Record<TaskStatus, string> = { PENDENTE: '#e5a72d', EM_ANDAMENTO: '#0d56bd', CONCLUIDA: '#278243', CANCELADA: '#c24c43' }
const taskStatuses: TaskStatus[] = ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA']
const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))

function BlockError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="alert error"><span>{message}</span><button type="button" onClick={onRetry}>Tentar de novo</button></div>
}

export function DashboardPage() {
  const [summary, setSummary] = useState(emptySummary)
  const [events, setEvents] = useState<UpcomingEvent[]>([])
  const [tasksByStatus, setTasksByStatus] = useState<TaskStatusCounts>(emptyTasks)
  const [errors, setErrors] = useState<BlockErrors>({})

  const loadBlock = async (block: DashboardBlock) => {
    setErrors((current) => ({ ...current, [block]: undefined }))
    try {
      if (block === 'summary') setSummary(await getDashboardSummary())
      if (block === 'events') setEvents(await getUpcomingEvents())
      if (block === 'tasks') setTasksByStatus(await getTasksByStatus())
    } catch (cause) {
      const labels: Record<DashboardBlock, string> = { summary: 'o resumo', events: 'os próximos eventos', tasks: 'as tarefas por status' }
      setErrors((current) => ({ ...current, [block]: getApiErrorMessage(cause, `Não foi possível carregar ${labels[block]}.`) }))
    }
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      const results = await Promise.allSettled([getDashboardSummary(), getUpcomingEvents(), getTasksByStatus()])
      if (!active) return
      const [nextSummary, nextEvents, nextTasks] = results
      if (nextSummary.status === 'fulfilled') setSummary(nextSummary.value)
      else setErrors((current) => ({ ...current, summary: getApiErrorMessage(nextSummary.reason, 'Não foi possível carregar o resumo.') }))
      if (nextEvents.status === 'fulfilled') setEvents(nextEvents.value)
      else setErrors((current) => ({ ...current, events: getApiErrorMessage(nextEvents.reason, 'Não foi possível carregar os próximos eventos.') }))
      if (nextTasks.status === 'fulfilled') setTasksByStatus(nextTasks.value)
      else setErrors((current) => ({ ...current, tasks: getApiErrorMessage(nextTasks.reason, 'Não foi possível carregar as tarefas por status.') }))
    }
    void load()
    return () => { active = false }
  }, [])

  // Cada bloco é atualizado de forma independente; falha silenciosa mantém os dados e não exibe erro.
  const pollBlock = <T,>(block: DashboardBlock, fetcher: () => Promise<T>, apply: (value: T) => void) => async () => {
    apply(await fetcher())
    setErrors((current) => current[block] ? { ...current, [block]: undefined } : current)
  }
  const summaryPolling = usePolling(pollBlock('summary', getDashboardSummary, setSummary))
  const eventsPolling = usePolling(pollBlock('events', getUpcomingEvents, setEvents))
  const tasksPolling = usePolling(pollBlock('tasks', getTasksByStatus, setTasksByStatus))
  const pollings = [summaryPolling, eventsPolling, tasksPolling]
  const lastUpdatedAt = Math.max(...pollings.map((polling) => polling.lastUpdatedAt))
  const refreshing = pollings.some((polling) => polling.refreshing)
  const refreshAll = () => { pollings.forEach((polling) => void polling.refresh()) }

  const totalTasks = taskStatuses.reduce((total, status) => total + (tasksByStatus[status] ?? 0), 0)
  const donut = totalTasks === 0 ? 'var(--neutral-bg)' : `conic-gradient(${taskStatuses.map((status, index) => { const start = taskStatuses.slice(0, index).reduce((total, item) => total + (tasksByStatus[item] ?? 0), 0) / totalTasks * 100; const end = start + (tasksByStatus[status] ?? 0) / totalTasks * 100; return `${taskStatusColors[status]} ${start}% ${end}%` }).join(', ')})`

  return <main className="app-shell dashboard-page"><header><div><span className="eyebrow">PAINEL OPERACIONAL</span><h1>Dashboard</h1></div><RefreshIndicator lastUpdatedAt={lastUpdatedAt} refreshing={refreshing} onRefresh={refreshAll} /></header>
    <section className="summary">{errors.summary && <BlockError message={errors.summary} onRetry={() => void loadBlock('summary')} />}<StatCard icon="◈" value={summary.eventsThisMonth} label="Eventos este mês" tone="blue" /><StatCard icon="☰" value={summary.pendingTasks} label="Tarefas pendentes" tone="gold" /><StatCard icon="⚠" value={summary.overdueTasks} label="Tarefas atrasadas" tone="red" /><StatCard icon="♜" value={summary.activeTeams} label="Equipes ativas" tone="green" /><StatCard icon="✓" value={summary.completedOnTimePercentage === null ? '—' : `${summary.completedOnTimePercentage.toFixed(1)}%`} label="Concluídas no prazo" tone="purple" /></section>
    <div className="dashboard-grid"><section className="dashboard-panel"><div className="panel-heading"><h2>Próximos Eventos</h2></div>{errors.events && <BlockError message={errors.events} onRetry={() => void loadBlock('events')} />}<Table headers={['Data', 'Evento', 'Local', 'Status']}>{events.map((event) => <tr key={event.id}><td>{formatDate(event.eventDate)}</td><td><strong>{event.name}</strong></td><td>{event.location}</td><td><Badge tone={statusTone[event.status]}>{statusLabels[event.status]}</Badge></td></tr>)}</Table>{events.length === 0 && <p className="empty-state">Nenhum próximo evento.</p>}</section>
      <section className="dashboard-panel"><div className="panel-heading"><h2>Tarefas por Status</h2></div>{errors.tasks && <BlockError message={errors.tasks} onRetry={() => void loadBlock('tasks')} />}<div className="task-chart"><div className="donut" style={{ background: donut }}><strong>{totalTasks}</strong><small>tarefas</small></div><ul className="chart-legend">{taskStatuses.map((status) => <li key={status}><span style={{ background: taskStatusColors[status] }} />{taskStatusLabels[status]}<strong>{tasksByStatus[status] ?? 0}</strong></li>)}</ul></div></section>
    </div>
  </main>
}
