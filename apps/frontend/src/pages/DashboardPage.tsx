import { useEffect, useState } from 'react'
import { getDashboardSummary, getRecentActivity, getTasksByStatus, getUpcomingEvents } from '../api/dashboardApi'
import { Badge } from '../components/Badge'
import { Notice } from '../components/Notice'
import { StatCard } from '../components/StatCard'
import { Table } from '../components/Table'
import type { DashboardSummary, RecentActivity, TaskStatusCounts, UpcomingEvent } from '../types/dashboard'
import type { EventStatus } from '../types/event'
import type { TaskStatus } from '../types/task'

const emptySummary: DashboardSummary = { eventsThisMonth: 0, pendingTasks: 0, activeTeams: 0, completedOnTimePercentage: null }
const statusLabels: Record<EventStatus, string> = { PLANEJAMENTO: 'Planejamento', CONFIRMADO: 'Confirmado', EM_ANDAMENTO: 'Em andamento', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' }
const statusTone: Record<EventStatus, 'admin' | 'editor' | 'viewer' | 'active' | 'inactive'> = { PLANEJAMENTO: 'viewer', CONFIRMADO: 'active', EM_ANDAMENTO: 'editor', CONCLUIDO: 'active', CANCELADO: 'inactive' }
const taskStatusLabels: Record<TaskStatus, string> = { PENDENTE: 'Pendente', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada' }
const taskStatusColors: Record<TaskStatus, string> = { PENDENTE: '#e5a72d', EM_ANDAMENTO: '#0d56bd', CONCLUIDA: '#278243', CANCELADA: '#c24c43' }
const taskStatuses: TaskStatus[] = ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA']
const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
const relativeTime = (value: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 1) return 'Agora'
  if (minutes < 60) return `Há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Há ${hours}h`
  return `Há ${Math.floor(hours / 24)}d`
}

export function DashboardPage() {
  const [summary, setSummary] = useState(emptySummary)
  const [events, setEvents] = useState<UpcomingEvent[]>([])
  const [tasksByStatus, setTasksByStatus] = useState<TaskStatusCounts>({ PENDENTE: 0, EM_ANDAMENTO: 0, CONCLUIDA: 0, CANCELADA: 0 })
  const [activity, setActivity] = useState<RecentActivity[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getDashboardSummary(), getUpcomingEvents(), getTasksByStatus(), getRecentActivity()])
      .then(([nextSummary, nextEvents, nextTasks, nextActivity]) => { setSummary(nextSummary); setEvents(nextEvents); setTasksByStatus(nextTasks); setActivity(nextActivity); setError('') })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Erro ao carregar dashboard'))
  }, [])

  const totalTasks = taskStatuses.reduce((total, status) => total + (tasksByStatus[status] ?? 0), 0)
  const donut = totalTasks === 0 ? 'var(--neutral-bg)' : `conic-gradient(${taskStatuses.map((status, index) => { const start = taskStatuses.slice(0, index).reduce((total, item) => total + (tasksByStatus[item] ?? 0), 0) / totalTasks * 100; const end = start + (tasksByStatus[status] ?? 0) / totalTasks * 100; return `${taskStatusColors[status]} ${start}% ${end}%` }).join(', ')})`

  return <main className="app-shell dashboard-page"><header><div><span className="eyebrow">PAINEL OPERACIONAL</span><h1>Dashboard</h1></div></header>{error && <Notice message={error} error />}<section className="summary"><StatCard icon="◈" value={summary.eventsThisMonth} label="Eventos este mês" tone="blue" /><StatCard icon="☰" value={summary.pendingTasks} label="Tarefas pendentes" tone="gold" /><StatCard icon="♜" value={summary.activeTeams} label="Equipes ativas" tone="green" /><StatCard icon="✓" value={summary.completedOnTimePercentage === null ? '—' : `${summary.completedOnTimePercentage.toFixed(1)}%`} label="Concluídas no prazo" tone="purple" /></section><div className="dashboard-grid"><section className="dashboard-panel"><div className="panel-heading"><h2>Próximos Eventos</h2></div><Table headers={['Data', 'Evento', 'Local', 'Status']}>{events.map((event) => <tr key={event.id}><td>{formatDate(event.eventDate)}</td><td><strong>{event.name}</strong></td><td>{event.location}</td><td><Badge tone={statusTone[event.status]}>{statusLabels[event.status]}</Badge></td></tr>)}</Table>{events.length === 0 && <p className="empty-state">Nenhum próximo evento.</p>}</section><section className="dashboard-panel"><div className="panel-heading"><h2>Tarefas por Status</h2></div><div className="task-chart"><div className="donut" style={{ background: donut }}><strong>{totalTasks}</strong><small>tarefas</small></div><ul className="chart-legend">{taskStatuses.map((status) => <li key={status}><span style={{ background: taskStatusColors[status] }} />{taskStatusLabels[status]}<strong>{tasksByStatus[status] ?? 0}</strong></li>)}</ul></div></section><section className="dashboard-panel activity-panel"><div className="panel-heading"><h2>Atividades recentes</h2></div>{activity.length === 0 ? <p className="empty-state">Nenhuma atividade recente.</p> : <ul className="activity-list">{activity.map((item) => <li key={item.id}><span className="activity-dot" /><div><strong>{item.message}</strong><small>{relativeTime(item.createdAt)}</small></div></li>)}</ul>}</section></div></main>
}
