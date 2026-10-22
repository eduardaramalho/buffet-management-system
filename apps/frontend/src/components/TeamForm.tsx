import { useEffect, useState, type FormEvent } from 'react'
import { getApiErrorMessage } from '../api/apiError'
import { addTeamMember, createTeam, removeTeamMember, updateTeam } from '../api/teamsApi'
import { listCollaborators } from '../api/collaboratorsApi'
import { Button } from './Button'
import { CollaboratorForm } from './CollaboratorForm'
import { Notice } from './Notice'
import type { Collaborator } from '../types/collaborator'
import type { Team, TeamSpecialty } from '../types/team'
import { TEAM_SPECIALTIES } from '../types/team'

type TeamFormProps = { team?: Team; onClose: () => void; onCreated: (team: Team) => void; onUpdated: (team: Team) => void }
const specialtyLabels: Record<TeamSpecialty, string> = { COZINHA: 'Cozinha', SALAO: 'Salão', BAR: 'Bar', DECORACAO: 'Decoração', LIMPEZA: 'Limpeza', CERIMONIAL: 'Cerimonial', OUTRO: 'Outro' }
type SelectedMember = { collaborator: Collaborator; isLeader: boolean }

export function TeamForm({ team, onClose, onCreated, onUpdated }: TeamFormProps) {
  const [name, setName] = useState(team?.name ?? '')
  const [specialty, setSpecialty] = useState<TeamSpecialty | ''>(team?.specialty ?? '')
  const [observations, setObservations] = useState(team?.observations ?? '')
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [selected, setSelected] = useState<Record<string, SelectedMember>>(() => Object.fromEntries(team?.members.map((member) => [member.collaboratorId, { collaborator: member.collaborator, isLeader: member.isLeader }]) ?? []))
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [newCollaboratorOpen, setNewCollaboratorOpen] = useState(false)

  const reloadCollaborators = () => listCollaborators({ search: search || undefined }).then(setCollaborators).catch((cause) => setError(getApiErrorMessage(cause, 'Não foi possível salvar a equipe')))
  useEffect(() => { void reloadCollaborators() }, [search])
  const toggleMember = (collaborator: Collaborator) => setSelected((current) => {
    if (current[collaborator.id]) { const next = { ...current }; delete next[collaborator.id]; return next }
    return { ...current, [collaborator.id]: { collaborator, isLeader: false } }
  })
  const toggleLeader = (collaboratorId: string) => setSelected((current) => {
    if (!current[collaboratorId]) return current
    const isLeader = current[collaboratorId].isLeader
    if (!isLeader && Object.entries(current).some(([id, member]) => id !== collaboratorId && member.isLeader)) {
      setError('A equipe pode ter apenas um líder.')
      return current
    }
    return { ...current, [collaboratorId]: { ...current[collaboratorId], isLeader: !isLeader } }
  })
  const submit = async (formEvent: FormEvent) => {
    formEvent.preventDefault(); setError('')
    if (!name.trim()) return setError('Informe o nome da equipe.')
    if (!specialty) return setError('Selecione a especialidade.')
    setLoading(true)
    try {
      const input = { name: name.trim(), specialty, observations: observations.trim() || null }
      const saved = team ? await updateTeam(team.id, input) : await createTeam(input)
      const previous = new Map(team?.members.map((member) => [member.collaboratorId, member.isLeader]) ?? [])
      let result = saved
      for (const [collaboratorId, member] of Object.entries(selected)) {
        if (!previous.has(collaboratorId)) result = await addTeamMember(saved.id, collaboratorId, member.isLeader)
        else if (previous.get(collaboratorId) !== member.isLeader) {
          await removeTeamMember(saved.id, collaboratorId)
          result = await addTeamMember(saved.id, collaboratorId, member.isLeader)
        }
      }
      for (const collaboratorId of previous.keys()) if (!selected[collaboratorId]) await removeTeamMember(saved.id, collaboratorId)
      team ? onUpdated(result) : onCreated(result)
      onClose()
    } catch (cause) { setError(getApiErrorMessage(cause, 'Não foi possível salvar a equipe')) } finally { setLoading(false) }
  }

  return <aside className="user-form-panel" role="dialog" aria-modal="true" aria-labelledby="team-form-title"><div className="form-wrap"><button type="button" className="link-button" onClick={onClose}>Voltar</button><h2 id="team-form-title">{team ? 'Editar equipe' : 'Nova equipe'}</h2><form onSubmit={submit}><label>Nome da equipe<input aria-label="Nome da equipe" value={name} onChange={(event) => setName(event.target.value)} /></label><label>Especialidade<select aria-label="Especialidade" value={specialty} onChange={(event) => setSpecialty(event.target.value as TeamSpecialty)}><option value="">Selecione</option>{TEAM_SPECIALTIES.map((value) => <option key={value} value={value}>{specialtyLabels[value]}</option>)}</select></label><label>Observações<textarea aria-label="Observações" value={observations} onChange={(event) => setObservations(event.target.value)} /></label><section><h3>Membros da equipe</h3><input aria-label="Buscar colaboradores" placeholder="Buscar colaboradores..." value={search} onChange={(event) => setSearch(event.target.value)} /><button type="button" className="link-button" onClick={() => setNewCollaboratorOpen(true)}>+ Novo colaborador</button><div className="service-checks">{collaborators.filter((collaborator) => collaborator.status === 'ATIVO').map((collaborator) => <label key={collaborator.id}><span><input type="checkbox" aria-label={collaborator.name} checked={Boolean(selected[collaborator.id])} onChange={() => toggleMember(collaborator)} /> {collaborator.name}</span>{selected[collaborator.id] && <button type="button" onClick={() => toggleLeader(collaborator.id)} aria-label={`${selected[collaborator.id].isLeader ? 'Remover líder' : 'Definir líder'} ${collaborator.name}`}>{selected[collaborator.id].isLeader ? 'Líder' : 'Definir líder'}</button>}</label>)}</div></section>{error && <Notice message={error} error />}<div className="form-actions"><Button type="button" className="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" className="primary" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button></div></form>{/* Fora do <form> da equipe: <form> aninhado é HTML inválido e o submit do colaborador recarregava a página. */}{newCollaboratorOpen && <CollaboratorForm onClose={() => setNewCollaboratorOpen(false)} onCreated={(created) => { setCollaborators((current) => [created, ...current]); toggleMember(created); setNewCollaboratorOpen(false) }} onUpdated={() => setNewCollaboratorOpen(false)} />}</div></aside>
}
