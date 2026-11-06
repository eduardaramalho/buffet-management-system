import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../api/apiError'
import { addTeamMember, createTeam, removeTeamMember, updateTeam } from '../api/teamsApi'
import { listCollaborators } from '../api/collaboratorsApi'
import { useToast } from '../contexts/toast'
import { useFormValidation } from '../hooks/useFormValidation'
import { initials } from '../utils/initials'
import { TEAM_SPECIALTY_LABELS } from '../utils/labels'
import { hasErrorIn } from '../validation/fieldErrors'
import { teamFormSchema } from '../validation/teamSchema'
import { CollaboratorForm } from './CollaboratorForm'
import { Icon } from './Icon'
import { FormModal, type FormModalSection } from './form/FormModal'
import { FormSection } from './form/FormSection'
import { SelectField, TextAreaField, TextField } from './form/TextField'
import type { Collaborator } from '../types/collaborator'
import type { Team, TeamSpecialty } from '../types/team'
import { TEAM_SPECIALTIES } from '../types/team'

type TeamFormProps = { team?: Team; onClose: () => void; onCreated: (team: Team) => void; onUpdated: (team: Team) => void }
type SectionId = 'data' | 'members'
const DATA_FIELDS = ['name', 'specialty', 'observations'] as const

const memberCount = (count: number) => (count === 1 ? '1 membro' : `${count} membros`)

/** Pessoa da lista: iniciais, nome e cargo (o cargo vem do cadastro do colaborador). */
function Person({ collaborator, leader = false }: { collaborator: Collaborator; leader?: boolean }) {
  return <>
    <span className={`fm-avatar${leader ? ' leader' : ''}`} aria-hidden="true">{initials(collaborator.name)}</span>
    <span className="fm-person"><strong>{collaborator.name}</strong><small>{collaborator.position}{leader ? ' · Líder da equipe' : ''}</small></span>
  </>
}

export function TeamForm({ team, onClose, onCreated, onUpdated }: TeamFormProps) {
  const toast = useToast()
  const [section, setSection] = useState<SectionId>('data')
  const [name, setName] = useState(team?.name ?? '')
  const [specialty, setSpecialty] = useState<TeamSpecialty | ''>(team?.specialty ?? '')
  const [observations, setObservations] = useState(team?.observations ?? '')
  const [members, setMembers] = useState<Collaborator[]>(() => team?.members.map((member) => member.collaborator) ?? [])
  const [leaderId, setLeaderId] = useState(() => team?.members.find((member) => member.isLeader)?.collaboratorId ?? '')
  const [changingLeader, setChangingLeader] = useState(false)
  const [search, setSearch] = useState('')
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [apiError, setApiError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [newCollaboratorOpen, setNewCollaboratorOpen] = useState(false)
  const validation = useFormValidation(teamFormSchema, { name, specialty: specialty as TeamSpecialty, observations })

  useEffect(() => {
    void listCollaborators({ search: search || undefined })
      .then(setCollaborators)
      .catch((cause) => setApiError(getApiErrorMessage(cause, 'Não foi possível carregar os colaboradores')))
  }, [search])

  const memberIds = new Set(members.map((member) => member.id))
  const available = collaborators.filter((collaborator) => collaborator.status === 'ATIVO' && !memberIds.has(collaborator.id))
  const leader = members.find((member) => member.id === leaderId)
  const others = members.filter((member) => member.id !== leaderId)
  const showLeaderCard = Boolean(leader) && !changingLeader

  const addMember = (collaborator: Collaborator) => setMembers((current) => (current.some((member) => member.id === collaborator.id) ? current : [...current, collaborator]))
  const removeMember = (collaboratorId: string) => setMembers((current) => current.filter((member) => member.id !== collaboratorId))
  // O líder é escolhido num único controle: escolher outro substitui o atual, então nunca há dois líderes.
  const chooseLeader = (collaboratorId: string) => { setLeaderId(collaboratorId); setChangingLeader(false) }

  const dataInvalid = hasErrorIn(validation.errors, DATA_FIELDS)
  const sections: FormModalSection[] = [
    { id: 'data', label: 'Dados da equipe', description: name.trim() || 'Nome e especialidade', complete: !dataInvalid, invalid: validation.submitted && dataInvalid },
    { id: 'members', label: 'Membros e líder', description: memberCount(members.length), complete: members.length > 0 },
  ]

  /**
   * Sincroniza os membros com a API. A ordem importa: a API recusa um segundo líder (409), então quem deixa
   * de liderar é rebaixado antes de o novo líder ser gravado, e o novo líder entra por último.
   */
  const persistMembers = async (teamId: string) => {
    const previous = new Map(team?.members.map((member) => [member.collaboratorId, member.isLeader]) ?? [])
    for (const collaboratorId of previous.keys()) if (!memberIds.has(collaboratorId)) await removeTeamMember(teamId, collaboratorId)
    for (const [collaboratorId, wasLeader] of previous) {
      if (wasLeader && memberIds.has(collaboratorId) && collaboratorId !== leaderId) {
        await removeTeamMember(teamId, collaboratorId)
        await addTeamMember(teamId, collaboratorId, false)
      }
    }
    for (const member of members) if (!previous.has(member.id) && member.id !== leaderId) await addTeamMember(teamId, member.id, false)
    if (leaderId && previous.get(leaderId) !== true) {
      if (previous.has(leaderId)) await removeTeamMember(teamId, leaderId)
      await addTeamMember(teamId, leaderId, true)
    }
  }

  const submit = async () => {
    setApiError('')
    const data = validation.submit()
    if (!data) { if (dataInvalid) setSection('data'); return }
    setSubmitting(true)
    try {
      const input = { name: data.name, specialty: data.specialty, observations: data.observations || null }
      const saved = team ? await updateTeam(team.id, input) : await createTeam(input)
      await persistMembers(saved.id)
      // A tela já sabe a composição final; assim a lista não depende de qual chamada respondeu por último.
      const result: Team = { ...saved, members: members.map((member) => ({ collaboratorId: member.id, isLeader: member.id === leaderId, collaborator: member })) }
      toast.success(team ? 'Equipe atualizada.' : 'Equipe criada.')
      if (team) onUpdated(result)
      else onCreated(result)
      onClose()
    } catch (cause) { setApiError(getApiErrorMessage(cause, 'Não foi possível salvar a equipe')) } finally { setSubmitting(false) }
  }

  const subtitle = name.trim() ? `${name.trim()}${specialty ? ` · ${TEAM_SPECIALTY_LABELS[specialty]}` : ''}` : 'Defina o grupo, os membros e quem lidera.'

  return <>
    <FormModal title={team ? 'Editar equipe' : 'Nova equipe'} subtitle={subtitle} icon={<Icon name="users" />}
      onClose={onClose} onSubmit={submit} submitting={submitting} submitLabel="Salvar equipe" error={apiError} invalidAttempt={validation.invalidAttempt}
      sections={sections} activeSection={section} onSectionChange={(id) => setSection(id as SectionId)}>
      <FormSection title="Dados da equipe" description="A especialidade é usada pelo motor de regras para atribuir tarefas." active={section === 'data'}>
        <div className="fm-row">
          <TextField label="Nome da equipe" required value={name} maxLength={150} error={validation.errorFor('name')}
            onChange={(event) => setName(event.target.value)} onBlur={(event) => validation.touch('name', event)} />
          <SelectField label="Especialidade" required value={specialty} error={validation.errorFor('specialty')}
            onChange={(event) => setSpecialty(event.target.value as TeamSpecialty)} onBlur={(event) => validation.touch('specialty', event)}>
            <option value="">Selecione</option>
            {TEAM_SPECIALTIES.map((value) => <option key={value} value={value}>{TEAM_SPECIALTY_LABELS[value]}</option>)}
          </SelectField>
        </div>
        <TextAreaField label="Observações" optional value={observations} maxLength={2000} placeholder="Ex.: turno da noite, uniforme preto" error={validation.errorFor('observations')}
          onChange={(event) => setObservations(event.target.value)} onBlur={(event) => validation.touch('observations', event)} />
      </FormSection>

      <FormSection title="Membros e líder" description="Adicione colaboradores ativos e, se quiser, escolha um líder." active={section === 'members'}>
        <div className="fm-columns">
          <section className="fm-card" aria-labelledby="team-available-title">
            <div className="fm-card-head"><h4 id="team-available-title">Colaboradores disponíveis</h4></div>
            <span className="fm-input-wrap lead">
              <Icon name="search" />
              <input className="fm-input" aria-label="Buscar por nome ou cargo" placeholder="Buscar por nome ou cargo" value={search} onChange={(event) => setSearch(event.target.value)} />
            </span>
            {available.length > 0
              ? <ul className="fm-list">{available.map((collaborator) => <li key={collaborator.id}>
                <Person collaborator={collaborator} />
                <button type="button" className="fm-btn fm-btn-secondary fm-btn-sm" aria-label={`Adicionar ${collaborator.name}`} onClick={() => addMember(collaborator)}><Icon name="plus" />Adicionar</button>
              </li>)}</ul>
              : <p className="fm-list fm-list-empty">Nenhum colaborador disponível.</p>}
            <button type="button" className="fm-btn fm-btn-text fm-btn-sm" onClick={() => setNewCollaboratorOpen(true)}><Icon name="plus" />Cadastrar novo colaborador</button>
          </section>

          <section className="fm-card" aria-labelledby="team-members-title">
            <div className="fm-card-head"><h4 id="team-members-title">Na equipe</h4><span className="fm-aside">{memberCount(members.length)}</span></div>
            {showLeaderCard && leader
              ? <div className="fm-leader set">
                <Person collaborator={leader} leader />
                <button type="button" className="fm-btn fm-btn-secondary fm-btn-sm" aria-label="Trocar líder" onClick={() => setChangingLeader(true)}>Trocar</button>
              </div>
              : <div className="fm-leader">
                <span className="fm-leader-icon" aria-hidden="true"><Icon name="crown" /></span>
                <select className="fm-input" aria-label="Líder da equipe" value={leaderId} disabled={members.length === 0} onChange={(event) => chooseLeader(event.target.value)}>
                  <option value="">{members.length === 0 ? 'Adicione membros para escolher o líder' : 'Sem líder (opcional)'}</option>
                  {members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.position}</option>)}
                </select>
              </div>}
            {others.length > 0
              ? <ul className="fm-list" aria-label="Membros da equipe">{others.map((member) => <li key={member.id}>
                <Person collaborator={member} />
                <button type="button" className="fm-icon-btn" aria-label={`Remover ${member.name}`} onClick={() => removeMember(member.id)}><Icon name="x" /></button>
              </li>)}</ul>
              : <p className="fm-list fm-list-empty">{members.length === 0 ? 'Adicione colaboradores pela lista ao lado.' : 'Nenhum outro membro.'}</p>}
            <small className="fm-hint">A equipe tem no máximo um líder. "Trocar" escolhe outro membro no lugar dele.</small>
          </section>
        </div>
      </FormSection>
    </FormModal>
    {/* Fora do modal da equipe (irmão, não filho): eventos de submit de um portal sobem pela árvore do React
        e acionariam o formulário da equipe se o colaborador fosse renderizado dentro dele. */}
    {newCollaboratorOpen && <CollaboratorForm onClose={() => setNewCollaboratorOpen(false)}
      onCreated={(created) => { setCollaborators((current) => [created, ...current]); addMember(created) }} onUpdated={() => setNewCollaboratorOpen(false)} />}
  </>
}
