import { Prisma, type PrismaClient } from "../../../../generated/client.js";
import type { EventStatus, EventType } from "../../../events/domain/event.types.js";
import type { TaskStatus } from "../../../tasks/domain/task.types.js";
import type { TeamSpecialty } from "../../../teams/domain/team.types.js";
import type {
  EventReportAggregates,
  EventReportFilter,
  EventReportRow,
  PageRequest,
  ReportPeriod,
  ReportRepository,
  TaskReportAggregates,
  TaskReportFilter,
  TaskReportRecord,
  TeamPerformanceAggregate,
  TeamPerformanceFilter,
} from "../../domain/report.types.js";

const OPEN_TASK_STATUSES: TaskStatus[] = ["PENDENTE", "EM_ANDAMENTO"];

type TeamPerformanceSqlRow = Record<keyof TeamPerformanceAggregate, unknown>;

// MySQL returns COUNT as BIGINT and SUM as DECIMAL; depending on the driver they arrive as bigint,
// string or Decimal objects. Report numbers are small, so converting to number is safe.
const toNumber = (value: unknown) => (value === null || value === undefined ? 0 : Number(String(value)));

const pageArgs = (page?: PageRequest): { skip?: number; take?: number } =>
  (page ? { skip: (page.page - 1) * page.pageSize, take: page.pageSize } : {});

function eventPeriodWhere(period: ReportPeriod) {
  return { deletedAt: null, eventDate: { gte: period.from, lte: period.to } };
}

function eventWhere(filter: EventReportFilter) {
  return {
    ...eventPeriodWhere(filter),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.serviceType ? { serviceType: filter.serviceType } : {}),
    ...(filter.clientId ? { clientId: filter.clientId } : {}),
  };
}

// Tasks are cut by the date of their event (not by their own due date), so the task report covers the
// same events as the events report for the same period.
function taskWhere(filter: TaskReportFilter) {
  return {
    deletedAt: null,
    event: eventPeriodWhere(filter),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.teamId ? { assignedTeamId: filter.teamId } : {}),
    ...(filter.origin === "REGRA" ? { sourceRuleId: { not: null } } : {}),
    ...(filter.origin === "MANUAL" ? { sourceRuleId: null } : {}),
  };
}

/**
 * Read-only aggregate queries for the reports module. Every method issues a fixed number of queries,
 * independent of the number of rows (no N+1). Raw SQL is used only where Prisma cannot express the
 * aggregation (conditional sums and averages of date differences per team).
 */
export class PrismaReportRepository implements ReportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async eventAggregates(filter: EventReportFilter): Promise<EventReportAggregates> {
    const where = eventWhere(filter);
    const [byStatus, byServiceType] = await Promise.all([
      this.prisma.event.groupBy({ by: ["status"], where, _count: { _all: true } }),
      this.prisma.event.groupBy({ by: ["serviceType"], where, _count: { _all: true } }),
    ]);
    return {
      byStatus: byStatus.map((entry) => ({ status: entry.status as EventStatus, count: entry._count._all })),
      byServiceType: byServiceType.map((entry) => ({ serviceType: entry.serviceType as EventType, count: entry._count._all })),
    };
  }

  async eventRows(filter: EventReportFilter, page?: PageRequest): Promise<EventReportRow[]> {
    const events = await this.prisma.event.findMany({
      where: eventWhere(filter),
      orderBy: [{ eventDate: "asc" }, { id: "asc" }],
      ...pageArgs(page),
      select: { id: true, name: true, eventDate: true, status: true, serviceType: true, guestsCount: true, client: { select: { name: true } } },
    });
    if (events.length === 0) return [];

    const taskCounts = await this.prisma.task.groupBy({
      by: ["eventId", "status"],
      where: { deletedAt: null, eventId: { in: events.map((event) => event.id) } },
      _count: { _all: true },
    });
    const totals = new Map<string, { total: number; completed: number }>();
    for (const entry of taskCounts) {
      const current = totals.get(entry.eventId) ?? { total: 0, completed: 0 };
      current.total += entry._count._all;
      if (entry.status === "CONCLUIDA") current.completed += entry._count._all;
      totals.set(entry.eventId, current);
    }

    return events.map(({ client, ...event }) => ({
      id: event.id,
      name: event.name,
      eventDate: event.eventDate,
      status: event.status as EventStatus,
      serviceType: event.serviceType as EventType,
      guestsCount: event.guestsCount,
      clientName: client?.name ?? null,
      tasksTotal: totals.get(event.id)?.total ?? 0,
      tasksCompleted: totals.get(event.id)?.completed ?? 0,
    }));
  }

  async taskAggregates(filter: TaskReportFilter, now: Date): Promise<TaskReportAggregates> {
    const where = taskWhere(filter);
    // AND keeps the user filter intact even when it also constrains the same field (e.g. status).
    const countWith = (extra: Record<string, unknown>) => this.prisma.task.count({ where: { AND: [where, extra] } });
    const dueDate = this.prisma.task.fields.dueDate;

    const [byStatus, manualCount, overdueOpen, completedOnTime, completedLate] = await Promise.all([
      this.prisma.task.groupBy({ by: ["status"], where, _count: { _all: true } }),
      countWith({ sourceRuleId: null }),
      countWith({ status: { in: OPEN_TASK_STATUSES }, dueDate: { lt: now } }),
      // Field reference: completed_at <= due_date is evaluated by MySQL; NULL due dates never match.
      countWith({ status: "CONCLUIDA", completedAt: { lte: dueDate } }),
      countWith({ status: "CONCLUIDA", completedAt: { gt: dueDate } }),
    ]);

    return {
      byStatus: byStatus.map((entry) => ({ status: entry.status as TaskStatus, count: entry._count._all })),
      manualCount,
      overdueOpen,
      completedOnTime,
      completedLate,
    };
  }

  async taskRows(filter: TaskReportFilter, page?: PageRequest): Promise<TaskReportRecord[]> {
    const tasks = await this.prisma.task.findMany({
      where: taskWhere(filter),
      orderBy: [{ event: { eventDate: "asc" } }, { dueDate: "asc" }, { id: "asc" }],
      ...pageArgs(page),
      select: {
        id: true, title: true, status: true, dueDate: true, completedAt: true, createdAt: true, assignedAt: true, sourceRuleId: true,
        event: { select: { id: true, name: true, eventDate: true } },
        assignedTeam: { select: { name: true } },
      },
    });

    return tasks.map(({ event, assignedTeam, ...task }) => ({
      ...task,
      status: task.status as TaskStatus,
      eventId: event.id,
      eventName: event.name,
      eventDate: event.eventDate,
      teamName: assignedTeam?.name ?? null,
    }));
  }

  async teamPerformance(filter: TeamPerformanceFilter, now: Date): Promise<TeamPerformanceAggregate[]> {
    // Historical report: soft-deleted or inactive teams still appear if they had tasks in the period.
    // Tasks without a team (alert-only) are not part of team performance.
    const rows = await this.prisma.$queryRaw<TeamPerformanceSqlRow[]>(Prisma.sql`
      SELECT
        t.assigned_team_id AS teamId,
        tm.name AS teamName,
        tm.specialty AS specialty,
        COUNT(*) AS total,
        SUM(t.status = 'CONCLUIDA') AS completed,
        SUM(t.status = 'CONCLUIDA' AND t.completed_at <= t.due_date) AS completedOnTime,
        SUM(t.status = 'CONCLUIDA' AND t.completed_at > t.due_date) AS completedLate,
        SUM(t.status IN ('PENDENTE', 'EM_ANDAMENTO') AND t.due_date < ${now}) AS overdueOpen,
        SUM(t.status = 'CANCELADA') AS canceled,
        SUM(t.assigned_at IS NOT NULL AND t.source_rule_id IS NOT NULL) AS ruleAssignedCount,
        SUM(CASE WHEN t.assigned_at IS NOT NULL AND t.source_rule_id IS NOT NULL
          THEN TIMESTAMPDIFF(SECOND, t.created_at, t.assigned_at) ELSE 0 END) AS ruleAssignmentSeconds,
        SUM(t.assigned_at IS NOT NULL AND t.source_rule_id IS NULL) AS manualAssignedCount,
        SUM(CASE WHEN t.assigned_at IS NOT NULL AND t.source_rule_id IS NULL
          THEN TIMESTAMPDIFF(SECOND, t.created_at, t.assigned_at) ELSE 0 END) AS manualAssignmentSeconds
      FROM tasks t
      INNER JOIN events e ON e.id = t.event_id
      INNER JOIN teams tm ON tm.id = t.assigned_team_id
      WHERE t.deleted_at IS NULL AND e.deleted_at IS NULL
        AND e.event_date BETWEEN ${filter.from} AND ${filter.to}
      GROUP BY t.assigned_team_id, tm.name, tm.specialty
      ORDER BY tm.name ASC
    `);

    return rows.map((row) => ({
      teamId: String(row.teamId),
      teamName: String(row.teamName),
      specialty: row.specialty as TeamSpecialty,
      total: toNumber(row.total),
      completed: toNumber(row.completed),
      completedOnTime: toNumber(row.completedOnTime),
      completedLate: toNumber(row.completedLate),
      overdueOpen: toNumber(row.overdueOpen),
      canceled: toNumber(row.canceled),
      ruleAssignedCount: toNumber(row.ruleAssignedCount),
      ruleAssignmentSeconds: toNumber(row.ruleAssignmentSeconds),
      manualAssignedCount: toNumber(row.manualAssignedCount),
      manualAssignmentSeconds: toNumber(row.manualAssignmentSeconds),
    }));
  }
}
