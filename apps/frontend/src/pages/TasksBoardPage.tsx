import { useEffect, useMemo, useState } from 'react'
import { getApiErrorMessage } from '../api/apiError'
import { listTasks, removeTask, updateTaskStatus } from '../api/tasksApi'
import { listEvents } from '../api/eventsApi'
import { listTeams } from '../api/teamsApi'
import { Badge } from '../components/Badge'
import { Notice } from '../components/Notice'
import { RefreshIndicator } from '../components/RefreshIndicator'
import { usePolling } from '../hooks/usePolling'
import { Icon } from '../components/Icon'
import { TaskForm } from '../components/TaskForm'
import { useAuth } from '../contexts/useAuth'
import { StatCard } from '../components/StatCard'
import { getTaskDestinations, TASK_STATUSES, TERMINAL_TASK_STATUSES } from '../types/task'
import type { Task, TaskStatus } from '../types/task'
import type { Event } from '../types/event'
import type { Team } from '../types/team'

const STATUS_LABELS: Record<TaskStatus, string> = { PENDENTE: 'Pendente', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada' }
const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))

type TaskCardProps = {
  task: Task
  event?: Event
  team?: Team
  canEdit: boolean
  canDelete: boolean
  onMove: (task: Task, status: TaskStatus) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

function TaskCard({ task, event, team, canEdit, canDelete, onMove, onEdit, onDelete }: TaskCardProps) {
  const isTerminal = TERMINAL_TASK_STATUSES.includes(task.status)
  // ADR 0014: only the next valid statuses; the backend enforces the same matrix.
  const destinations = getTaskDestinations(task.status, event?.status)
  // O backend recusa editar/excluir tarefa terminal, então a interface nem oferece a ação.
  const showEdit = canEdit && !isTerminal
  const showDelete = canDelete && !isTerminal

  return <article className="task-card">
    <div className="task-card-head">
      <h4>{task.title}</h4>
      {task.sourceRuleId && <Badge tone="neutral">Gerada automaticamente</Badge>}
    </div>
    <p className="task-card-event">{event ? `${event.name} • ${formatDate(event.eventDate)}` : 'Evento não encontrado'}</p>
    {task.assignedTeamId
      ? <p className="task-card-team">{team?.name ?? 'Equipe'}</p>
      : <p className="task-no-team" role="status"><Icon name="alert" />Sem equipe — ação necessária</p>}
    {!task.assignedTeamId && showEdit && <button type="button" className="secondary task-assign" aria-label={`Atribuir equipe a ${task.title}`} onClick={() => onEdit(task)}><Icon name="users" />Atribuir equipe</button>}
    {task.dueDate && <p className="task-card-due">Prazo: {formatDate(task.dueDate)}</p>}
    <label className="task-move">
      Mover para...
      <select
        aria-label={`Mover ${task.title}`}
        disabled={destinations.length === 0}
        value=""
        onChange={(changeEvent) => {
          const nextStatus = changeEvent.target.value as TaskStatus | ''
          if (nextStatus) onMove(task, nextStatus)
        }}
      >
        <option value="">Mover para...</option>
        {destinations.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
      </select>
    </label>
    {(showEdit || showDelete) && <div className="task-actions row-actions">
      {showEdit && <button type="button" title="Editar tarefa" aria-label={`Editar ${task.title}`} onClick={() => onEdit(task)}><Icon name="pencil" /></button>}
      {showDelete && <button type="button" title="Excluir tarefa" aria-label={`Excluir ${task.title}`} onClick={() => onDelete(task)}><Icon name="trash" /></button>}
    </div>}
  </article>
}

export function TasksBoardPage() {
  const { user } = useAuth()
  const hasPermission = (permission: string) => user?.roles?.some((role) => role.permissions.includes(permission)) ?? false
  const canCreate = hasPermission('tasks:create')
  const canEdit = hasPermission('tasks:update')
  const canDelete = hasPermission('tasks:delete')
  const canListTeams = hasPermission('teams:list')
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task>()
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [eventSearch, setEventSearch] = useState('')
  const [teamId, setTeamId] = useState('')
  const [error, setError] = useState('')

  // Rejeita em caso de erro: o polling silencioso o ignora e mantém os dados atuais.
  const fetchAll = async () => {
    // Equipes só para quem pode listá-las: o colaborador vê e move tarefas sem acesso ao cadastro de equipes.
    const [taskList, eventList, teamList] = await Promise.all([listTasks(), listEvents(), canListTeams ? listTeams() : Promise.resolve([])])
    setTasks(taskList)
    setEvents(eventList)
    setTeams(teamList)
    setError('')
  }
  const load = async () => {
    try { await fetchAll() } catch (cause) {
      setError(getApiErrorMessage(cause, 'Erro ao carregar tarefas'))
    }
  }
  useEffect(() => { void load() }, [])
  const { lastUpdatedAt, refreshing, refresh } = usePolling(fetchAll)

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
      setError(getApiErrorMessage(cause, 'Falha ao mover tarefa'))
    }
  }

  const openForm = (taskToEdit?: Task) => { setEditingTask(taskToEdit); setFormOpen(true) }
  const closeForm = () => { setFormOpen(false); setEditingTask(undefined) }
  const saveTask = (saved: Task) => {
    setTasks((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current])
    setError('')
  }
  const remove = async (taskToRemove: Task) => {
    const warning = taskToRemove.sourceRuleId ? ' Ela foi gerada por uma regra e não será recriada.' : ''
    if (!window.confirm(`Excluir a tarefa "${taskToRemove.title}"?${warning}`)) return
    try {
      await removeTask(taskToRemove.id)
      setTasks((current) => current.filter((item) => item.id !== taskToRemove.id))
      setError('')
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Falha ao excluir tarefa'))
    }
  }

  return <main className="app-shell">
    <header><div><span className="eyebrow">MOTOR DE REGRAS</span><h1>Tarefas</h1></div><div className="header-actions"><RefreshIndicator lastUpdatedAt={lastUpdatedAt} refreshing={refreshing} onRefresh={() => void refresh()} />{canCreate && <button type="button" className="secondary" onClick={() => openForm()}><Icon name="plus" />Nova tarefa</button>}</div></header>
    <section className="summary">
      <StatCard icon="☰" value={tasks.length} label="Total de tarefas" tone="blue" />
      <StatCard icon="⚠" value={noTeamCount} label="Sem equipe — ação necessária" tone="gold" />
    </section>
    <section className="content-head">
      <input className="search" aria-label="Buscar por evento" placeholder="Buscar por nome do evento..." value={eventSearch} onChange={(changeEvent) => setEventSearch(changeEvent.target.value)} />
      {canListTeams && <select aria-label="Equipe" value={teamId} onChange={(changeEvent) => setTeamId(changeEvent.target.value)}>
        <option value="">Todas as equipes</option>
        {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
      </select>}
    </section>
    {error && <Notice message={error} error />}
    <div className="task-board">
      {columns.map((column) => <section key={column.status} className="task-column" aria-label={STATUS_LABELS[column.status]}>
        <h3>{STATUS_LABELS[column.status]} <Badge tone="neutral">{String(column.items.length)}</Badge></h3>
        {column.items.map((task) => <TaskCard key={task.id} task={task} event={eventsById.get(task.eventId)} team={task.assignedTeamId ? teamsById.get(task.assignedTeamId) : undefined} canEdit={canEdit} canDelete={canDelete} onMove={(movedTask, status) => void move(movedTask, status)} onEdit={openForm} onDelete={(taskToRemove) => void remove(taskToRemove)} />)}
        {column.items.length === 0 && <p className="empty">Nenhuma tarefa.</p>}
      </section>)}
    </div>
    {formOpen && <TaskForm task={editingTask} events={events} teams={teams} onClose={closeForm} onSaved={saveTask} />}
  </main>
}
