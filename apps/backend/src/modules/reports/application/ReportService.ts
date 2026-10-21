import { eventStatuses, eventTypes } from "../../events/domain/event.types.js";
import { taskStatuses } from "../../tasks/domain/task.types.js";
import { averageMinutes, isCompletedLate, isOverdue, onTimePercentage, totalPages } from "../domain/report.metrics.js";
import type {
  EventReportAggregates,
  EventReportFilter,
  EventsReport,
  ExportFile,
  ExportFormat,
  PageRequest,
  ReportAuditService,
  ReportDocument,
  ReportExporter,
  ReportKind,
  ReportPeriod,
  ReportRepository,
  TaskOrigin,
  TaskReportAggregates,
  TaskReportFilter,
  TaskReportRecord,
  TaskReportRow,
  TasksReport,
  TeamPerformanceAggregate,
  TeamPerformanceFilter,
  TeamPerformanceReport,
  TeamPerformanceRow,
} from "../domain/report.types.js";
import { documentHeader, eventsDocument, tasksDocument, teamPerformanceDocument } from "./reportDocuments.js";
import { formatIsoDate } from "./reportFormat.js";

export type ExportRequest =
  | { kind: "events"; filter: EventReportFilter }
  | { kind: "tasks"; filter: TaskReportFilter }
  | { kind: "teams-performance"; filter: TeamPerformanceFilter };

const fileSlugs: Record<ReportKind, string> = {
  events: "eventos",
  tasks: "tarefas",
  "teams-performance": "desempenho-equipes",
};

function countBy<K extends string>(keys: readonly K[], entries: Array<{ key: K; count: number }>): Record<K, number> {
  const result = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  for (const entry of entries) result[entry.key] += entry.count;
  return result;
}

const sum = <T>(items: T[], pick: (item: T) => number) => items.reduce((total, item) => total + pick(item), 0);

/**
 * Read-only reports required by the RFC (section 4): events held, tasks executed and team operational
 * performance, plus the hypothesis indicators (forgotten tasks and assignment response time).
 * The repository returns raw aggregates; every business definition is applied here.
 */
export class ReportService {
  constructor(
    private readonly repository: ReportRepository,
    private readonly exporters: Record<ExportFormat, ReportExporter>,
    private readonly audit: ReportAuditService,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async eventsReport(filter: EventReportFilter, page: PageRequest): Promise<EventsReport> {
    const summary = this.eventsSummary(await this.repository.eventAggregates(filter));
    const items = summary.total === 0 ? [] : await this.repository.eventRows(filter, page);
    return { period: periodOf(filter), summary, items, pagination: { ...page, totalItems: summary.total, totalPages: totalPages(summary.total, page.pageSize) } };
  }

  async tasksReport(filter: TaskReportFilter, page: PageRequest): Promise<TasksReport> {
    const now = this.clock();
    const summary = this.tasksSummary(await this.repository.taskAggregates(filter, now));
    const records = summary.total === 0 ? [] : await this.repository.taskRows(filter, page);
    return {
      period: periodOf(filter),
      summary,
      items: records.map((record) => this.toTaskRow(record, now)),
      pagination: { ...page, totalItems: summary.total, totalPages: totalPages(summary.total, page.pageSize) },
    };
  }

  async teamPerformanceReport(filter: TeamPerformanceFilter): Promise<TeamPerformanceReport> {
    const aggregates = await this.repository.teamPerformance(filter, this.clock());
    return { period: periodOf(filter), summary: this.teamsSummary(aggregates), items: aggregates.map(toTeamRow) };
  }

  /** Exports the whole period (no pagination) and records who exported which data (LGPD traceability). */
  async exportReport(request: ExportRequest, format: ExportFormat, actorId: string): Promise<ExportFile> {
    const generatedAt = this.clock();
    const document = await this.buildDocument(request, generatedAt);
    const exporter = this.exporters[format];
    const content = await exporter.render(document);

    await this.audit.record({
      userId: actorId,
      action: "REPORT_EXPORTED",
      entity: "Report",
      changes: { kind: request.kind, format, rows: document.rows.length, filter: request.filter },
    });

    const { from, to } = request.filter;
    return {
      filename: `relatorio-${fileSlugs[request.kind]}_${formatIsoDate(from)}_${formatIsoDate(to)}.${exporter.extension}`,
      contentType: exporter.contentType,
      content,
    };
  }

  private async buildDocument(request: ExportRequest, generatedAt: Date): Promise<ReportDocument> {
    const header = documentHeader(periodOf(request.filter), generatedAt);
    if (request.kind === "events") {
      const [aggregates, rows] = await Promise.all([this.repository.eventAggregates(request.filter), this.repository.eventRows(request.filter)]);
      return eventsDocument(this.eventsSummary(aggregates), rows, header);
    }
    if (request.kind === "tasks") {
      const [aggregates, records] = await Promise.all([this.repository.taskAggregates(request.filter, generatedAt), this.repository.taskRows(request.filter)]);
      return tasksDocument(this.tasksSummary(aggregates), records.map((record) => this.toTaskRow(record, generatedAt)), header);
    }
    return teamPerformanceDocument(await this.teamPerformanceReport(request.filter), header);
  }

  private eventsSummary(aggregates: EventReportAggregates): EventsReport["summary"] {
    const byStatus = countBy(eventStatuses, aggregates.byStatus.map(({ status, count }) => ({ key: status, count })));
    const byServiceType = countBy(eventTypes, aggregates.byServiceType.map(({ serviceType, count }) => ({ key: serviceType, count })));
    return { total: sum(aggregates.byStatus, (entry) => entry.count), byStatus, byServiceType };
  }

  private tasksSummary(aggregates: TaskReportAggregates): TasksReport["summary"] {
    const byStatus = countBy(taskStatuses, aggregates.byStatus.map(({ status, count }) => ({ key: status, count })));
    const total = sum(aggregates.byStatus, (entry) => entry.count);
    return {
      total,
      byStatus,
      byOrigin: { REGRA: total - aggregates.manualCount, MANUAL: aggregates.manualCount },
      overdueOpen: aggregates.overdueOpen,
      completedOnTime: aggregates.completedOnTime,
      completedLate: aggregates.completedLate,
      canceled: byStatus.CANCELADA,
      onTimePercentage: onTimePercentage(aggregates.completedOnTime, aggregates.completedLate),
    };
  }

  private teamsSummary(aggregates: TeamPerformanceAggregate[]): TeamPerformanceReport["summary"] {
    const completedOnTime = sum(aggregates, (team) => team.completedOnTime);
    const completedLate = sum(aggregates, (team) => team.completedLate);
    return {
      teams: aggregates.length,
      tasks: sum(aggregates, (team) => team.total),
      completedOnTime,
      completedLate,
      overdueOpen: sum(aggregates, (team) => team.overdueOpen),
      canceled: sum(aggregates, (team) => team.canceled),
      onTimePercentage: onTimePercentage(completedOnTime, completedLate),
      // Weighted by the number of assigned tasks: summing seconds and counts avoids averaging averages.
      avgAssignmentMinutes: {
        REGRA: averageMinutes(sum(aggregates, (team) => team.ruleAssignmentSeconds), sum(aggregates, (team) => team.ruleAssignedCount)),
        MANUAL: averageMinutes(sum(aggregates, (team) => team.manualAssignmentSeconds), sum(aggregates, (team) => team.manualAssignedCount)),
      },
    };
  }

  private toTaskRow({ sourceRuleId, ...record }: TaskReportRecord, now: Date): TaskReportRow {
    const origin: TaskOrigin = sourceRuleId === null ? "MANUAL" : "REGRA";
    return { ...record, origin, overdue: isOverdue(record, now), completedLate: isCompletedLate(record) };
  }
}

function periodOf(filter: ReportPeriod): ReportPeriod {
  return { from: filter.from, to: filter.to };
}

function toTeamRow(team: TeamPerformanceAggregate): TeamPerformanceRow {
  return {
    teamId: team.teamId,
    teamName: team.teamName,
    specialty: team.specialty,
    total: team.total,
    completed: team.completed,
    completedOnTime: team.completedOnTime,
    completedLate: team.completedLate,
    overdueOpen: team.overdueOpen,
    canceled: team.canceled,
    onTimePercentage: onTimePercentage(team.completedOnTime, team.completedLate),
    avgAssignmentMinutes: {
      REGRA: averageMinutes(team.ruleAssignmentSeconds, team.ruleAssignedCount),
      MANUAL: averageMinutes(team.manualAssignmentSeconds, team.manualAssignedCount),
    },
  };
}
