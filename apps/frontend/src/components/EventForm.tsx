import { useEffect, useState, type FormEvent } from 'react'
import { getApiErrorMessage } from '../api/apiError'
import { assignTeamToEvent, listTeams, listTeamsByEvent, unassignTeamFromEvent } from '../api/teamsApi'
import { attachEventService, createEvent, detachEventService, updateEvent } from '../api/eventsApi'
import { listServices } from '../api/servicesApi'
import { listClients } from '../api/clientsApi'
import { Button } from './Button'
import { Notice } from './Notice'
import type { Event, EventType, Service } from '../types/event'
import type { Team } from '../types/team'
import type { Client } from '../types/client'

type EventFormProps = { event?: Event; onClose: () => void; onCreated: (event: Event) => void; onUpdated: (event: Event) => void }
const eventTypes: Array<[EventType, string]> = [['CASAMENTO', 'Casamento'], ['ANIVERSARIO', 'Aniversário'], ['FORMATURA', 'Formatura'], ['CORPORATIVO', 'Corporativo'], ['CONFRATERNIZACAO', 'Confraternização'], ['BATIZADO', 'Batizado'], ['OUTRO', 'Outro']]
const pad = (value: number) => String(value).padStart(2, '0')
// <input type="datetime-local"> trabalha no horário local; toISOString() devolveria UTC e deslocaria o evento.
const toDateInput = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
export function EventForm({ event, onClose, onCreated, onUpdated }: EventFormProps) {
  const [name, setName] = useState(event?.name ?? '')
  const [eventDate, setEventDate] = useState(toDateInput(event?.eventDate))
  const [location, setLocation] = useState(event?.location ?? '')
  const [serviceType, setServiceType] = useState<EventType | ''>(event?.serviceType ?? '')
  const [guestsCount, setGuestsCount] = useState(event?.guestsCount ? String(event.guestsCount) : '')
  const [observations, setObservations] = useState(event?.observations ?? '')
  const [clientId, setClientId] = useState(event?.clientId ?? '')
  const [clients, setClients] = useState<Client[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [selected, setSelected] = useState<Record<string, string>>(() => Object.fromEntries(event?.services.map((item) => [item.serviceId, item.customLabel ?? '']) ?? []))
  const [availableTeams, setAvailableTeams] = useState<Team[]>([])
  const [assignedTeams, setAssignedTeams] = useState<Team[]>([])
  const [teamToAssign, setTeamToAssign] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { void listServices().then(setServices).catch((cause) => setError(getApiErrorMessage(cause, 'Não foi possível salvar o evento'))) }, [])
  useEffect(() => { void listClients().then(setClients).catch((cause) => setError(getApiErrorMessage(cause, 'Não foi possível carregar os clientes'))) }, [])
  useEffect(() => {
    if (!event) return
    void Promise.all([listTeams(), listTeamsByEvent(event.id)]).then(([teams, assignments]) => {
      const assignedIds = new Set(assignments.map((assignment) => assignment.teamId))
      setAvailableTeams(teams.filter((team) => !assignedIds.has(team.id) && team.status === 'ATIVA'))
      setAssignedTeams(teams.filter((team) => assignedIds.has(team.id)))
    }).catch((cause) => setError(getApiErrorMessage(cause, 'Não foi possível salvar o evento')))
  }, [event])

  const otherService = services.find((service) => service.isCustom)
  // A soft-deleted client is not listed by the API; keep it selectable so editing an old event does not lose the link.
  const linkedInactiveClient = event?.client && !clients.some((client) => client.id === event.client?.id) ? event.client : null
  const toggleService = (service: Service) => setSelected((current) => { const next = { ...current }; if (next[service.id] !== undefined) delete next[service.id]; else next[service.id] = ''; return next })
  const assignTeam = async () => {
    if (!event || !teamToAssign) return
    try {
      await assignTeamToEvent(teamToAssign, event.id)
      const assigned = availableTeams.find((team) => team.id === teamToAssign)
      if (assigned) { setAssignedTeams((current) => [...current, assigned]); setAvailableTeams((current) => current.filter((team) => team.id !== teamToAssign)) }
      setTeamToAssign('')
    } catch (cause) { setError(getApiErrorMessage(cause, 'Não foi possível salvar o evento')) }
  }
  const unassignTeam = async (team: Team) => {
    if (!event) return
    try { await unassignTeamFromEvent(team.id, event.id); setAssignedTeams((current) => current.filter((item) => item.id !== team.id)); setAvailableTeams((current) => [...current, team]) }
    catch (cause) { setError(getApiErrorMessage(cause, 'Não foi possível salvar o evento')) }
  }
  const submit = async (formEvent: FormEvent) => {
    formEvent.preventDefault(); setError('')
    if (!name.trim()) return setError('Informe o nome do evento.')
    if (!eventDate) return setError('Informe a data do evento.')
    if (!location.trim()) return setError('Informe o local do evento.')
    if (!serviceType) return setError('Selecione o tipo de serviço.')
    if (!guestsCount || Number(guestsCount) < 1) return setError('Informe o número de convidados.')
    if (!clientId) return setError('Selecione o cliente do evento.')
    if (otherService && selected[otherService.id] !== undefined && !selected[otherService.id].trim()) return setError('Especifique o serviço Outro.')
    setLoading(true)
    try {
      const input = { name: name.trim(), eventDate: new Date(eventDate).toISOString(), endDate: null, location: location.trim(), serviceType: serviceType as EventType, guestsCount: Number(guestsCount), observations: observations.trim() || null }
      // On update clientId is sent only when it changes: the API rejects inactive clients, and an old event may still point to one.
      const saved = event ? await updateEvent(event.id, clientId === event.clientId ? input : { ...input, clientId }) : await createEvent({ ...input, clientId })
      const previous = new Set(event?.services.map((item) => item.serviceId) ?? [])
      for (const [serviceId, customLabel] of Object.entries(selected)) if (!previous.has(serviceId) || event?.services.find((item) => item.serviceId === serviceId)?.customLabel !== customLabel) await attachEventService(saved.id, serviceId, customLabel || null)
      for (const serviceId of previous) if (selected[serviceId] === undefined) await detachEventService(saved.id, serviceId)
      const result = { ...saved, services: services.filter((service) => selected[service.id] !== undefined).map((service) => ({ serviceId: service.id, customLabel: selected[service.id] || null, service })) }
      event ? onUpdated(result) : onCreated(result)
      onClose()
    } catch (cause) { setError(getApiErrorMessage(cause, 'Não foi possível salvar o evento')) } finally { setLoading(false) }
  }

  return <aside className="user-form-panel event-form-panel" role="dialog" aria-modal="true" aria-labelledby="event-form-title"><div className="form-wrap"><button type="button" className="link-button" onClick={onClose}>Voltar</button><h2 id="event-form-title">{event ? 'Editar evento' : 'Novo Evento'}</h2><form onSubmit={submit}><div className="event-form-grid"><section><h3>Informações principais</h3><label>Cliente<select aria-label="Cliente" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Selecione o cliente</option>{linkedInactiveClient && <option value={linkedInactiveClient.id}>{linkedInactiveClient.name} (inativo)</option>}{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Nome do evento<input aria-label="Nome do evento" value={name} onChange={(e) => setName(e.target.value)} /></label><label>Data do evento<input aria-label="Data do evento" type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></label><label>Local<input aria-label="Local" value={location} onChange={(e) => setLocation(e.target.value)} /></label><label>Tipo de serviço<select aria-label="Tipo de serviço" value={serviceType} onChange={(e) => setServiceType(e.target.value as EventType)}><option value="">Selecione</option>{eventTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Número de convidados<input aria-label="Número de convidados" type="number" min="1" value={guestsCount} onChange={(e) => setGuestsCount(e.target.value)} /></label><label>Observações<textarea aria-label="Observações" value={observations} onChange={(e) => setObservations(e.target.value)} /></label></section><section><h3>Serviços contratados</h3><div className="service-checks">{services.map((service) => <label key={service.id}><span><input type="checkbox" aria-label={service.name} checked={selected[service.id] !== undefined} onChange={() => toggleService(service)} /> {service.name}</span>{service.isCustom && selected[service.id] !== undefined && <input aria-label="Especifique..." placeholder="Especifique..." value={selected[service.id]} onChange={(e) => setSelected((current) => ({ ...current, [service.id]: e.target.value }))} />}</label>)}</div></section></div>{event && <section><h3>Equipes designadas</h3><div className="content-head"><select aria-label="Equipe para adicionar" value={teamToAssign} onChange={(e) => setTeamToAssign(e.target.value)}><option value="">Selecione uma equipe ativa</option>{availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><Button type="button" className="secondary" onClick={() => void assignTeam()} disabled={!teamToAssign}>Vincular equipe</Button></div><div className="service-checks">{assignedTeams.map((team) => <label key={team.id}><span>{team.name}</span><Button type="button" className="ghost" aria-label={`Desvincular ${team.name}`} onClick={() => void unassignTeam(team)}>Desvincular</Button></label>)}</div>{assignedTeams.length === 0 && <p>Nenhuma equipe designada.</p>}</section>}{error && <Notice message={error} error />}<div className="form-actions"><Button type="button" className="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" className="primary" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button></div></form></div></aside>
}
