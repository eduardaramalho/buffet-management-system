import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getApiErrorMessage } from '../api/apiError'
import { getEvent, getEventHistory, updateEvent, type EventHistory } from '../api/eventsApi'
import { listTasks } from '../api/tasksApi'
import { applyEventRules, getEventRuleMatches, listEventRuleApplications, type RuleApplication } from '../api/rulesApi'
import { listTeams, listTeamsByEvent } from '../api/teamsApi'
import { useAuth } from '../contexts/useAuth'
import { Badge } from '../components/Badge'
import { Icon } from '../components/Icon'
import { Notice } from '../components/Notice'
import type { Event, EventStatus } from '../types/event'
import type { Task } from '../types/task'
import type { Team } from '../types/team'

const STATUS_STEPS: Array<{ status: Exclude<EventStatus, 'CANCELADO'>; label: string }> = [
  { status: 'PLANEJAMENTO', label: 'Planejamento' },
  { status: 'CONFIRMADO', label: 'Confirmado' },
  { status: 'EM_ANDAMENTO', label: 'Em andamento' },
  { status: 'CONCLUIDO', label: 'Concluído' },
]
const NEXT_STATUS: Partial<Record<EventStatus, { status: Exclude<EventStatus, 'PLANEJAMENTO' | 'CANCELADO'>; label: string }>> = {
  PLANEJAMENTO: { status: 'CONFIRMADO', label: 'Confirmar' },
  CONFIRMADO: { status: 'EM_ANDAMENTO', label: 'Iniciar evento' },
  EM_ANDAMENTO: { status: 'CONCLUIDO', label: 'Concluir' },
}
const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
const formatShortDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))

type BlockState<T> = { status: 'loading' | 'ready' | 'hidden' | 'error'; data?: T; message?: string }
const loading = <T,>(): BlockState<T> => ({ status: 'loading' })
const isForbidden = (cause: unknown) => (cause as { response?: { status?: number } })?.response?.status === 403

function BlockError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="block-error"><Notice message={message} error /><button type="button" className="link-button" onClick={retry}>Tentar de novo</button></div>
}

export function EventDetailsPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const hasPermission = (permission: string) => Boolean(user?.roles?.some((role) => role.permissions.includes(permission)))
  const [eventState, setEventState] = useState<BlockState<Event>>(loading())
  const [teamsState, setTeamsState] = useState<BlockState<Array<{ team: Team; assignedAt: string }>>>(loading())
  const [tasksState, setTasksState] = useState<BlockState<Task[]>>(loading())
  const [rulesState, setRulesState] = useState<BlockState<RuleApplication[] | Awaited<ReturnType<typeof getEventRuleMatches>>>>(loading())
  const [historyState, setHistoryState] = useState<BlockState<EventHistory[]>>(loading())
  const [menuOpen, setMenuOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [actionError, setActionError] = useState('')
  const [rulesAction, setRulesAction] = useState(false)
  const [rulesResult, setRulesResult] = useState('')

  const loadEvent = async () => {
    setEventState(loading())
    try { setEventState({ status: 'ready', data: await getEvent(id) }) }
    catch (cause) { setEventState(isForbidden(cause) ? { status: 'hidden' } : { status: 'error', message: getApiErrorMessage(cause, 'Não foi possível carregar o evento') }) }
  }
  const loadTeams = async () => {
    setTeamsState(loading())
    try {
      const [assignments, teams] = await Promise.all([listTeamsByEvent(id), listTeams()])
      const teamsById = new Map(teams.map((team) => [team.id, team]))
      setTeamsState({ status: 'ready', data: assignments.flatMap((assignment) => { const team = teamsById.get(assignment.teamId); return team ? [{ team, assignedAt: assignment.assignedAt }] : [] }) })
    } catch (cause) { setTeamsState(isForbidden(cause) ? { status: 'hidden' } : { status: 'error', message: getApiErrorMessage(cause, 'Não foi possível carregar equipes') }) }
  }
  const loadTasks = async () => {
    setTasksState(loading())
    try { setTasksState({ status: 'ready', data: await listTasks({ eventId: id }) }) }
    catch (cause) { setTasksState(isForbidden(cause) ? { status: 'hidden' } : { status: 'error', message: getApiErrorMessage(cause, 'Não foi possível carregar tarefas') }) }
  }
  const loadRules = async () => {
    setRulesState(loading())
    try {
      const event = eventState.data
      const data = event?.status === 'PLANEJAMENTO' ? await getEventRuleMatches(id) : await listEventRuleApplications(id)
      setRulesState({ status: 'ready', data })
    } catch (cause) { setRulesState(isForbidden(cause) ? { status: 'hidden' } : { status: 'error', message: getApiErrorMessage(cause, 'Não foi possível carregar regras') }) }
  }
  const loadHistory = async () => {
    setHistoryState(loading())
    try { setHistoryState({ status: 'ready', data: await getEventHistory(id) }) }
    catch (cause) { setHistoryState(isForbidden(cause) ? { status: 'hidden' } : { status: 'error', message: getApiErrorMessage(cause, 'Não foi possível carregar histórico') }) }
  }
  const loadAll = async () => {
    await loadEvent()
    await Promise.allSettled([loadTeams(), loadTasks(), loadRules(), loadHistory()])
  }

  useEffect(() => { void loadAll() }, [id])

  const event = eventState.data
  const next = event ? NEXT_STATUS[event.status] : undefined
  const tasks = tasksState.data ?? []
  const openUnassigned = tasks.filter((task) => !task.assignedTeamId && ['PENDENTE', 'EM_ANDAMENTO'].includes(task.status))
  const progressTasks = tasks.filter((task) => task.status !== 'CANCELADA')
  const completedTasks = progressTasks.filter((task) => task.status === 'CONCLUIDA').length

  const changeStatus = async (status: EventStatus, reason?: string) => {
    if (!event) return
    setActionError('')
    try {
      const updated = await updateEvent(event.id, { status, ...(reason ? { reason } : {}) })
      setEventState({ status: 'ready', data: updated })
      setCancelOpen(false); setMenuOpen(false); setCancelReason('')
      if (status === 'CONFIRMADO') await Promise.allSettled([loadTasks(), loadTeams(), loadRules()])
    } catch (cause) { setActionError(getApiErrorMessage(cause, 'Não foi possível atualizar o evento')) }
  }

  const cancel = () => {
    if (!cancelReason.trim() && event && ['CONFIRMADO', 'EM_ANDAMENTO'].includes(event.status)) {
      setActionError('Informe o motivo do cancelamento.')
      return
    }
    void changeStatus('CANCELADO', cancelReason.trim() || undefined)
  }

  const reapplyRules = async () => {
    setRulesAction(true); setActionError(''); setRulesResult('')
    try {
      const result = await applyEventRules(id)
      setRulesResult(`${result.tasksCreated} tarefa${result.tasksCreated === 1 ? '' : 's'} criadas, ${result.tasksSkipped} ignorada${result.tasksSkipped === 1 ? '' : 's'}`)
      await Promise.allSettled([loadTasks(), loadTeams(), loadRules()])
    } catch (cause) { setActionError(getApiErrorMessage(cause, 'Não foi possível reaplicar as regras')) }
    finally { setRulesAction(false) }
  }

  if (eventState.status === 'loading') return <main className="app-shell"><p className="muted">Carregando evento...</p></main>
  if (eventState.status === 'hidden') return <main className="app-shell"><Notice message="Você não tem acesso a este evento." error /></main>
  if (eventState.status === 'error') return <main className="app-shell"><BlockError message={eventState.message ?? 'Não foi possível carregar o evento'} retry={() => void loadEvent()} /></main>
  if (!event) return null

  return <main className="app-shell event-details-page">
    <header className="event-details-header"><div><button type="button" className="link-button back-link" onClick={() => navigate('/events')}><Icon name="chevron-left" />Eventos</button><span className="eyebrow">CENTRAL DO EVENTO</span><h1>{event.name}</h1><p className="event-meta">{formatDate(event.eventDate)} · {event.location} · {event.guestsCount} convidados</p></div><div className="event-header-actions">{hasPermission('events:update') && next && <button type="button" className="secondary" onClick={() => void changeStatus(next.status)}>{next.label}</button>}<div className="more-actions"><button type="button" className="secondary outline" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>Mais ações <Icon name="chevron-down" /></button>{menuOpen && <div className="action-menu"><button type="button" onClick={() => setCancelOpen(true)}>Cancelar evento</button></div>}</div></div></header>
    <div className="event-status-steps" aria-label="Etapas do evento">{STATUS_STEPS.map((step, index) => <div key={step.status} className={`event-step ${step.status === event.status ? 'current' : ''} ${STATUS_STEPS.findIndex((item) => item.status === event.status) > index ? 'complete' : ''}`}><span>{index + 1}</span>{step.label}</div>)}</div>
    {actionError && <Notice message={actionError} error />}
    {cancelOpen && <section className="cancel-panel"><h2>Cancelar evento</h2><label>Motivo do cancelamento<textarea aria-label="Motivo do cancelamento" value={cancelReason} onChange={(changeEvent) => setCancelReason(changeEvent.target.value)} /></label><div className="form-actions"><button type="button" className="link-button" onClick={() => setCancelOpen(false)}>Voltar</button><button type="button" className="danger-button" onClick={cancel}>Confirmar cancelamento</button></div></section>}
    {openUnassigned.length > 0 && <section className="event-alert" role="alert"><Icon name="alert" /><div><strong>Há tarefas sem equipe alocada</strong><span>{openUnassigned.length} tarefa{openUnassigned.length === 1 ? '' : 's'} precisam de atenção.</span></div><button type="button" onClick={() => document.getElementById('event-teams')?.scrollIntoView({ behavior: 'smooth' })}>Alocar equipe</button></section>}
    <div className="event-details-grid">
      <div className="event-details-main">
        {teamsState.status !== 'hidden' && <section className="event-panel" id="event-teams"><div className="panel-heading"><h2>Equipes designadas</h2><Link className="panel-link" to="/teams">Alocar equipe</Link></div>{teamsState.status === 'error' && <BlockError message={teamsState.message ?? 'Não foi possível carregar equipes'} retry={() => void loadTeams()} />}{teamsState.status === 'ready' && (teamsState.data?.length ? <div className="team-list">{teamsState.data.map(({ team, assignedAt }) => <div className="team-row" key={team.id}><span className="team-avatar"><Icon name="users" /></span><div><strong>{team.name}</strong><small>{team.specialty} · atribuída em {formatShortDate(assignedAt)}</small></div><Badge tone={team.status === 'ATIVA' ? 'active' : 'inactive'}>{team.status === 'ATIVA' ? 'Ativa' : 'Inativa'}</Badge></div>)}</div> : <p className="empty-state">Nenhuma equipe designada.</p>)}</section>}
        {tasksState.status !== 'hidden' && <section className="event-panel"><div className="panel-heading"><h2>Tarefas do evento</h2><Link className="panel-link" to="/tasks">Ver no quadro</Link></div>{tasksState.status === 'error' && <BlockError message={tasksState.message ?? 'Não foi possível carregar tarefas'} retry={() => void loadTasks()} />}{tasksState.status === 'ready' && <><div className="progress-summary"><strong>{completedTasks} de {progressTasks.length}</strong><span>tarefas concluídas</span><div className="progress-track"><span style={{ width: `${progressTasks.length ? completedTasks / progressTasks.length * 100 : 0}%` }} /></div></div><div className="task-list">{tasks.map((task) => <div className="event-task-row" key={task.id}><span className={`task-status-dot ${task.status.toLowerCase()}`}><Icon name={task.status === 'CONCLUIDA' ? 'check' : 'tasks'} /></span><div><strong>{task.title}</strong><small>{task.dueDate ? `Prazo ${formatShortDate(task.dueDate)}` : 'Sem prazo'}</small></div><Badge tone={task.status === 'CONCLUIDA' ? 'active' : task.status === 'CANCELADA' ? 'inactive' : 'viewer'}>{task.status === 'CONCLUIDA' ? 'Concluída' : task.status === 'EM_ANDAMENTO' ? 'Em andamento' : task.status === 'CANCELADA' ? 'Cancelada' : 'Pendente'}</Badge></div>)}</div></>}</section>}
      </div>
      <div className="event-details-side">
        {rulesState.status !== 'hidden' && <section className="event-panel"><div className="panel-heading"><h2>{event.status === 'PLANEJAMENTO' ? 'Motor de regras' : 'Regras aplicadas'}</h2>{event.status !== 'PLANEJAMENTO' && hasPermission('rules:apply') && <button type="button" className="panel-link button-link" onClick={() => void reapplyRules()} disabled={rulesAction}><Icon name="bolt" />{rulesAction ? 'Reaplicando...' : 'Reaplicar'}</button>}</div>{rulesResult && <p className="alert">{rulesResult}</p>}{rulesState.status === 'error' && <BlockError message={rulesState.message ?? 'Não foi possível carregar regras'} retry={() => void loadRules()} />}{rulesState.status === 'ready' && event.status === 'PLANEJAMENTO' && <RuleMatches data={rulesState.data as Awaited<ReturnType<typeof getEventRuleMatches>>} />}{rulesState.status === 'ready' && event.status !== 'PLANEJAMENTO' && <AppliedRules data={rulesState.data as RuleApplication[]} />}</section>}
        {historyState.status !== 'hidden' && <section className="event-panel"><div className="panel-heading"><h2>Histórico</h2></div>{historyState.status === 'error' && <BlockError message={historyState.message ?? 'Não foi possível carregar histórico'} retry={() => void loadHistory()} />}{historyState.status === 'ready' && (historyState.data?.length ? <ul className="event-history-list">{historyState.data.map((item) => <li key={item.id}><span /><div><strong>{item.message}</strong><small>{item.actorName ?? 'Sistema'} · {formatDate(item.createdAt)}</small></div></li>)}</ul> : <p className="empty-state">Nenhum registro no histórico.</p>)}</section>}
      </div>
    </div>
  </main>
}

function RuleMatches({ data }: { data: Awaited<ReturnType<typeof getEventRuleMatches>> }) {
  return <><p className="muted">Consulta somente leitura das regras que combinam com este evento.</p>{data.length ? <ul className="rule-match-list">{data.map((match) => <li key={match.rule.id}><strong>{match.rule.name}</strong><span>{match.resourceRequirements.map((item) => `${item.specialty} ×${item.minQuantity}`).join(', ') || 'Sem recursos exigidos'}</span></li>)}</ul> : <p className="empty-state">Nenhuma regra corresponde ao evento.</p>}</>}

function AppliedRules({ data }: { data: RuleApplication[] }) {
  return data.length ? <ul className="applied-rule-list">{data.map((rule) => <li key={rule.ruleId}><Icon name="check" /><div><strong>{rule.ruleName}</strong><small>Aplicada em {formatDate(rule.appliedAt)}</small></div></li>)}</ul> : <p className="empty-state">Nenhuma regra aplicada.</p>
}