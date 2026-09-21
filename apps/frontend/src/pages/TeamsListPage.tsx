import { useEffect, useState } from 'react'
import { listTeams, setTeamActive } from '../api/teamsApi'
import { Badge } from '../components/Badge'
import { Notice } from '../components/Notice'
import { Pagination } from '../components/Pagination'
import { StatCard } from '../components/StatCard'
import { Table } from '../components/Table'
import { TeamForm } from '../components/TeamForm'
import type { Team, TeamSpecialty } from '../types/team'

const PAGE_SIZE = 10
const specialtyLabels: Record<TeamSpecialty, string> = { COZINHA: 'Cozinha', SALAO: 'Salão', BAR: 'Bar', DECORACAO: 'Decoração', LIMPEZA: 'Limpeza', CERIMONIAL: 'Cerimonial', OUTRO: 'Outro' }

export function TeamsListPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team>()

  const load = async (value = search) => {
    try { setTeams(await listTeams({ search: value || undefined })); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Erro ao carregar equipes') }
  }
  useEffect(() => { void load('') }, [])
  const totalPages = Math.max(1, Math.ceil(teams.length / PAGE_SIZE))
  const visibleTeams = teams.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const openForm = (team?: Team) => { setEditingTeam(team); setFormOpen(true) }
  const addTeam = (team: Team) => { setTeams((current) => [team, ...current]); setPage(1) }
  const replaceTeam = (team: Team) => setTeams((current) => current.map((item) => item.id === team.id ? team : item))
  const changeStatus = async (team: Team) => {
    if (team.status === 'ATIVA' && !window.confirm(`Inativar ${team.name}?`)) return
    try { replaceTeam(await setTeamActive(team.id, team.status !== 'ATIVA')) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao alterar status da equipe') }
  }

  return <main className="app-shell"><header><div><span className="eyebrow">OPERAÇÃO DE BUFFET</span><h1>Equipes</h1></div><button className="secondary" onClick={() => openForm()}>Nova equipe</button></header><section className="summary"><StatCard icon="♜" value={teams.length} label="Total de equipes" tone="blue" /><StatCard icon="✓" value={teams.filter((team) => team.status === 'ATIVA').length} label="Equipes ativas" tone="green" /><StatCard icon="◌" value={teams.filter((team) => team.status === 'INATIVA').length} label="Inativas" tone="gold" /></section><section className="content-head"><input className="search" placeholder="Buscar por nome..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); void load(event.target.value) }} /></section>{error && <Notice message={error} error />}<Table headers={['Equipe', 'Especialidade', 'Membros', 'Status', 'Ações']}>{visibleTeams.map((team) => <tr key={team.id}><td><strong>{team.name}</strong></td><td>{specialtyLabels[team.specialty]}</td><td>{team.members.length}</td><td><Badge tone={team.status === 'ATIVA' ? 'active' : 'inactive'}>{team.status === 'ATIVA' ? 'Ativa' : 'Inativa'}</Badge></td><td><div className="row-actions"><button title="Visualizar equipe" aria-label={`Visualizar ${team.name}`} onClick={() => openForm(team)}>◉</button><button title="Editar equipe" aria-label={`Editar ${team.name}`} onClick={() => openForm(team)}>✎</button><button title={team.status === 'ATIVA' ? 'Inativar equipe' : 'Ativar equipe'} aria-label={`${team.status === 'ATIVA' ? 'Inativar' : 'Ativar'} ${team.name}`} onClick={() => void changeStatus(team)}>{team.status === 'ATIVA' ? '◌' : '●'}</button></div></td></tr>)}</Table>{teams.length === 0 && <div className="empty">Nenhuma equipe encontrada.</div>}<Pagination page={Math.min(page, totalPages)} totalPages={totalPages} onChange={setPage} />{formOpen && <TeamForm team={editingTeam} onClose={() => { setFormOpen(false); setEditingTeam(undefined) }} onCreated={(team) => { addTeam(team); setFormOpen(false) }} onUpdated={(team) => { replaceTeam(team); setFormOpen(false) }} />}</main>
}
