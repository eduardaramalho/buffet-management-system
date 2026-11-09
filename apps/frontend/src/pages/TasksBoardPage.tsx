import { useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, type Announcements, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { getApiErrorMessage } from '../api/apiError'
import { listTasks, removeTask, updateTaskStatus } from '../api/tasksApi'
import { listEvents } from '../api/eventsApi'
import { listTeams } from '../api/teamsApi'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Icon } from '../components/Icon'
import { Notice } from '../components/Notice'
import { RefreshIndicator } from '../components/RefreshIndicator'
import { TaskForm } from '../components/TaskForm'
import { DraggableTaskCard, TaskCardPreview, type TaskCardHighlight } from '../components/tasks/TaskCard'
import { TaskColumn, type ColumnDropState } from '../components/tasks/TaskColumn'
import { TaskDetailDialog } from '../components/tasks/TaskDetailDialog'
import { TaskFilterMenu } from '../components/tasks/TaskFilterMenu'
import { useAuth } from '../contexts/useAuth'
import { useToast } from '../contexts/toast'
import { usePolling } from '../hooks/usePolling'
import { getTaskDestinations, TASK_STATUSES, TERMINAL_TASK_STATUSES } from '../types/task'
import type { Task, TaskStatus } from '../types/task'
import type { Event } from '../types/event'
import type { Team } from '../types/team'
import { TASK_STATUS_LABELS } from '../utils/labels'
import { decideTaskDrop, getMoveBlockReason } from '../utils/taskBoard'
import { isTaskOverdue, sortTasksBySchedule } from '../utils/taskSchedule'

const HIGHLIGHT_MS = 900
const dayMonth = (value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(value))
const plural = (count: number, singular: string, pluralForm: string) => `${count} ${count === 1 ? singular : pluralForm}`
const titleOf = (data: unknown) => (data as { current?: { title?: string } } | undefined)?.current?.title ?? 'selecionada'
const columnLabel = (id: unknown) => TASK_STATUS_LABELS[id as TaskStatus] ?? String(id)

// Anúncios do arraste para leitores de tela, em português (o padrão do dnd-kit é em inglês).
const announcements: Announcements = {
  onDragStart: ({ active }) => `Tarefa ${titleOf(active.data)} selecionada.`,
  onDragOver: ({ over }) => (over ? `Sobre a coluna ${columnLabel(over.id)}.` : 'Fora das colunas.'),
  onDragEnd: ({ active, over }) => (over ? `Tarefa ${titleOf(active.data)} solta na coluna ${columnLabel(over.id)}.` : `Tarefa ${titleOf(active.data)} solta fora das colunas.`),
  onDragCancel: ({ active }) => `Movimento de ${titleOf(active.data)} cancelado.`,
}

type PendingConfirm = { kind: 'cancel' | 'delete'; task: Task }

export function TasksBoardPage() {
  const { user } = useAuth()
  const toast = useToast()
  const hasPermission = (permission: string) => user?.roles?.some((role) => role.permissions.includes(permission)) ?? false
  const canCreate = hasPermission('tasks:create')
  const canEdit = hasPermission('tasks:update')
  const canDelete = hasPermission('tasks:delete')
  const canMove = hasPermission('tasks:update-status')
  const canComment = hasPermission('tasks:comment')
  const canListTeams = hasPermission('teams:list')

  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [teamId, setTeamId] = useState('')
  const [eventId, setEventId] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [savingIds, setSavingIds] = useState<ReadonlySet<string>>(new Set())
  const [highlights, setHighlights] = useState<Record<string, TaskCardHighlight>>({})
  const [detailId, setDetailId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task>()
  // Moves still waiting for the API: a polling round must not overwrite their optimistic status.
  const pendingMoves = useRef(new Set<string>())
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  // Rejeita em caso de erro: o polling silencioso o ignora e mantém os dados atuais.
  const fetchAll = async () => {
    // Equipes só para quem pode listá-las: o colaborador vê e move tarefas sem acesso ao cadastro de equipes.
    const [taskList, eventList, teamList] = await Promise.all([listTasks(), listEvents(), canListTeams ? listTeams() : Promise.resolve([])])
    setTasks((current) => taskList.map((fresh) => (pendingMoves.current.has(fresh.id) ? current.find((item) => item.id === fresh.id) ?? fresh : fresh)))
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
  const findTask = (id: string) => tasks.find((item) => item.id === id)
  const eventStatusOf = (task: Task) => eventsById.get(task.eventId)?.status

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase()
    return tasks.filter((task) => {
      if (teamId && task.assignedTeamId !== teamId) return false
      if (eventId && task.eventId !== eventId) return false
      if (query) {
        const eventName = eventsById.get(task.eventId)?.name ?? ''
        if (!`${eventName} ${task.title}`.toLowerCase().includes(query)) return false
      }
      return true
    })
  }, [tasks, teamId, eventId, search, eventsById])

  const flash = (id: string, kind: TaskCardHighlight) => {
    setHighlights((current) => ({ ...current, [id]: kind }))
    timers.current.push(setTimeout(() => setHighlights((current) => {
      const next = { ...current }
      delete next[id]
      return next
    }), HIGHLIGHT_MS))
  }
  const setSaving = (id: string, saving: boolean) => setSavingIds((current) => {
    const next = new Set(current)
    if (saving) next.add(id); else next.delete(id)
    return next
  })
  const replaceTask = (updated: Task) => setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)))

  /** Atualização otimista (KAN-77): o card muda de coluna na hora; se a API recusar, ele volta e o motivo aparece. */
  const commitMove = async (task: Task, status: TaskStatus) => {
    pendingMoves.current.add(task.id)
    setSaving(task.id, true)
    replaceTask({ ...task, status })
    try {
      replaceTask(await updateTaskStatus(task.id, status))
      flash(task.id, 'moved')
      toast.success(`Tarefa movida para ${TASK_STATUS_LABELS[status]}.`)
    } catch (cause) {
      replaceTask(task)
      flash(task.id, 'rejected')
      const reason = getApiErrorMessage(cause, 'Falha ao mover tarefa').replace(/\.$/, '')
      toast.error(`${reason}. A tarefa voltou para ${TASK_STATUS_LABELS[task.status]}.`)
    } finally {
      pendingMoves.current.delete(task.id)
      setSaving(task.id, false)
    }
  }

  /** Mesmo caminho para o arraste e para os botões do detalhe: a regra fica num lugar só (ADR 0014). */
  const requestMove = (task: Task, status: TaskStatus) => {
    const decision = decideTaskDrop(task, status, eventStatusOf(task))
    if (decision.kind === 'reject') {
      flash(task.id, 'rejected')
      toast.error(decision.reason)
    } else if (decision.kind === 'confirm') {
      setConfirm({ kind: 'cancel', task })
    } else if (decision.kind === 'move') {
      void commitMove(task, status)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )
  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id))
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    const task = findTask(String(active.id))
    if (task && over) requestMove(task, over.id as TaskStatus)
  }

  const draggedTask = activeId ? findTask(activeId) : undefined
  const dropStateOf = (status: TaskStatus): ColumnDropState => {
    if (!draggedTask) return 'idle'
    if (draggedTask.status === status) return 'origin'
    return getTaskDestinations(draggedTask.status, eventStatusOf(draggedTask)).includes(status) ? 'allowed' : 'blocked'
  }

  const eventLabelOf = (task: Task) => {
    const event = eventsById.get(task.eventId)
    return event ? `${event.name} · ${dayMonth(event.eventDate)}` : 'Evento não encontrado'
  }
  const teamNameOf = (task: Task) => (task.assignedTeamId ? teamsById.get(task.assignedTeamId)?.name : undefined)

  // Each column follows the execution order: earliest deadline first (RFC 3.1.1).
  const columns = TASK_STATUSES.map((status) => ({ status, items: sortTasksBySchedule(filteredTasks.filter((task) => task.status === status)) }))
  const overdueCount = tasks.filter((task) => isTaskOverdue(task)).length
  const noTeamCount = tasks.filter((task) => !task.assignedTeamId && !TERMINAL_TASK_STATUSES.includes(task.status)).length
  const summary = `${plural(tasks.length, 'tarefa', 'tarefas')} · ${plural(overdueCount, 'atrasada', 'atrasadas')} · ${noTeamCount} sem equipe`

  const detailTask = detailId ? findTask(detailId) : undefined
  const openForm = (taskToEdit?: Task) => { setEditingTask(taskToEdit); setFormOpen(true) }
  const closeForm = () => { setFormOpen(false); setEditingTask(undefined) }
  const saveTask = (saved: Task) => {
    setTasks((current) => (current.some((item) => item.id === saved.id) ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current]))
    setError('')
  }

  const confirmAction = async () => {
    if (!confirm) return
    const { kind, task } = confirm
    setConfirm(null)
    if (kind === 'cancel') { await commitMove(task, 'CANCELADA'); return }
    try {
      await removeTask(task.id)
      setDetailId(null)
      setTasks((current) => current.filter((item) => item.id !== task.id))
      toast.success('Tarefa excluída.')
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, 'Falha ao excluir tarefa'))
    }
  }

  return <main className="app-shell">
    <header>
      <div><span className="eyebrow">MOTOR DE REGRAS</span><h1>Tarefas</h1></div>
      <div className="header-actions">
        <span className="task-board-summary">{summary}</span>
        <RefreshIndicator lastUpdatedAt={lastUpdatedAt} refreshing={refreshing} onRefresh={() => void refresh()} />
        {canCreate && <button type="button" className="secondary" onClick={() => openForm()}><Icon name="plus" />Nova tarefa</button>}
      </div>
    </header>
    <section className="content-head task-board-toolbar" aria-label="Busca e filtros">
      <label className="search task-board-search">
        <Icon name="search" />
        <span className="sr-only">Buscar por evento ou tarefa</span>
        <input placeholder="Buscar por evento ou tarefa..." value={search} onChange={(changeEvent) => setSearch(changeEvent.target.value)} />
      </label>
      <TaskFilterMenu
        teams={canListTeams ? teams : null}
        events={events}
        teamId={teamId}
        eventId={eventId}
        onTeamChange={setTeamId}
        onEventChange={setEventId}
        onClear={() => { setTeamId(''); setEventId('') }}
      />
    </section>
    {error && <Notice message={error} error />}
    <p id="task-board-help" className="sr-only">Arraste os cards entre as colunas ou abra a tarefa para mudar o status pelo botão Mover para.</p>
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)} accessibility={{ announcements, screenReaderInstructions: { draggable: 'Abra a tarefa e use Mover para, ou arraste o card com o mouse ou o dedo.' } }}>
      <div className="task-board" aria-describedby="task-board-help">
        {columns.map((column) => <TaskColumn key={column.status} status={column.status} count={column.items.length} dropState={dropStateOf(column.status)} blockedReason={draggedTask ? getMoveBlockReason(draggedTask, column.status, eventStatusOf(draggedTask)) : null}>
          {column.items.map((task) => <DraggableTaskCard
            key={task.id}
            task={task}
            eventLabel={eventLabelOf(task)}
            teamName={teamNameOf(task)}
            saving={savingIds.has(task.id)}
            highlight={highlights[task.id]}
            onOpen={() => setDetailId(task.id)}
          />)}
        </TaskColumn>)}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>
        {draggedTask && <TaskCardPreview task={draggedTask} eventLabel={eventLabelOf(draggedTask)} teamName={teamNameOf(draggedTask)} />}
      </DragOverlay>
    </DndContext>
    {detailTask && <TaskDetailDialog
      key={detailTask.id}
      task={detailTask}
      event={eventsById.get(detailTask.eventId)}
      teamName={teamNameOf(detailTask)}
      permissions={{ move: canMove, editDetails: canEdit, delete: canDelete, comment: canComment }}
      saving={savingIds.has(detailTask.id)}
      onClose={() => setDetailId(null)}
      onMove={(status) => requestMove(detailTask, status)}
      onTaskUpdated={replaceTask}
      onEdit={() => { setDetailId(null); openForm(detailTask) }}
      onDelete={() => setConfirm({ kind: 'delete', task: detailTask })}
    />}
    {confirm && <ConfirmDialog
      title={confirm.kind === 'delete' ? 'Excluir a tarefa?' : 'Cancelar a tarefa?'}
      message={confirm.kind === 'delete'
        ? `"${confirm.task.title}" sai do quadro.${confirm.task.sourceRuleId ? ' Ela foi gerada por uma regra e não será recriada.' : ''}`
        : `"${confirm.task.title}" será cancelada. Essa ação não pode ser desfeita.`}
      confirmLabel={confirm.kind === 'delete' ? 'Excluir' : 'Cancelar tarefa'}
      onConfirm={() => void confirmAction()}
      onCancel={() => setConfirm(null)}
    />}
    {formOpen && <TaskForm task={editingTask} events={events} teams={teams} onClose={closeForm} onSaved={saveTask} />}
  </main>
}
