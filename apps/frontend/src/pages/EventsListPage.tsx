import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listEvents, removeEvent } from '../api/eventsApi'
import { Badge } from '../components/Badge'
import { EventForm } from '../components/EventForm'
import { Notice } from '../components/Notice'
import { Pagination } from '../components/Pagination'
import { StatCard } from '../components/StatCard'
import { Table } from '../components/Table'
import type { Event, EventStatus } from '../types/event'

const PAGE_SIZE = 10
const statusLabels: Record<EventStatus, string> = { PLANEJAMENTO: 'Planejamento', CONFIRMADO: 'Confirmado', EM_ANDAMENTO: 'Em andamento', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' }
const statusTone: Record<EventStatus, 'admin' | 'editor' | 'viewer' | 'active' | 'inactive'> = { PLANEJAMENTO: 'viewer', CONFIRMADO: 'active', EM_ANDAMENTO: 'editor', CONCLUIDO: 'active', CANCELADO: 'inactive' }
const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))

export function EventsListPage() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<EventStatus | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | undefined>()

  const load = async () => {
    try { setEvents(await listEvents({ search: search || undefined, status: status || undefined, from: from || undefined, to: to || undefined })); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Erro ao carregar eventos') }
  }
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [search, status, from, to])
  const thisMonth = new Date().toISOString().slice(0, 7)
  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE))
  const visibleEvents = events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const addEvent = (event: Event) => { setEvents((current) => [event, ...current]); setPage(1) }
  const replaceEvent = (event: Event) => setEvents((current) => current.map((item) => item.id === event.id ? event : item))
  const remove = async (event: Event) => { if (!window.confirm(`Cancelar/excluir ${event.name}?`)) return; try { await removeEvent(event.id); setEvents((current) => current.filter((item) => item.id !== event.id)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao excluir evento') } }

  return <main className="app-shell"><header><div><span className="eyebrow">PAINEL OPERACIONAL</span><h1>Eventos</h1></div><button className="secondary" onClick={() => { setEditingEvent(undefined); setFormOpen(true) }}>Novo Evento</button></header><section className="summary"><StatCard icon="◈" value={events.length} label="Total de eventos" tone="blue" /><StatCard icon="▣" value={events.filter((event) => event.eventDate.slice(0, 7) === thisMonth).length} label="Eventos este mês" tone="green" /><StatCard icon="✓" value={events.filter((event) => event.status === 'CONFIRMADO').length} label="Confirmados" tone="gold" /><StatCard icon="◷" value={events.filter((event) => event.status === 'EM_ANDAMENTO').length} label="Em andamento" tone="purple" /></section><section className="content-head"><input className="search" placeholder="Buscar por nome ou local..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /><select aria-label="Status" value={status} onChange={(event) => { setStatus(event.target.value as EventStatus | ''); setPage(1) }}><option value="">Todos os status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input aria-label="Data inicial" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><input aria-label="Data final" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></section>{error && <Notice message={error} error />}<Table headers={['Evento', 'Data', 'Local', 'Tipo de serviço', 'Status', 'Ações']}>{visibleEvents.map((event) => <tr key={event.id}><td><strong>{event.name}</strong></td><td>{formatDate(event.eventDate)}</td><td>{event.location}</td><td>{event.serviceType}</td><td><Badge tone={statusTone[event.status]}>{statusLabels[event.status]}</Badge></td><td><div className="row-actions"><button title="Visualizar evento" aria-label={`Visualizar ${event.name}`} onClick={() => navigate(`/events/${event.id}`)}>◉</button><button title="Editar evento" aria-label={`Editar ${event.name}`} onClick={() => { setEditingEvent(event); setFormOpen(true) }}>✎</button><button title="Cancelar ou excluir evento" aria-label={`Excluir ${event.name}`} onClick={() => void remove(event)}>×</button></div></td></tr>)}</Table>{events.length === 0 && <div className="empty">Nenhum evento encontrado.</div>}<Pagination page={Math.min(page, totalPages)} totalPages={totalPages} onChange={setPage} />{formOpen && <EventForm event={editingEvent} onClose={() => { setFormOpen(false); setEditingEvent(undefined) }} onCreated={(event) => { addEvent(event); setFormOpen(false) }} onUpdated={(event) => { replaceEvent(event); setFormOpen(false) }} />}</main>
}