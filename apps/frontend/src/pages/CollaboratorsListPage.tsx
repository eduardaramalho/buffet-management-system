import { useEffect, useState } from 'react'
import { listCollaborators, setCollaboratorActive } from '../api/collaboratorsApi'
import { Badge } from '../components/Badge'
import { CollaboratorForm } from '../components/CollaboratorForm'
import { Notice } from '../components/Notice'
import { Pagination } from '../components/Pagination'
import { StatCard } from '../components/StatCard'
import { Table } from '../components/Table'
import type { Collaborator } from '../types/collaborator'

const PAGE_SIZE = 10

export function CollaboratorsListPage() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator>()

  const load = async (value = search) => {
    try { setCollaborators(await listCollaborators({ search: value || undefined })); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Erro ao carregar colaboradores') }
  }
  useEffect(() => { void load('') }, [])
  const totalPages = Math.max(1, Math.ceil(collaborators.length / PAGE_SIZE))
  const visibleCollaborators = collaborators.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const openForm = (collaborator?: Collaborator) => { setEditingCollaborator(collaborator); setFormOpen(true) }
  const addCollaborator = (collaborator: Collaborator) => { setCollaborators((current) => [collaborator, ...current]); setPage(1) }
  const replaceCollaborator = (collaborator: Collaborator) => setCollaborators((current) => current.map((item) => item.id === collaborator.id ? collaborator : item))
  const changeStatus = async (collaborator: Collaborator) => {
    if (collaborator.status === 'ATIVO' && !window.confirm(`Inativar ${collaborator.name}?`)) return
    try { replaceCollaborator(await setCollaboratorActive(collaborator.id, collaborator.status !== 'ATIVO')) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao alterar status do colaborador') }
  }

  return <main className="app-shell"><header><div><span className="eyebrow">OPERAÇÃO DE BUFFET</span><h1>Colaboradores</h1></div><button className="secondary" onClick={() => openForm()}>Novo colaborador</button></header><section className="summary"><StatCard icon="☺" value={collaborators.length} label="Total de colaboradores" tone="blue" /><StatCard icon="✓" value={collaborators.filter((collaborator) => collaborator.status === 'ATIVO').length} label="Ativos" tone="green" /><StatCard icon="◌" value={collaborators.filter((collaborator) => collaborator.status === 'INATIVO').length} label="Inativos" tone="gold" /></section><section className="content-head"><input className="search" placeholder="Buscar por nome..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); void load(event.target.value) }} /></section>{error && <Notice message={error} error />}<Table headers={['Nome', 'Telefone', 'Cargo', 'Status', 'Ações']}>{visibleCollaborators.map((collaborator) => <tr key={collaborator.id}><td><strong>{collaborator.name}</strong></td><td>{collaborator.phone ?? '-'}</td><td>{collaborator.position}</td><td><Badge tone={collaborator.status === 'ATIVO' ? 'active' : 'inactive'}>{collaborator.status === 'ATIVO' ? 'Ativo' : 'Inativo'}</Badge></td><td><div className="row-actions"><button title="Visualizar colaborador" aria-label={`Visualizar ${collaborator.name}`} onClick={() => openForm(collaborator)}>◉</button><button title="Editar colaborador" aria-label={`Editar ${collaborator.name}`} onClick={() => openForm(collaborator)}>✎</button><button title={collaborator.status === 'ATIVO' ? 'Inativar colaborador' : 'Ativar colaborador'} aria-label={`${collaborator.status === 'ATIVO' ? 'Inativar' : 'Ativar'} ${collaborator.name}`} onClick={() => void changeStatus(collaborator)}>{collaborator.status === 'ATIVO' ? '◌' : '●'}</button></div></td></tr>)}</Table>{collaborators.length === 0 && <div className="empty">Nenhum colaborador encontrado.</div>}<Pagination page={Math.min(page, totalPages)} totalPages={totalPages} onChange={setPage} />{formOpen && <CollaboratorForm collaborator={editingCollaborator} onClose={() => { setFormOpen(false); setEditingCollaborator(undefined) }} onCreated={(collaborator) => { addCollaborator(collaborator); setFormOpen(false) }} onUpdated={(collaborator) => { replaceCollaborator(collaborator); setFormOpen(false) }} />}</main>
}
