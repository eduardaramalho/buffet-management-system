import { useEffect, useState } from 'react'
import { listClients, removeClient } from '../api/clientsApi'
import { getApiErrorMessage } from '../api/apiError'
import { useAuth } from '../contexts/useAuth'
import { Badge } from '../components/Badge'
import { ClientForm } from '../components/ClientForm'
import { Icon } from '../components/Icon'
import { Notice } from '../components/Notice'
import { Pagination } from '../components/Pagination'
import { StatCard } from '../components/StatCard'
import { Table } from '../components/Table'
import { formatDocument } from '../utils/document'
import { CLIENT_TYPE_LABELS, type Client } from '../types/client'

const PAGE_SIZE = 10

export function ClientsListPage() {
  const { user } = useAuth()
  const hasPermission = (permission: string) => Boolean(user?.roles?.some((role) => role.permissions.includes(permission)))
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client>()

  const fetchClients = (value: string) => listClients(value ? { search: value } : {})
  const showLoadError = (cause: unknown) => setError(getApiErrorMessage(cause, 'Erro ao carregar clientes'))
  const load = async (value: string) => {
    try { setClients(await fetchClients(value)); setError('') }
    catch (cause) { showLoadError(cause) }
  }
  useEffect(() => {
    let active = true
    fetchClients('').then((data) => { if (active) setClients(data) }).catch((cause) => { if (active) showLoadError(cause) })
    return () => { active = false }
  }, [])

  const totalPages = Math.max(1, Math.ceil(clients.length / PAGE_SIZE))
  const visibleClients = clients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const openForm = (client?: Client) => { setEditingClient(client); setFormOpen(true) }
  const closeForm = () => { setFormOpen(false); setEditingClient(undefined) }
  const saveClient = (saved: Client) => {
    setClients((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current])
    if (!editingClient) setPage(1)
  }
  const deleteClient = async (client: Client) => {
    if (!window.confirm(`Excluir ${client.name}?`)) return
    try { await removeClient(client.id); setClients((current) => current.filter((item) => item.id !== client.id)); setError('') }
    catch (cause) { setError(getApiErrorMessage(cause, 'Não foi possível excluir o cliente')) }
  }

  return <main className="app-shell">
    <header><div><span className="eyebrow">OPERAÇÃO DE BUFFET</span><h1>Clientes</h1></div>{hasPermission('clients:create') && <button className="secondary" onClick={() => openForm()}>Novo cliente</button>}</header>
    <section className="summary"><StatCard icon="♜" value={clients.length} label="Total de clientes" tone="blue" /><StatCard icon="☺" value={clients.filter((client) => client.type === 'PF').length} label="Pessoas físicas" tone="green" /><StatCard icon="◈" value={clients.filter((client) => client.type === 'PJ').length} label="Pessoas jurídicas" tone="gold" /></section>
    <section className="content-head"><input className="search" placeholder="Buscar por nome, documento ou e-mail..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); void load(event.target.value) }} /></section>
    {error && <Notice message={error} error />}
    <Table headers={['Nome', 'Tipo', 'Documento', 'Contato', 'Ações']}>{visibleClients.map((client) => <tr key={client.id}>
      <td><strong>{client.name}</strong></td>
      <td><Badge tone={client.type === 'PF' ? 'viewer' : 'editor'}>{CLIENT_TYPE_LABELS[client.type]}</Badge></td>
      <td>{formatDocument(client.document)}</td>
      <td>{client.email || client.phone ? <>{client.email && <div>{client.email}</div>}{client.phone && <small className="muted">{client.phone}</small>}</> : '-'}</td>
      <td><div className="row-actions">
        {hasPermission('clients:update') && <button title="Editar cliente" aria-label={`Editar ${client.name}`} onClick={() => openForm(client)}><Icon name="pencil" /></button>}
        {hasPermission('clients:delete') && <button title="Excluir cliente" aria-label={`Excluir ${client.name}`} onClick={() => void deleteClient(client)}><Icon name="trash" /></button>}
      </div></td>
    </tr>)}</Table>
    {clients.length === 0 && <div className="empty">Nenhum cliente encontrado.</div>}
    <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} onChange={setPage} />
    {formOpen && <ClientForm client={editingClient} onClose={closeForm} onSaved={saveClient} />}
  </main>
}
