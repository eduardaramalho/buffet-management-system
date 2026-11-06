import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../api/apiError'
import { assignTeamToEvent, listTeams, listTeamsByEvent, unassignTeamFromEvent } from '../api/teamsApi'
import { attachEventService, createEvent, detachEventService, updateEvent } from '../api/eventsApi'
import { listServices } from '../api/servicesApi'
import { listClients } from '../api/clientsApi'
import { useToast } from '../contexts/toast'
import { useFormValidation } from '../hooks/useFormValidation'
import { toDateInput } from '../utils/dateInput'
import { initials } from '../utils/initials'
import { EVENT_TYPE_LABELS, TEAM_SPECIALTY_LABELS } from '../utils/labels'
import { maskInteger } from '../utils/masks'
import { eventFormSchema, GUESTS_MAX } from '../validation/eventSchema'
import { hasErrorIn } from '../validation/fieldErrors'
import { Icon } from './Icon'
import { ChoiceCard } from './form/ChoiceCard'
import { FieldGroup } from './form/FieldGroup'
import { FormModal, type FormModalSection } from './form/FormModal'
import { FormSection } from './form/FormSection'
import { MaskedField } from './form/MaskedField'
import { SelectField, TextAreaField, TextField } from './form/TextField'
import { EVENT_TYPES, type Event, type EventType, type Service } from '../types/event'
import type { Team } from '../types/team'
import type { Client } from '../types/client'

type EventFormProps = { event?: Event; onClose: () => void; onCreated: (event: Event) => void; onUpdated: (event: Event) => void }
type SectionId = 'client' | 'place' | 'services' | 'teams'

const SECTION_FIELDS: Record<Exclude<SectionId, 'teams'>, readonly string[]> = {
  client: ['clientId', 'name', 'eventDate', 'serviceType'],
  place: ['location', 'guestsCount', 'observations'],
  services: ['customLabel'],
}
const maskGuests = maskInteger(String(GUESTS_MAX).length)
const formatDateTime = (value: string) => new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

const teamSummary = (team: Team) => {
  const leader = team.members.find((member) => member.isLeader)
  return [TEAM_SPECIALTY_LABELS[team.specialty], plural(team.members.length, 'membro', 'membros'), leader ? `líder ${leader.collaborator.name}` : null].filter(Boolean).join(' · ')
}

export function EventForm({ event, onClose, onCreated, onUpdated }: EventFormProps) {
  const toast = useToast()
  const [section, setSection] = useState<SectionId>('client')
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
  const [apiError, setApiError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { void listServices().then(setServices).catch((cause) => setApiError(getApiErrorMessage(cause, 'Não foi possível carregar os serviços'))) }, [])
  useEffect(() => { void listClients().then(setClients).catch((cause) => setApiError(getApiErrorMessage(cause, 'Não foi possível carregar os clientes'))) }, [])
  useEffect(() => {
    if (!event) return
    void Promise.all([listTeams(), listTeamsByEvent(event.id)]).then(([teams, assignments]) => {
      const assignedIds = new Set(assignments.map((assignment) => assignment.teamId))
      setAvailableTeams(teams.filter((team) => !assignedIds.has(team.id) && team.status === 'ATIVA'))
      setAssignedTeams(teams.filter((team) => assignedIds.has(team.id)))
    }).catch((cause) => setApiError(getApiErrorMessage(cause, 'Não foi possível carregar as equipes')))
  }, [event])

  const otherService = services.find((service) => service.isCustom)
  const customSelected = Boolean(otherService && selected[otherService.id] !== undefined)
  const validation = useFormValidation(eventFormSchema, {
    clientId, name, eventDate, serviceType: serviceType as EventType, location, guestsCount, observations,
    customSelected, customLabel: otherService ? selected[otherService.id] ?? '' : '',
  })
  const selectedCount = services.filter((service) => selected[service.id] !== undefined).length
  // A soft-deleted client is not listed by the API; keep it selectable so editing an old event does not lose the link.
  const linkedInactiveClient = event?.client && !clients.some((client) => client.id === event.client?.id) ? event.client : null
  const clientName = clients.find((client) => client.id === clientId)?.name ?? (linkedInactiveClient?.id === clientId ? linkedInactiveClient.name : '')

  const invalidIn = (id: Exclude<SectionId, 'teams'>) => hasErrorIn(validation.errors, SECTION_FIELDS[id])
  const sectionState = (id: Exclude<SectionId, 'teams'>) => ({ complete: !invalidIn(id), invalid: validation.submitted && invalidIn(id) })
  const sections: FormModalSection[] = [
    { id: 'client', label: 'Cliente e data', description: clientName || 'Cliente, nome e data', ...sectionState('client') },
    { id: 'place', label: 'Local e convidados', description: location.trim() ? `${location.trim()}${guestsCount ? ` · ${guestsCount}` : ''}` : 'Local e número de convidados', ...sectionState('place') },
    { id: 'services', label: 'Serviços', description: plural(selectedCount, 'selecionado', 'selecionados'), ...sectionState('services') },
    ...(event ? [{ id: 'teams', label: 'Equipes', description: plural(assignedTeams.length, 'designada', 'designadas'), complete: assignedTeams.length > 0 }] : []),
  ]

  const toggleService = (service: Service) => setSelected((current) => {
    const next = { ...current }
    if (next[service.id] !== undefined) delete next[service.id]
    else next[service.id] = ''
    return next
  })

  // Vincular e desvincular equipes é imediato (cada ação já valida conflito de agenda na API).
  const assignTeam = async () => {
    if (!event || !teamToAssign) return
    setApiError('')
    try {
      await assignTeamToEvent(teamToAssign, event.id)
      const assigned = availableTeams.find((team) => team.id === teamToAssign)
      if (assigned) { setAssignedTeams((current) => [...current, assigned]); setAvailableTeams((current) => current.filter((team) => team.id !== teamToAssign)) }
      setTeamToAssign('')
    } catch (cause) { setApiError(getApiErrorMessage(cause, 'Não foi possível vincular a equipe')) }
  }
  const unassignTeam = async (team: Team) => {
    if (!event) return
    setApiError('')
    try { await unassignTeamFromEvent(team.id, event.id); setAssignedTeams((current) => current.filter((item) => item.id !== team.id)); setAvailableTeams((current) => [...current, team]) }
    catch (cause) { setApiError(getApiErrorMessage(cause, 'Não foi possível desvincular a equipe')) }
  }

  const persistServices = async (eventId: string) => {
    const previous = new Set(event?.services.map((item) => item.serviceId) ?? [])
    for (const [serviceId, customLabel] of Object.entries(selected)) {
      if (!previous.has(serviceId) || event?.services.find((item) => item.serviceId === serviceId)?.customLabel !== customLabel) await attachEventService(eventId, serviceId, customLabel.trim() || null)
    }
    for (const serviceId of previous) if (selected[serviceId] === undefined) await detachEventService(eventId, serviceId)
  }

  const submit = async () => {
    setApiError('')
    const data = validation.submit()
    if (!data) {
      const firstInvalid = (['client', 'place', 'services'] as const).find(invalidIn)
      if (firstInvalid) setSection(firstInvalid)
      return
    }
    setSubmitting(true)
    try {
      const input = { name: data.name, eventDate: new Date(eventDate).toISOString(), endDate: null, location: data.location, serviceType: data.serviceType, guestsCount: Number(guestsCount), observations: data.observations || null }
      // On update clientId is sent only when it changes: the API rejects inactive clients, and an old event may still point to one.
      const saved = event ? await updateEvent(event.id, clientId === event.clientId ? input : { ...input, clientId }) : await createEvent({ ...input, clientId })
      await persistServices(saved.id)
      const result = { ...saved, services: services.filter((service) => selected[service.id] !== undefined).map((service) => ({ serviceId: service.id, customLabel: selected[service.id].trim() || null, service })) }
      toast.success(event ? 'Evento atualizado.' : 'Evento criado.')
      if (event) onUpdated(result)
      else onCreated(result)
      onClose()
    } catch (cause) { setApiError(getApiErrorMessage(cause, 'Não foi possível salvar o evento')) } finally { setSubmitting(false) }
  }

  const subtitle = event ? `${event.name} · ${formatDateTime(event.eventDate)} · ${plural(event.guestsCount, 'convidado', 'convidados')}` : 'Cadastre o evento e os serviços contratados.'

  return <FormModal title={event ? 'Editar evento' : 'Novo evento'} subtitle={subtitle} icon={<Icon name="calendar" />}
    onClose={onClose} onSubmit={submit} submitting={submitting} submitLabel={event ? 'Salvar alterações' : 'Salvar evento'} error={apiError} invalidAttempt={validation.invalidAttempt}
    sections={sections} activeSection={section} onSectionChange={(id) => setSection(id as SectionId)}>
    <FormSection title="Cliente e data" active={section === 'client'}>
      <div className="fm-row">
        <SelectField label="Cliente" required value={clientId} error={validation.errorFor('clientId')}
          onChange={(e) => setClientId(e.target.value)} onBlur={(e) => validation.touch('clientId', e)}>
          <option value="">Selecione o cliente</option>
          {linkedInactiveClient && <option value={linkedInactiveClient.id}>{linkedInactiveClient.name} (inativo)</option>}
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </SelectField>
        <TextField label="Nome do evento" required value={name} maxLength={150} placeholder="Ex.: Casamento de Bruna" error={validation.errorFor('name')}
          onChange={(e) => setName(e.target.value)} onBlur={(e) => validation.touch('name', e)} />
      </div>
      <div className="fm-row">
        <TextField label="Data e hora" required type="datetime-local" value={eventDate} error={validation.errorFor('eventDate')}
          onChange={(e) => setEventDate(e.target.value)} onBlur={(e) => validation.touch('eventDate', e)} />
        <SelectField label="Tipo de evento" required value={serviceType} error={validation.errorFor('serviceType')}
          onChange={(e) => setServiceType(e.target.value as EventType)} onBlur={(e) => validation.touch('serviceType', e)}>
          <option value="">Selecione</option>
          {EVENT_TYPES.map((value) => <option key={value} value={value}>{EVENT_TYPE_LABELS[value]}</option>)}
        </SelectField>
      </div>
    </FormSection>

    <FormSection title="Local e convidados" description="O número de convidados é usado pelas regras que dependem de faixa." active={section === 'place'}>
      <div className="fm-row">
        <TextField label="Local" required value={location} maxLength={200} error={validation.errorFor('location')}
          onChange={(e) => setLocation(e.target.value)} onBlur={(e) => validation.touch('location', e)} />
        <MaskedField label="Convidados" required value={guestsCount} mask={maskGuests} inputMode="numeric" hint={`De 1 a ${GUESTS_MAX}.`} error={validation.errorFor('guestsCount')}
          onValueChange={setGuestsCount} onBlur={(e) => validation.touch('guestsCount', e)} />
      </div>
      <TextAreaField label="Observações" optional value={observations} maxLength={2000} placeholder="Restrições alimentares, horários especiais..." error={validation.errorFor('observations')}
        onChange={(e) => setObservations(e.target.value)} onBlur={(e) => validation.touch('observations', e)} />
    </FormSection>

    <FormSection title="Serviços contratados" description="Os serviços marcados entram nas condições das regras." active={section === 'services'}>
      <FieldGroup label="Serviços" optional aside={plural(selectedCount, 'selecionado', 'selecionados')}>
        {services.length === 0
          ? <p className="fm-list fm-list-empty">Nenhum serviço cadastrado.</p>
          : <div className="fm-choices">{services.map((service) => <ChoiceCard key={service.id} type="checkbox" title={service.name}
            description={service.isCustom ? 'Serviço com rótulo livre' : undefined} checked={selected[service.id] !== undefined} onChange={() => toggleService(service)} />)}</div>}
      </FieldGroup>
      {otherService && customSelected && <TextField label='Qual serviço é o "Outro"?' required className="fm-half" value={selected[otherService.id]} maxLength={255} placeholder="Ex.: Fotógrafo"
        error={validation.errorFor('customLabel')} onChange={(e) => setSelected((current) => ({ ...current, [otherService.id]: e.target.value }))}
        onBlur={(e) => validation.touch('customLabel', e)} />}
    </FormSection>

    {event && <FormSection title="Equipes designadas" description="Vincular e desvincular é imediato, sem precisar salvar." active={section === 'teams'}>
      {assignedTeams.length > 0
        ? <ul className="fm-list" aria-label="Equipes designadas">{assignedTeams.map((team) => <li key={team.id}>
          <span className="fm-avatar" aria-hidden="true">{initials(team.name)}</span>
          <span className="fm-person"><strong>{team.name}</strong><small>{teamSummary(team)}</small></span>
          <button type="button" className="fm-btn fm-btn-secondary fm-btn-sm" aria-label={`Desvincular ${team.name}`} onClick={() => void unassignTeam(team)}>Desvincular</button>
        </li>)}</ul>
        : <p className="fm-list fm-list-empty">Nenhuma equipe designada.</p>}
      <div className="fm-field">
        <div className="fm-label-row"><label htmlFor="event-team-to-assign">Equipe para vincular</label></div>
        <div className="fm-inline">
          <select id="event-team-to-assign" className="fm-input" value={teamToAssign} onChange={(e) => setTeamToAssign(e.target.value)}>
            <option value="">Selecione uma equipe ativa</option>
            {availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
          <button type="button" className="fm-btn fm-btn-secondary" onClick={() => void assignTeam()} disabled={!teamToAssign}>Vincular equipe</button>
        </div>
        <small className="fm-hint">Se a equipe já estiver em outro evento no mesmo horário, o sistema avisa ao vincular.</small>
      </div>
    </FormSection>}
  </FormModal>
}
