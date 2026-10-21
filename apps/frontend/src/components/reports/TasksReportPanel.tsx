import { useState } from 'react'
import { downloadReport, getTasksReport } from '../../api/reportsApi'
import { listTeams } from '../../api/teamsApi'
import { useOptions } from '../../hooks/useOptions'
import { useReport } from '../../hooks/useReport'
import { TASK_STATUSES, type TaskStatus } from '../../types/task'
import { TASK_ORIGINS, TASK_ORIGIN_LABELS, type TaskOrigin, type TaskReportRow } from '../../types/report'
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from '../../utils/labels'
import { formatDateTime, formatPercentage } from '../../utils/reportFormat'
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

type Filters = { status: TaskStatus | ''; teamId: string; origin: TaskOrigin | '' }
const EMPTY_FILTERS: Filters = { status: '', teamId: '', origin: '' }

function Situation({ task }: { task: TaskReportRow }) {
  if (task.overdue) return <Badge tone="inactive">Atrasada</Badge>
  if (task.completedLate) return <Badge tone="editor">Concluída com atraso</Badge>
  if (task.status === 'CONCLUIDA' && task.dueDate) return <Badge tone="active">No prazo</Badge>
  return <>-</>
}

export function TasksReportPanel({ period }: { period: ApiPeriod | null }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const teams = useOptions(() => listTeams())
  const query = { period, filters, page }
  const { data, loading, error, reload } = useReport(
    () => getTasksReport(period as ApiPeriod, filters, { page, pageSize: REPORT_PAGE_SIZE }),
    period ? JSON.stringify(query) : null,
  )
  const changeFilter = (patch: Partial<Filters>) => { setFilters((current) => ({ ...current, ...patch })); setPage(1) }

  return <>
    <section className="content-head report-filters">
      <label>Status da tarefa<select value={filters.status} onChange={(event) => changeFilter({ status: event.target.value as Filters['status'] })}>
        <option value="">Todos</option>{TASK_STATUSES.map((status) => <option key={status} value={status}>{TASK_STATUS_LABELS[status]}</option>)}
      </select></label>
      <label>Origem<select value={filters.origin} onChange={(event) => changeFilter({ origin: event.target.value as Filters['origin'] })}>
        <option value="">Todas</option>{TASK_ORIGINS.map((origin) => <option key={origin} value={origin}>{TASK_ORIGIN_LABELS[origin]}</option>)}
      </select></label>
      {teams && <label>Equipe<select value={filters.teamId} onChange={(event) => changeFilter({ teamId: event.target.value })}>
        <option value="">Todas</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
      </select></label>}
      <ExportButtons disabled={!period} onExport={(format) => downloadReport('tasks', period as ApiPeriod, filters, format)} />
    </section>
    <ReportStatus error={error} loading={loading} onRetry={reload} />
    {data && <>
      <section className="summary">
        <StatCard icon={<Icon name="tasks" />} value={data.summary.total} label="Total de tarefas" tone="blue" />
        <StatCard icon={<Icon name="alert" />} value={data.summary.overdueOpen} label="Atrasadas em aberto (esquecidas)" tone="gold" />
        <StatCard icon={<Icon name="check" />} value={formatPercentage(data.summary.onTimePercentage)} label="Pontualidade" tone="green" />
        <StatCard icon={<Icon name="bolt" />} value={`${data.summary.byOrigin.REGRA} / ${data.summary.byOrigin.MANUAL}`} label="Origem: regra / manual" tone="purple" />
      </section>
      <div className="report-charts">
        <BarChart title="Tarefas por status" items={TASK_STATUSES.map((status) => ({ label: TASK_STATUS_LABELS[status], value: data.summary.byStatus[status], color: TASK_STATUS_COLORS[status] }))} />
        <BarChart title="Prazos das tarefas concluídas" items={[
          { label: 'No prazo', value: data.summary.completedOnTime, color: TASK_STATUS_COLORS.CONCLUIDA },
          { label: 'Com atraso', value: data.summary.completedLate, color: TASK_STATUS_COLORS.CANCELADA },
        ]} />
      </div>
      <Table headers={['Evento', 'Tarefa', 'Origem', 'Equipe', 'Status', 'Prazo', 'Concluída em', 'Situação']}>{data.items.map((item) => <tr key={item.id}>
        <td><strong>{item.eventName}</strong><small className="muted">{formatDateTime(item.eventDate)}</small></td>
        <td>{item.title}</td>
        <td>{TASK_ORIGIN_LABELS[item.origin]}</td>
        <td>{item.teamName ?? '-'}</td>
        <td>{TASK_STATUS_LABELS[item.status]}</td>
        <td>{formatDateTime(item.dueDate)}</td>
        <td>{formatDateTime(item.completedAt)}</td>
        <td><Situation task={item} /></td>
      </tr>)}</Table>
      {data.items.length === 0 && <div className="empty">Nenhuma tarefa no período.</div>}
      <Pagination page={page} totalPages={data.pagination.totalPages} onChange={setPage} />
    </>}
  </>
}
