import type { EventStatus, EventType } from "../../events/domain/event.types.js";
import type { TaskStatus } from "../../tasks/domain/task.types.js";
import type { TeamSpecialty } from "../../teams/domain/team.types.js";

// Every report is cut by the event date (eventDate), including task and team reports, so the three
// reports describe the same set of events for a given period.
export type ReportPeriod = { from: Date; to: Date };
export type PageRequest = { page: number; pageSize: number };

export const taskOrigins = ["REGRA", "MANUAL"] as const;
export type TaskOrigin = (typeof taskOrigins)[number];

export const reportKinds = ["events", "tasks", "teams-performance"] as const;
export type ReportKind = (typeof reportKinds)[number];

export const exportFormats = ["csv", "pdf"] as const;
export type ExportFormat = (typeof exportFormats)[number];

export type EventReportFilter = ReportPeriod & { status?: EventStatus; serviceType?: EventType; clientId?: string };
export type TaskReportFilter = ReportPeriod & { status?: TaskStatus; teamId?: string; origin?: TaskOrigin };
export type TeamPerformanceFilter = ReportPeriod;

// ---- Repository output (raw aggregates, no business definitions applied) ----

export type EventReportAggregates = {
  byStatus: Array<{ status: EventStatus; count: number }>;
  byServiceType: Array<{ serviceType: EventType; count: number }>;
};

export type EventReportRow = {
  id: string;
  name: string;
  eventDate: Date;
  status: EventStatus;
  serviceType: EventType;
  guestsCount: number;
  clientName: string | null;
  tasksTotal: number;
  tasksCompleted: number;
};

export type TaskReportAggregates = {
  byStatus: Array<{ status: TaskStatus; count: number }>;
  manualCount: number;
  overdueOpen: number;
  completedOnTime: number;
  completedLate: number;
};

export type TaskReportRecord = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  assignedAt: Date | null;
  sourceRuleId: string | null;
  eventId: string;
  eventName: string;
  eventDate: Date;
  teamName: string | null;
};

export type TeamPerformanceAggregate = {
  teamId: string;
  teamName: string;
  specialty: TeamSpecialty;
  total: number;
  completed: number;
  completedOnTime: number;
  completedLate: number;
  overdueOpen: number;
  canceled: number;
  ruleAssignedCount: number;
  ruleAssignmentSeconds: number;
  manualAssignedCount: number;
  manualAssignmentSeconds: number;
};

export interface ReportRepository {
  eventAggregates(filter: EventReportFilter): Promise<EventReportAggregates>;
  // Without a page, returns every row in the period (used by exports; the period itself is capped).
  eventRows(filter: EventReportFilter, page?: PageRequest): Promise<EventReportRow[]>;
  taskAggregates(filter: TaskReportFilter, now: Date): Promise<TaskReportAggregates>;
  taskRows(filter: TaskReportFilter, page?: PageRequest): Promise<TaskReportRecord[]>;
  teamPerformance(filter: TeamPerformanceFilter, now: Date): Promise<TeamPerformanceAggregate[]>;
}

// ---- Report DTOs returned by the API ----

export type Pagination = { page: number; pageSize: number; totalItems: number; totalPages: number };

export type EventsReport = {
  period: ReportPeriod;
  summary: { total: number; byStatus: Record<EventStatus, number>; byServiceType: Record<EventType, number> };
  items: EventReportRow[];
  pagination: Pagination;
};

export type TaskReportRow = Omit<TaskReportRecord, "sourceRuleId"> & {
  origin: TaskOrigin;
  // Open (PENDENTE/EM_ANDAMENTO) with a due date already in the past: a "forgotten" task.
  overdue: boolean;
  completedLate: boolean;
};

export type TasksReport = {
  period: ReportPeriod;
  summary: {
    total: number;
    byStatus: Record<TaskStatus, number>;
    byOrigin: Record<TaskOrigin, number>;
    overdueOpen: number;
    completedOnTime: number;
    completedLate: number;
    canceled: number;
    // completedOnTime / (completedOnTime + completedLate); null when there is nothing to measure.
    onTimePercentage: number | null;
  };
  items: TaskReportRow[];
  pagination: Pagination;
};

export type TeamPerformanceRow = {
  teamId: string;
  teamName: string;
  specialty: TeamSpecialty;
  total: number;
  completed: number;
  completedOnTime: number;
  completedLate: number;
  overdueOpen: number;
  canceled: number;
  onTimePercentage: number | null;
  avgAssignmentMinutes: Record<TaskOrigin, number | null>;
};

export type TeamPerformanceReport = {
  period: ReportPeriod;
  summary: {
    teams: number;
    tasks: number;
    completedOnTime: number;
    completedLate: number;
    overdueOpen: number;
    canceled: number;
    onTimePercentage: number | null;
    avgAssignmentMinutes: Record<TaskOrigin, number | null>;
  };
  items: TeamPerformanceRow[];
};

// ---- Export ----

export type ReportCell = string | number | null;

/** Format-agnostic representation of an exported report; each exporter renders it to its own format. */
export type ReportDocument = {
  title: string;
  periodLabel: string;
  generatedAtLabel: string;
  summary: Array<{ label: string; value: ReportCell }>;
  columns: string[];
  rows: ReportCell[][];
};

export interface ReportExporter {
  readonly contentType: string;
  readonly extension: string;
  render(document: ReportDocument): Promise<Buffer>;
}

export type ExportFile = { filename: string; contentType: string; content: Buffer };

export interface ReportAuditService {
  record(input: { userId?: string; action: string; entity: string; entityId?: string; changes?: Record<string, unknown> }): Promise<void>;
}
