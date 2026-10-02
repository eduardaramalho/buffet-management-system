import { useEffect, useMemo, useState } from 'react'
import { listTasks, updateTaskStatus } from '../api/tasksApi'
import { listEvents } from '../api/eventsApi'
import { listTeams } from '../api/teamsApi'
import { Badge } from '../components/Badge'
import { Notice } from '../components/Notice'
import { StatCard } from '../components/StatCard'
import { TASK_STATUSES, TERMINAL_TASK_STATUSES } from '../types/task'
import type { Task, TaskStatus } from '../types/task'
import type { Event } from '../types/event'
import type { Team } from '../types/team'

const STATUS_LABELS: Record<TaskStatus, string> = { PENDENTE: 'Pendente', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada' }
const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))

function TaskCard({ task, event, team, onMove }: { task: Task; event?: Event; team?: Team; onMove: (task: Task, status: TaskStatus) => void }) {
  const isTerminal = TERMINAL_TASK_STATUSES.includes(task.status)
  const destinations = TASK_STATUSES.filter((status) => status !== task.status)

  return <article className="task-card">
    <div className="task-card-head">
      <h4>{task.title}</h4>
      {task.sourceRuleId && <Badge tone="neutral">Gerada automaticamente</Badge>}
    </div>
    <p className="task-card-event">{event ? `${event.name} • ${formatDate(event.eventDate)}` : 'Evento não encontrado'}</p>
    {task.assignedTeamId
      ? <p className="task-card-team">{team?.name ?? 'Equipe'}</p>
      : <p className="task-no-team" role="status">⚠ Sem equipe — ação necessária</p>}
    {task.dueDate && <p className="task-card-due">Prazo: {formatDate(task.dueDate)}</p>}
    <label className="task-move">
      Mover para...
      <select
        aria-label={`Mover ${task.title}`}
        disabled={isTerminal}
        value=""
        onChange={(changeEvent) => {
          const nextStatus = changeEvent.target.value as TaskStatus | ''
          if (nextStatus) onMove(task, nextStatus)
        }}
      >
        <option value="">Mover para...</option>
        {!isTerminal && destinations.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
      </select>
    </label>
  </article>
}

export function TasksBoardPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [eventSearch, setEventSearch] = useState('')
  const [teamId, setTeamId] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const [taskList, eventList, teamList] = await Promise.all([listTasks(), listEvents(), listTeams()])
      setTasks(taskList)
      setEvents(eventList)
      setTeams(teamList)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao carregar tarefas')
    }
  }
  useEffect(() => { void load() }, [])

  const eventsById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events])
  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams])

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (teamId && task.assignedTeamId !== teamId) return false
    if (eventSearch) {
      const event = eventsById.get(task.eventId)
      if (!event || !event.name.toLowerCase().includes(eventSearch.toLowerCase())) return false
    }
    return true
  }), [tasks, teamId, eventSearch, eventsById])

  const columns = TASK_STATUSES.map((status) => ({ status, items: filteredTasks.filter((task) => task.status === status) }))
  const noTeamCount = tasks.filter((task) => !task.assignedTeamId && !TERMINAL_TASK_STATUSES.includes(task.status)).length

  const move = async (task: Task, status: TaskStatus) => {
    try {
      const updated = await updateTaskStatus(task.id, status)
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item))
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao mover tarefa')
    }
  }

  return <main className="app-shell">
    <header><div><span className="eyebrow">MOTOR DE REGRAS</span><h1>Tarefas</h1></div></header>
    <section className="summary">
      <StatCard icon="☰" value={tasks.length} label="Total de tarefas" tone="blue" />
      <StatCard icon="⚠" value={noTeamCount} label="Sem equipe — ação necessária" tone="gold" />
    </section>
    <section className="content-head">
      <input className="search" aria-label="Buscar por evento" placeholder="Buscar por nome do evento..." value={eventSearch} onChange={(changeEvent) => setEventSearch(changeEvent.target.value)} />
      <select aria-label="Equipe" value={teamId} onChange={(changeEvent) => setTeamId(changeEvent.target.value)}>
        <option value="">Todas as equipes</option>
        {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
      </select>
    </section>
    {error && <Notice message={error} error />}
    <div className="task-board">
      {columns.map((column) => <section key={column.status} className="task-column" aria-label={STATUS_LABELS[column.status]}>
        <h3>{STATUS_LABELS[column.status]} <Badge tone="neutral">{String(column.items.length)}</Badge></h3>
        {column.items.map((task) => <TaskCard key={task.id} task={task} event={eventsById.get(task.eventId)} team={task.assignedTeamId ? teamsById.get(task.assignedTeamId) : undefined} onMove={(movedTask, status) => void move(movedTask, status)} />)}
        {column.items.length === 0 && <p className="empty">Nenhuma tarefa.</p>}
      </section>)}
    </div>
  </main>
}
