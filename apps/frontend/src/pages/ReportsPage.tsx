import { useState } from 'react'
import { Notice } from '../components/Notice'
import { EventsReportPanel } from '../components/reports/EventsReportPanel'
import { TasksReportPanel } from '../components/reports/TasksReportPanel'
import { TeamPerformancePanel } from '../components/reports/TeamPerformancePanel'
import type { ReportKind } from '../types/report'
import { currentMonthRange, toApiPeriod, validatePeriod, type PeriodInput } from '../utils/reportPeriod'

const TABS: Array<{ kind: ReportKind; label: string }> = [
  { kind: 'events', label: 'Eventos' },
  { kind: 'tasks', label: 'Tarefas' },
  { kind: 'teams-performance', label: 'Desempenho das equipes' },
]

export function ReportsPage() {
  const [tab, setTab] = useState<ReportKind>('events')
  const [periodInput, setPeriodInput] = useState<PeriodInput>(() => currentMonthRange())
  const periodError = validatePeriod(periodInput)
  // Invalid periods never reach the API: panels receive null and keep showing the last valid result.
  const period = periodError ? null : toApiPeriod(periodInput)

  return <main className="app-shell reports-page">
    <header><div><span className="eyebrow">ANÁLISE GERENCIAL</span><h1>Relatórios</h1></div></header>
    <div className="report-tabs" role="tablist" aria-label="Tipo de relatório">
      {TABS.map(({ kind, label }) => <button key={kind} type="button" role="tab" id={`report-tab-${kind}`} aria-selected={tab === kind} aria-controls="report-panel" className={tab === kind ? 'active' : ''} onClick={() => setTab(kind)}>{label}</button>)}
    </div>
    <section className="content-head report-period" aria-label="Período">
      <label>Data inicial<input type="date" value={periodInput.from} onChange={(event) => setPeriodInput((current) => ({ ...current, from: event.target.value }))} /></label>
      <label>Data final<input type="date" value={periodInput.to} onChange={(event) => setPeriodInput((current) => ({ ...current, to: event.target.value }))} /></label>
      <small className="muted">O período considera a data dos eventos.</small>
    </section>
    {periodError && <Notice message={periodError} error />}
    <section id="report-panel" role="tabpanel" aria-labelledby={`report-tab-${tab}`}>
      {tab === 'events' && <EventsReportPanel period={period} />}
      {tab === 'tasks' && <TasksReportPanel period={period} />}
      {tab === 'teams-performance' && <TeamPerformancePanel period={period} />}
    </section>
  </main>
}
