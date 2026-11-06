import { useState } from 'react'
import { downloadReport, getEventsReport } from '../../api/reportsApi'
import { listClients } from '../../api/clientsApi'
import { useOptions } from '../../hooks/useOptions'
import { useReport } from '../../hooks/useReport'
import { EVENT_STATUSES, EVENT_TYPES, type EventStatus, type EventType } from '../../types/event'
import { EVENT_STATUS_COLORS, EVENT_STATUS_LABELS, EVENT_TYPE_LABELS } from '../../utils/labels'
import { formatDateTime } from '../../utils/reportFormat'
import type { ApiPeriod } from '../../utils/reportPeriod'
import { Badge } from '../Badge'
import { BarChart } from '../BarChart'
import { Icon } from '../Icon'
import { Pagination } from '../Pagination'
import { StatCard } from '../StatCard'
import { Table } from '../Table'
import { ExportButtons } from './ExportButtons'
import { ReportStatus } from './ReportStatus'
import { REPORT_PAGE_SIZE } from './reportConstants'

type Filters = { status: EventStatus | ''; serviceType: EventType | ''; clientId: string }
const EMPTY_FILTERS: Filters = { status: '', serviceType: '', clientId: '' }

export function EventsReportPanel({ period }: { period: ApiPeriod | null }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const clients = useOptions(() => listClients())
  const query = { period, filters, page }
  const { data, loading, error, reload } = useReport(
    () => getEventsReport(period as ApiPeriod, filters, { page, pageSize: REPORT_PAGE_SIZE }),
    period ? JSON.stringify(query) : null,
  )
  const changeFilter = (patch: Partial<Filters>) => { setFilters((current) => ({ ...current, ...patch })); setPage(1) }

  return <>
    <section className="content-head report-filters">
      <label>Status do evento<select value={filters.status} onChange={(event) => changeFilter({ status: event.target.value as Filters['status'] })}>
        <option value="">Todos</option>{EVENT_STATUSES.map((status) => <option key={status} value={status}>{EVENT_STATUS_LABELS[status]}</option>)}
      </select></label>
      <label>Tipo de evento<select value={filters.serviceType} onChange={(event) => changeFilter({ serviceType: event.target.value as Filters['serviceType'] })}>
        <option value="">Todos</option>{EVENT_TYPES.map((type) => <option key={type} value={type}>{EVENT_TYPE_LABELS[type]}</option>)}
      </select></label>
      {clients && <label>Cliente<select value={filters.clientId} onChange={(event) => changeFilter({ clientId: event.target.value })}>
        <option value="">Todos</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
      </select></label>}
      <ExportButtons disabled={!period} onExport={(format) => downloadReport('events', period as ApiPeriod, filters, format)} />
    </section>
    <ReportStatus error={error} loading={loading} onRetry={reload} />
    {data && <>
      <section className="summary">
        <StatCard icon={<Icon name="calendar" />} value={data.summary.total} label="Total de eventos" tone="blue" />
        <StatCard icon={<Icon name="check" />} value={data.summary.byStatus.CONCLUIDO} label="Concluídos" tone="green" />
        <StatCard icon={<Icon name="tasks" />} value={data.summary.byStatus.CONFIRMADO + data.summary.byStatus.EM_ANDAMENTO} label="Confirmados ou em andamento" tone="gold" />
        <StatCard icon={<Icon name="x" />} value={data.summary.byStatus.CANCELADO} label="Cancelados" tone="purple" />
      </section>
      <div className="report-charts">
        <BarChart title="Eventos por status" items={EVENT_STATUSES.map((status) => ({ label: EVENT_STATUS_LABELS[status], value: data.summary.byStatus[status], color: EVENT_STATUS_COLORS[status] }))} />
        <BarChart title="Eventos por tipo" items={EVENT_TYPES.map((type) => ({ label: EVENT_TYPE_LABELS[type], value: data.summary.byServiceType[type] }))} />
      </div>
      <Table headers={['Data', 'Evento', 'Cliente', 'Tipo', 'Status', 'Convidados', 'Tarefas concluídas']}>{data.items.map((item) => <tr key={item.id}>
        <td>{formatDateTime(item.eventDate)}</td>
        <td><strong>{item.name}</strong></td>
        <td>{item.clientName ?? '-'}</td>
        <td>{EVENT_TYPE_LABELS[item.serviceType]}</td>
        <td><Badge tone={item.status === 'CANCELADO' ? 'inactive' : 'active'}>{EVENT_STATUS_LABELS[item.status]}</Badge></td>
        <td>{item.guestsCount}</td>
        <td>{`${item.tasksCompleted}/${item.tasksTotal}`}</td>
      </tr>)}</Table>
      {data.items.length === 0 && <div className="empty">Nenhum evento no período.</div>}
      <Pagination page={page} totalPages={data.pagination.totalPages} onChange={setPage} />
    </>}
  </>
}
