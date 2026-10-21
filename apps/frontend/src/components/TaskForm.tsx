import { useEffect, useState, type FormEvent } from 'react'
import { getApiErrorMessage } from '../api/apiError'
import { createTask, updateTask } from '../api/tasksApi'
import { listTeamsByEvent } from '../api/teamsApi'
import { Button } from './Button'
import { Notice } from './Notice'
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
const GENERATED_TITLE_HINT = 'Título gerado por regra não pode ser alterado'

// <input type="date"> trabalha com "yyyy-mm-dd" no fuso local; o prazo vai à API como instante ISO ao meio-dia local,
// o que evita que o dia mude por conversão de fuso.
const toDateInput = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const fromDateInput = (value: string) => new Date(`${value}T12:00:00`).toISOString()

export function TaskForm({ task, events, teams, defaultEventId, onClose, onSaved }: TaskFormProps) {
  const [eventId, setEventId] = useState(task?.eventId ?? defaultEventId ?? '')
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [dueDate, setDueDate] = useState(toDateInput(task?.dueDate))
  const [assignedTeamId, setAssignedTeamId] = useState(task?.assignedTeamId ?? '')
  // Guarda também o evento a que as equipes pertencem: trocar de evento invalida o resultado anterior sem setState no efeito.
  const [allocations, setAllocations] = useState<{ eventId: string; teamIds: string[] }>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectableEvents = task ? events.filter((event) => event.id === task.eventId) : events.filter((event) => !TERMINAL_EVENT_STATUSES.includes(event.status))
  const isGenerated = Boolean(task?.sourceRuleId)

  const allocatedTeamIds = allocations?.eventId === eventId ? allocations.teamIds : null

  useEffect(() => {
    if (!eventId) return
    let cancelled = false
    listTeamsByEvent(eventId)
      .then((result) => { if (!cancelled) setAllocations({ eventId, teamIds: result.map((allocation) => allocation.teamId) }) })
      .catch((cause) => { if (!cancelled) { setAllocations({ eventId, teamIds: [] }); setError(getApiErrorMessage(cause, 'Não foi possível carregar as equipes do evento')) } })
    return () => { cancelled = true }
  }, [eventId])

  // Só equipes ATIVAS e já alocadas ao evento podem receber a tarefa (mesma regra validada pelo backend).
  const assignableTeams = teams.filter((team) => (team.status === 'ATIVA' && allocatedTeamIds?.includes(team.id)) || team.id === task?.assignedTeamId)
  const noAllocatedTeams = Boolean(eventId) && allocatedTeamIds !== null && !assignableTeams.some((team) => team.id !== task?.assignedTeamId)

  const changeEvent = (value: string) => { setEventId(value); setAssignedTeamId('') }

  const validate = () => {
    if (!task && !eventId) return 'Selecione o evento.'
    if (!isGenerated) {
      if (!title.trim()) return 'Informe o título da tarefa.'
      if (title.trim().length > TASK_TITLE_MAX_LENGTH) return `O título deve ter no máximo ${TASK_TITLE_MAX_LENGTH} caracteres.`
    }
    return ''
  }

  const buildChanges = (current: Task): UpdateTaskInput => {
    const changes: UpdateTaskInput = {}
    if (!isGenerated && title.trim() !== current.title) changes.title = title.trim()
    if ((description.trim() || null) !== (current.description ?? null)) changes.description = description.trim() || null
    if (dueDate !== toDateInput(current.dueDate)) changes.dueDate = dueDate ? fromDateInput(dueDate) : null
    if ((assignedTeamId || null) !== (current.assignedTeamId ?? null)) changes.assignedTeamId = assignedTeamId || null
    return changes
  }

  const submit = async (formEvent: FormEvent) => {
    formEvent.preventDefault(); setError('')
    const validationError = validate()
    if (validationError) return setError(validationError)
    setLoading(true)
    try {
      if (task) {
        const changes = buildChanges(task)
        if (Object.keys(changes).length === 0) return onClose()
        onSaved(await updateTask(task.id, changes))
      } else {
        onSaved(await createTask({
          eventId,
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate ? fromDateInput(dueDate) : undefined,
          assignedTeamId: assignedTeamId || undefined,
        }))
      }
      onClose()
    } catch (cause) { setError(getApiErrorMessage(cause, 'Não foi possível salvar a tarefa')) } finally { setLoading(false) }
  }

  return <aside className="user-form-panel" role="dialog" aria-modal="true" aria-labelledby="task-form-title"><div className="form-wrap">
    <button type="button" className="link-button" onClick={onClose}>Voltar</button>
    <h2 id="task-form-title">{task ? 'Editar tarefa' : 'Nova tarefa'}</h2>
    <form onSubmit={submit}>
      <label>Evento<select aria-label="Evento" value={eventId} disabled={Boolean(task)} onChange={(event) => changeEvent(event.target.value)}>
        <option value="">Selecione</option>
        {selectableEvents.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
      </select></label>
      <label>Título<input aria-label="Título" value={title} maxLength={TASK_TITLE_MAX_LENGTH + 1} disabled={isGenerated} onChange={(event) => setTitle(event.target.value)} /></label>
      {isGenerated && <p className="field-hint">{GENERATED_TITLE_HINT}</p>}
      <label>Descrição<textarea aria-label="Descrição" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <label>Prazo<input aria-label="Prazo" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
      <label>Equipe<select aria-label="Equipe" value={assignedTeamId} disabled={!eventId || allocatedTeamIds === null} onChange={(event) => setAssignedTeamId(event.target.value)}>
        <option value="">Sem equipe</option>
        {assignableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
      </select></label>
      {noAllocatedTeams && <p className="field-hint">Nenhuma equipe ativa alocada a este evento.</p>}
      {error && <Notice message={error} error />}
      <div className="form-actions">
        <Button type="button" className="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" className="primary" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
      </div>
    </form>
  </div></aside>
}
