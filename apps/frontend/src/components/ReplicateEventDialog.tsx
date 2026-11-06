import { useEffect, useState, type SubmitEvent } from 'react'
import axios from 'axios'
import { getApiErrorMessage } from '../api/apiError'
import { getReplicationPreview, replicateEvent } from '../api/eventsApi'
import { listServices } from '../api/servicesApi'
import { listClients } from '../api/clientsApi'
import { Badge } from './Badge'
import { Button } from './Button'
import { Icon } from './Icon'
import { Notice } from './Notice'
import { EVENT_TYPES, type Event, type EventType, type Service } from '../types/event'
import type { Client } from '../types/client'
import type { ReplicatedTaskInput, ReplicationPreview, ReplicationPreviewTeam, ReplicationWarning } from '../types/replication'
import { EVENT_TYPE_LABELS, TEAM_SPECIALTY_LABELS } from '../utils/labels'
import { fromDateInput, toDateInput } from '../utils/dateInput'

type ReplicateEventDialogProps = { source: Event; onClose: () => void; onReplicated: (replica: Event) => void }
type TaskDraft = { selected: boolean; title: string; dueDate: string }

const warningMessage = (warning: ReplicationWarning) => warning.code === 'CLIENT_UNAVAILABLE'
  ? 'O cliente do evento de origem não está mais disponível.'
  : `O serviço ${warning.name} não está mais disponível e não será copiado.`

const unavailableReason = (team: ReplicationPreviewTeam) => {
  if (team.reason === 'SCHEDULE_CONFLICT') return `Conflito com ${team.conflictingEvent?.name ?? 'outro evento'}`
  return team.reason === 'INACTIVE' ? 'Equipe inativa' : 'Equipe removida'
}

// Used only after the user edits a deadline; until then the API flag (dueDateInPast) is the reference.
const isPast = (value: string) => Boolean(value) && new Date(value).getTime() < Date.now()

/**
 * RF25 (ADR 0008): two steps. 1) the new event data, prefilled from the source and fully editable
 * (name and date always typed again); 2) an attention step to review the copied manual tasks and teams.
 * Deadlines and team availability come from the API preview, so no business rule is duplicated here.
 */
export function ReplicateEventDialog({ source, onClose, onReplicated }: ReplicateEventDialogProps) {
  const [step, setStep] = useState<'data' | 'review'>('data')
  const [name, setName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [location, setLocation] = useState(source.location)
  const [serviceType, setServiceType] = useState<EventType>(source.serviceType)
  const [guestsCount, setGuestsCount] = useState(String(source.guestsCount))
  const [observations, setObservations] = useState(source.observations ?? '')
  const [clientId, setClientId] = useState(source.client && !source.client.deletedAt ? source.client.id : '')
  const [clients, setClients] = useState<Client[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [selectedServices, setSelectedServices] = useState<Record<string, string>>(() => Object.fromEntries(source.services.map((item) => [item.serviceId, item.customLabel ?? ''])))
  const [preview, setPreview] = useState<ReplicationPreview | null>(null)
  const [taskDrafts, setTaskDrafts] = useState<Record<string, TaskDraft>>({})
  const [selectedTeams, setSelectedTeams] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { void listServices().then(setServices).catch((cause) => setError(getApiErrorMessage(cause, 'Não foi possível carregar os serviços'))) }, [])
  useEffect(() => { void listClients().then(setClients).catch((cause) => setError(getApiErrorMessage(cause, 'Não foi possível carregar os clientes'))) }, [])

  // Only services still in the catalog are offered; removed ones are reported by the preview warnings.
  const activeSelectedServices = services.filter((service) => selectedServices[service.id] !== undefined)
  const toggleService = (service: Service) => setSelectedServices((current) => {
    const next = { ...current }
    if (next[service.id] !== undefined) delete next[service.id]
    else next[service.id] = ''
    return next
  })

  const loadPreview = async () => (await getReplicationPreview(source.id, { eventDate: fromDateInput(eventDate) as string, endDate: null }))

  const validateEventData = (): string | null => {
    if (!name.trim()) return 'Informe o nome do novo evento.'
    if (!eventDate) return 'Informe a data do novo evento.'
    if (!location.trim()) return 'Informe o local do evento.'
    if (!guestsCount || Number(guestsCount) < 1) return 'Informe o número de convidados.'
    if (!clientId) return 'Selecione o cliente do evento.'
    if (activeSelectedServices.some((service) => service.isCustom && !selectedServices[service.id].trim())) return 'Especifique o serviço Outro.'
    return null
  }

  const goToReview = async (formEvent: SubmitEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    const invalid = validateEventData()
    setError(invalid ?? '')
    if (invalid) return
    setLoading(true)
    try {
      const data = await loadPreview()
      setPreview(data)
      setTaskDrafts(Object.fromEntries(data.tasks.map((task) => [task.sourceTaskId, { selected: task.selected, title: task.title, dueDate: toDateInput(task.dueDate) }])))
      setSelectedTeams(Object.fromEntries(data.teams.map((team) => [team.teamId, team.available])))
      setStep('review')
    } catch (cause) { setError(getApiErrorMessage(cause, 'Não foi possível preparar a revisão')) } finally { setLoading(false) }
  }

  const updateTask = (sourceTaskId: string, changes: Partial<TaskDraft>) => setTaskDrafts((current) => ({ ...current, [sourceTaskId]: { ...current[sourceTaskId], ...changes } }))

  // A 409 means a team became busy after the preview: refresh only the teams, keeping the task edits.
  const refreshTeams = async () => {
    const data = await loadPreview()
    setPreview((current) => (current ? { ...current, teams: data.teams } : data))
    setSelectedTeams((current) => Object.fromEntries(data.teams.map((team) => [team.teamId, team.available && (current[team.teamId] ?? true)])))
  }

  const create = async () => {
    if (!preview) return
    setError('')
    const chosenTasks = preview.tasks.filter((task) => taskDrafts[task.sourceTaskId]?.selected)
    if (chosenTasks.some((task) => !taskDrafts[task.sourceTaskId].title.trim())) {
      setError('Informe o título de todas as tarefas copiadas.')
      return
    }

    // Only what the user changed is sent: an omitted deadline is recalculated by the API from the source.
    const tasks: ReplicatedTaskInput[] = chosenTasks.map((task) => {
      const draft = taskDrafts[task.sourceTaskId]
      return {
        sourceTaskId: task.sourceTaskId,
        ...(draft.title.trim() !== task.title ? { title: draft.title.trim() } : {}),
        ...(draft.dueDate !== toDateInput(task.dueDate) ? { dueDate: fromDateInput(draft.dueDate) } : {}),
      }
    })
    setLoading(true)
    try {
      const replica = await replicateEvent(source.id, {
        name: name.trim(),
        eventDate: fromDateInput(eventDate) as string,
        endDate: null,
        location: location.trim(),
        serviceType,
        guestsCount: Number(guestsCount),
        observations: observations.trim() || null,
        clientId,
        services: activeSelectedServices.map((service) => ({ serviceId: service.id, customLabel: selectedServices[service.id].trim() || null })),
        tasks,
        teamIds: preview.teams.filter((team) => selectedTeams[team.teamId]).map((team) => team.teamId),
      })
      onReplicated(replica)
    } catch (cause) {
      if (axios.isAxiosError(cause) && cause.response?.status === 409) {
        setError(`${getApiErrorMessage(cause, 'Há equipes indisponíveis')}. A revisão foi atualizada: desmarque ou ajuste antes de criar.`)
        await refreshTeams().catch(() => undefined)
      } else {
        setError(getApiErrorMessage(cause, 'Não foi possível replicar o evento'))
      }
    } finally { setLoading(false) }
  }

  return <aside className="user-form-panel event-form-panel replicate-panel" role="dialog" aria-modal="true" aria-labelledby="replicate-event-title">
    <div className="form-wrap">
      <h2 id="replicate-event-title">Replicar evento</h2>
      <p className="muted">Base: {source.name} · Etapa {step === 'data' ? 1 : 2} de 2</p>

      {step === 'data' && <form onSubmit={(formEvent) => void goToReview(formEvent)}>
        <div className="event-form-grid">
          <section>
            <h3>Dados do novo evento</h3>
            <label>Cliente<select aria-label="Cliente" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Selecione o cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
            <label>Nome do evento<input aria-label="Nome do evento" placeholder="Ex.: Casamento de Bruna" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label>Data do evento<input aria-label="Data do evento" type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></label>
            <label>Local<input aria-label="Local" value={location} onChange={(e) => setLocation(e.target.value)} /></label>
            <label>Tipo de evento<select aria-label="Tipo de evento" value={serviceType} onChange={(e) => setServiceType(e.target.value as EventType)}>{EVENT_TYPES.map((type) => <option key={type} value={type}>{EVENT_TYPE_LABELS[type]}</option>)}</select></label>
            <label>Número de convidados<input aria-label="Número de convidados" type="number" min="1" value={guestsCount} onChange={(e) => setGuestsCount(e.target.value)} /></label>
            <label>Observações<textarea aria-label="Observações" value={observations} onChange={(e) => setObservations(e.target.value)} /></label>
          </section>
          <section>
            <h3>Serviços contratados</h3>
            <div className="service-checks">{services.map((service) => <label key={service.id}><span><input type="checkbox" aria-label={service.name} checked={selectedServices[service.id] !== undefined} onChange={() => toggleService(service)} /> {service.name}</span>{service.isCustom && selectedServices[service.id] !== undefined && <input aria-label="Especifique..." placeholder="Especifique..." value={selectedServices[service.id]} onChange={(e) => setSelectedServices((current) => ({ ...current, [service.id]: e.target.value }))} />}</label>)}</div>
          </section>
        </div>
        {error && <Notice message={error} error />}
        <div className="form-actions"><Button type="button" className="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" className="primary" disabled={loading}>{loading ? 'Preparando...' : 'Revisar itens copiados'}</Button></div>
      </form>}

      {step === 'review' && preview && <form className="replicate-review" onSubmit={(formEvent) => { formEvent.preventDefault(); void create() }}>
        <h3>Revise o que será copiado</h3>
        <section className="event-alert replicate-notice" role="note"><Icon name="alert" /><div><strong>Confira os itens copiados de '{preview.source.name}'</strong><span>Desmarque o que não se aplica ao novo evento e ajuste prazos e títulos. Tarefas geradas por regras não são copiadas: o motor de regras as cria de novo quando o evento for confirmado.</span></div></section>
        {preview.warnings.length > 0 && <ul className="replicate-warnings">{preview.warnings.map((warning) => <li key={warning.code === 'SERVICE_UNAVAILABLE' ? warning.serviceId : warning.code}>{warningMessage(warning)}</li>)}</ul>}

        <h4>Tarefas manuais</h4>
        {preview.tasks.length ? <ul className="replicate-list">{preview.tasks.map((task) => {
          const draft = taskDrafts[task.sourceTaskId]
          const losesTeam = draft.selected && task.assignedTeamId !== null && !selectedTeams[task.assignedTeamId]
          return <li key={task.sourceTaskId} className={draft.selected ? '' : 'unselected'}>
            <input type="checkbox" aria-label={`Copiar tarefa ${task.title}`} checked={draft.selected} onChange={(e) => updateTask(task.sourceTaskId, { selected: e.target.checked })} />
            <div className="replicate-item-fields">
              <input aria-label={`Título da tarefa ${task.title}`} value={draft.title} disabled={!draft.selected} onChange={(e) => updateTask(task.sourceTaskId, { title: e.target.value })} />
              <input aria-label={`Prazo da tarefa ${task.title}`} type="datetime-local" value={draft.dueDate} disabled={!draft.selected} onChange={(e) => updateTask(task.sourceTaskId, { dueDate: e.target.value })} />
              <div className="replicate-badges">
                {task.sourceStatus === 'CANCELADA' && <Badge tone="inactive">Cancelada na origem</Badge>}
                {(draft.dueDate === toDateInput(task.dueDate) ? task.dueDateInPast : isPast(draft.dueDate)) && <Badge tone="inactive">Prazo já passou</Badge>}
                {losesTeam && <Badge tone="neutral">Ficará sem equipe</Badge>}
                {!draft.dueDate && <small className="muted">Sem prazo</small>}
              </div>
            </div>
          </li>
        })}</ul> : <p className="empty-state">Nenhuma tarefa manual para copiar.</p>}

        <h4>Equipes</h4>
        {preview.teams.length ? <ul className="replicate-list">{preview.teams.map((team) => <li key={team.teamId} className={team.available ? '' : 'unavailable'}>
          <input type="checkbox" aria-label={`Copiar equipe ${team.name}`} checked={Boolean(selectedTeams[team.teamId])} disabled={!team.available} onChange={(e) => setSelectedTeams((current) => ({ ...current, [team.teamId]: e.target.checked }))} />
          <div><strong>{team.name}</strong><small>{TEAM_SPECIALTY_LABELS[team.specialty as keyof typeof TEAM_SPECIALTY_LABELS] ?? team.specialty}</small></div>
          {!team.available && <Badge tone="inactive">{unavailableReason(team)}</Badge>}
        </li>)}</ul> : <p className="empty-state">Nenhuma equipe alocada no evento de origem.</p>}

        {error && <Notice message={error} error />}
        <div className="form-actions"><Button type="button" className="ghost" onClick={() => { setError(''); setStep('data') }}>Voltar</Button><Button type="submit" className="primary" disabled={loading}>{loading ? 'Criando...' : 'Criar evento'}</Button></div>
      </form>}
    </div>
  </aside>
}
