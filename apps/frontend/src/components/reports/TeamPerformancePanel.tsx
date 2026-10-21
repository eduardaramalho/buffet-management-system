import { downloadReport, getTeamPerformanceReport } from '../../api/reportsApi'
import { useReport } from '../../hooks/useReport'
import { TEAM_SPECIALTY_LABELS } from '../../utils/labels'
import { formatMinutes, formatPercentage } from '../../utils/reportFormat'
import type { ApiPeriod } from '../../utils/reportPeriod'
import { BarChart } from '../BarChart'
import { Icon } from '../Icon'
import { StatCard } from '../StatCard'
import { Table } from '../Table'
import { ExportButtons } from './ExportButtons'
import { ReportStatus } from './ReportStatus'

export function TeamPerformancePanel({ period }: { period: ApiPeriod | null }) {
  const { data, loading, error, reload } = useReport(() => getTeamPerformanceReport(period as ApiPeriod), period ? JSON.stringify(period) : null)

  return <>
    <section className="content-head report-filters">
      <p className="muted">Tarefas atribuídas a cada equipe nos eventos do período. Tempo de atribuição: da criação da tarefa até a equipe ser definida.</p>
      <ExportButtons disabled={!period} onExport={(format) => downloadReport('teams-performance', period as ApiPeriod, {}, format)} />
    </section>
    <ReportStatus error={error} loading={loading} onRetry={reload} />
    {data && <>
      <section className="summary">
        <StatCard icon={<Icon name="users" />} value={data.summary.teams} label="Equipes com tarefas" tone="blue" />
        <StatCard icon={<Icon name="check" />} value={formatPercentage(data.summary.onTimePercentage)} label="Pontualidade geral" tone="green" />
        <StatCard icon={<Icon name="alert" />} value={data.summary.overdueOpen} label="Atrasadas em aberto (esquecidas)" tone="gold" />
        <StatCard icon={<Icon name="bolt" />} value={`${formatMinutes(data.summary.avgAssignmentMinutes.REGRA)} / ${formatMinutes(data.summary.avgAssignmentMinutes.MANUAL)}`} label="Atribuição média: regra / manual" tone="purple" />
      </section>
      <div className="report-charts">
        <BarChart title="Pontualidade por equipe" max={100} format={(value) => formatPercentage(value)} items={data.items.map((team) => ({ label: team.teamName, value: team.onTimePercentage ?? 0 }))} />
        <BarChart title="Tarefas por equipe" items={data.items.map((team) => ({ label: team.teamName, value: team.total }))} />
      </div>
      <Table headers={['Equipe', 'Especialidade', 'Tarefas', 'Concluídas', 'No prazo', 'Com atraso', 'Atrasadas em aberto', 'Canceladas', 'Pontualidade', 'Atribuição (regra)', 'Atribuição (manual)']}>{data.items.map((team) => <tr key={team.teamId}>
        <td><strong>{team.teamName}</strong></td>
        <td>{TEAM_SPECIALTY_LABELS[team.specialty]}</td>
        <td>{team.total}</td>
        <td>{team.completed}</td>
        <td>{team.completedOnTime}</td>
        <td>{team.completedLate}</td>
        <td>{team.overdueOpen}</td>
        <td>{team.canceled}</td>
        <td>{formatPercentage(team.onTimePercentage)}</td>
        <td>{formatMinutes(team.avgAssignmentMinutes.REGRA)}</td>
        <td>{formatMinutes(team.avgAssignmentMinutes.MANUAL)}</td>
      </tr>)}</Table>
      {data.items.length === 0 && <div className="empty">Nenhuma equipe com tarefas no período.</div>}
    </>}
  </>
}
