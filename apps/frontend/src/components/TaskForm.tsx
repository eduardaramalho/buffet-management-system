import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../api/apiError'
import { createTask, updateTask } from '../api/tasksApi'
import { listTeamsByEvent } from '../api/teamsApi'
import { useToast } from '../contexts/toast'
import { useFormValidation } from '../hooks/useFormValidation'
import { TASK_STATUS_LABELS } from '../utils/labels'
import { taskFormSchema } from '../validation/taskSchema'
import { Icon } from './Icon'
import { FormModal } from './form/FormModal'
import { SelectField, TextAreaField, TextField } from './form/TextField'
import { TASK_TITLE_MAX_LENGTH } from '../types/task'
import type { Task, UpdateTaskInput } from '../types/task'
import type { Event } from '../types/event'
import type { Team } from '../types/team'

type TaskFormProps = {
  task?: Task
  events: Event[]
  teams: Team[]
  defaultEventId?: string
  onClose: () => void
  onSaved: (task: Task) => void
}

const TERMINAL_EVENT_STATUSES: Event['status'][] = ['CONCLUIDO', 'CANCELADO']

// <input type="date"> trabalha com "yyyy-mm-dd" no fuso local; o prazo vai à API como instante ISO ao meio-dia local,
// o que evita que o dia mude por conversão de fuso.
const toDateInput = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const fromDateInput = (value: string) => new Date(`${value}T12:00:00`).toISOString()

export function TaskForm({ task, events, teams, defaultEventId, onClose, onSaved }: TaskFormProps) {
  const toast = useToast()
  const [eventId, setEventId] = useState(task?.eventId ?? defaultEventId ?? '')
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [dueDate, setDueDate] = useState(toDateInput(task?.dueDate))
  const [assignedTeamId, setAssignedTeamId] = useState(task?.assignedTeamId ?? '')
  // Guarda também o evento a que as equipes pertencem: trocar de evento invalida o resultado anterior sem setState no efeito.
  const [allocations, setAllocations] = useState<{ eventId: string; teamIds: string[] }>()
  const [apiError, setApiError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isGenerated = Boolean(task?.sourceRuleId)
  const validation = useFormValidation(taskFormSchema(isGenerated), { eventId, title, description, dueDate, assignedTeamId })
  const selectableEvents = task ? events.filter((event) => event.id === task.eventId) : events.filter((event) => !TERMINAL_EVENT_STATUSES.includes(event.status))
  const taskEvent = events.find((event) => event.id === task?.eventId)
  const allocatedTeamIds = allocations?.eventId === eventId ? allocations.teamIds : null

  useEffect(() => {
    if (!eventId) return
    let cancelled = false
    listTeamsByEvent(eventId)
      .then((result) => { if (!cancelled) setAllocations({ eventId, teamIds: result.map((allocation) => allocation.teamId) }) })
      .catch((cause) => { if (!cancelled) { setAllocations({ eventId, teamIds: [] }); setApiError(getApiErrorMessage(cause, 'Não foi possível carregar as equipes do evento')) } })
    return () => { cancelled = true }
  }, [eventId])

  // Só equipes ATIVAS e já alocadas ao evento podem receber a tarefa (mesma regra validada pelo backend).
  const assignableTeams = teams.filter((team) => (team.status === 'ATIVA' && allocatedTeamIds?.includes(team.id)) || team.id === task?.assignedTeamId)
  const noAllocatedTeams = Boolean(eventId) && allocatedTeamIds !== null && !assignableTeams.some((team) => team.id !== task?.assignedTeamId)

  const changeEvent = (value: string) => { setEventId(value); setAssignedTeamId('') }

  const buildChanges = (current: Task): UpdateTaskInput => {
    const changes: UpdateTaskInput = {}
    if (!isGenerated && title.trim() !== current.title) changes.title = title.trim()
    if ((description.trim() || null) !== (current.description ?? null)) changes.description = description.trim() || null
    if (dueDate !== toDateInput(current.dueDate)) changes.dueDate = dueDate ? fromDateInput(dueDate) : null
    if ((assignedTeamId || null) !== (current.assignedTeamId ?? null)) changes.assignedTeamId = assignedTeamId || null
    return changes
  }

  const save = async (): Promise<Task | null> => {
    if (task) {
      const changes = buildChanges(task)
      return Object.keys(changes).length === 0 ? null : updateTask(task.id, changes)
    }
    return createTask({
      eventId,
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate ? fromDateInput(dueDate) : undefined,
      assignedTeamId: assignedTeamId || undefined,
    })
  }

  const submit = async () => {
    setApiError('')
    if (!validation.submit()) return
    setSubmitting(true)
    try {
      const saved = await save()
      if (saved) {
        toast.success(task ? 'Tarefa atualizada.' : 'Tarefa criada.')
        onSaved(saved)
      }
      onClose()
    } catch (cause) { setApiError(getApiErrorMessage(cause, 'Não foi possível salvar a tarefa')) } finally { setSubmitting(false) }
  }

  const subtitle = task && taskEvent
    ? <>{taskEvent.name} · {new Date(taskEvent.eventDate).toLocaleDateString('pt-BR')} · <span className="fm-tag">{TASK_STATUS_LABELS[task.status]}</span></>
    : 'Atividade a ser feita para um evento.'

  return <FormModal title={task ? 'Editar tarefa' : 'Nova tarefa'} subtitle={subtitle} icon={<Icon name="tasks" />}
    onClose={onClose} onSubmit={submit} submitting={submitting} submitLabel={task ? 'Salvar alterações' : 'Salvar tarefa'} error={apiError} invalidAttempt={validation.invalidAttempt}>
    {isGenerated && <p className="fm-callout"><Icon name="lock" />Tarefa gerada por regra: o evento e o título não podem ser alterados.</p>}
    <div className="fm-row">
      <SelectField label="Evento" required value={eventId} disabled={Boolean(task)} error={validation.errorFor('eventId')}
        onChange={(event) => changeEvent(event.target.value)} onBlur={(event) => validation.touch('eventId', event.target)}>
        <option value="">Selecione</option>
        {selectableEvents.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
      </SelectField>
      <TextField label="Título" required value={title} maxLength={TASK_TITLE_MAX_LENGTH} disabled={isGenerated} error={validation.errorFor('title')}
        onChange={(event) => setTitle(event.target.value)} onBlur={(event) => validation.touch('title', event.target)} />
    </div>
    <TextAreaField label="Descrição" optional value={description} placeholder="Detalhes para a equipe" onChange={(event) => setDescription(event.target.value)} />
    <div className="fm-row">
      <TextField label="Prazo" optional type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
      <SelectField label="Equipe" optional value={assignedTeamId} disabled={!eventId || allocatedTeamIds === null}
        hint={noAllocatedTeams ? 'Nenhuma equipe ativa alocada a este evento.' : 'Só equipes ativas alocadas a este evento.'}
        onChange={(event) => setAssignedTeamId(event.target.value)}>
        <option value="">Sem equipe</option>
        {assignableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
      </SelectField>
    </div>
  </FormModal>
}
