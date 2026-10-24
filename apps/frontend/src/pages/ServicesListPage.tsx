import { useEffect, useState } from 'react'
import { listServices, removeService } from '../api/servicesApi'
import { getApiErrorMessage } from '../api/apiError'
import { useAuth } from '../contexts/useAuth'
import { Badge } from '../components/Badge'
import { Icon } from '../components/Icon'
import { Notice } from '../components/Notice'
import { Pagination } from '../components/Pagination'
import { ServiceForm } from '../components/ServiceForm'
import { StatCard } from '../components/StatCard'
import { Table } from '../components/Table'
import type { Service } from '../types/event'

const PAGE_SIZE = 10
// Same tolerance as the MySQL collation used for uniqueness: case and accents do not matter.
const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
const byName = (left: Service, right: Service) => left.name.localeCompare(right.name, 'pt-BR')

/** RF06: catalog of contractable services. The list is small, so search runs on the loaded data. */
export function ServicesListPage() {
  const { user } = useAuth()
  const hasPermission = (permission: string) => Boolean(user?.roles?.some((role) => role.permissions.includes(permission)))
  const [services, setServices] = useState<Service[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service>()

  useEffect(() => {
    let active = true
    listServices()
      .then((data) => { if (active) setServices([...data].sort(byName)) })
      .catch((cause) => { if (active) setError(getApiErrorMessage(cause, 'Erro ao carregar serviços')) })
    return () => { active = false }
  }, [])

  const filtered = services.filter((service) => normalize(service.name).includes(normalize(search)))
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((Math.min(page, totalPages) - 1) * PAGE_SIZE, Math.min(page, totalPages) * PAGE_SIZE)
  const openForm = (service?: Service) => { setEditingService(service); setFormOpen(true) }
  const closeForm = () => { setFormOpen(false); setEditingService(undefined) }
  const saveService = (saved: Service) => setServices((current) => [...current.filter((item) => item.id !== saved.id), saved].sort(byName))

  const deleteService = async (service: Service) => {
    if (!window.confirm(`Excluir o serviço ${service.name}? Eventos que já o contrataram continuam com ele no histórico, mas novos eventos não poderão contratá-lo.`)) return
    try {
      await removeService(service.id)
      setServices((current) => current.filter((item) => item.id !== service.id))
      setError('')
    } catch (cause) { setError(getApiErrorMessage(cause, 'Não foi possível excluir o serviço')) }
  }

  return <main className="app-shell">
    <header><div><span className="eyebrow">OPERAÇÃO DE BUFFET</span><h1>Serviços</h1></div>{hasPermission('services:create') && <button className="secondary" onClick={() => openForm()}>Novo serviço</button>}</header>
    <section className="summary"><StatCard icon={<Icon name="tag" />} value={services.length} label="Total de serviços" tone="blue" /></section>
    <section className="content-head"><input className="search" placeholder="Buscar serviço..." aria-label="Buscar serviço" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></section>
    {error && <Notice message={error} error />}
    <Table headers={['Nome', 'Tipo', 'Ações']}>{visible.map((service) => <tr key={service.id}>
      <td><strong>{service.name}</strong></td>
      <td>{service.isCustom ? <Badge tone="editor">Rótulo livre</Badge> : <Badge tone="neutral">Padrão</Badge>}</td>
      <td><div className="row-actions">
        {hasPermission('services:update') && <button title="Editar serviço" aria-label={`Editar ${service.name}`} onClick={() => openForm(service)}><Icon name="pencil" /></button>}
        {hasPermission('services:delete') && !service.isCustom && <button title="Excluir serviço" aria-label={`Excluir ${service.name}`} onClick={() => void deleteService(service)}><Icon name="trash" /></button>}
      </div></td>
    </tr>)}</Table>
    {filtered.length === 0 && <div className="empty">Nenhum serviço encontrado.</div>}
    <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} onChange={setPage} />
    {formOpen && <ServiceForm service={editingService} onClose={closeForm} onSaved={saveService} />}
  </main>
}
