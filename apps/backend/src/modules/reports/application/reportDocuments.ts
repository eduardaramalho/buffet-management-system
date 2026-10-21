import { eventStatuses, eventTypes } from "../../events/domain/event.types.js";
import { taskStatuses } from "../../tasks/domain/task.types.js";
import { isCompletedOnTime } from "../domain/report.metrics.js";
import { eventStatusLabels, eventTypeLabels, taskOriginLabels, taskStatusLabels, teamSpecialtyLabels } from "../domain/report.labels.js";
import type {
  EventReportRow,
  EventsReport,
  ReportDocument,
  ReportPeriod,
  TaskReportRow,
  TasksReport,
  TeamPerformanceReport,
} from "../domain/report.types.js";
import { formatDate, formatDateTime, formatMinutes, formatOptionalDateTime, formatPercentage } from "./reportFormat.js";

// Builds the format-agnostic ReportDocument from report DTOs: labels, local dates and column order live
// here, so CSV and PDF exporters only care about their own file format.

type Header = Pick<ReportDocument, "periodLabel" | "generatedAtLabel">;

export function documentHeader(period: ReportPeriod, generatedAt: Date): Header {
  return {
    periodLabel: `${formatDate(period.from)} a ${formatDate(period.to)}`,
    generatedAtLabel: formatDateTime(generatedAt),
  };
}

export function eventsDocument(summary: EventsReport["summary"], items: EventReportRow[], header: Header): ReportDocument {
  return {
    title: "Relatório de eventos",
    ...header,
    summary: [
      { label: "Total de eventos", value: summary.total },
      ...eventStatuses.map((status) => ({ label: eventStatusLabels[status], value: summary.byStatus[status] })),
      ...eventTypes.map((type) => ({ label: `Tipo: ${eventTypeLabels[type]}`, value: summary.byServiceType[type] })),
    ],
    columns: ["Data", "Evento", "Cliente", "Tipo", "Status", "Convidados", "Tarefas", "Concluídas"],
    rows: items.map((item) => [
      formatDateTime(item.eventDate),
      item.name,
      item.clientName,
      eventTypeLabels[item.serviceType],
      eventStatusLabels[item.status],
      item.guestsCount,
      item.tasksTotal,
      item.tasksCompleted,
    ]),
  };
}

function taskSituation(item: TaskReportRow): string | null {
  if (item.overdue) return "Atrasada";
  if (item.completedLate) return "Concluída com atraso";
  if (isCompletedOnTime(item)) return "No prazo";
  return null;
}

export function tasksDocument(summary: TasksReport["summary"], items: TaskReportRow[], header: Header): ReportDocument {
  return {
    title: "Relatório de tarefas",
    ...header,
    summary: [
      { label: "Total de tarefas", value: summary.total },
      ...taskStatuses.map((status) => ({ label: taskStatusLabels[status], value: summary.byStatus[status] })),
      { label: "Origem: regra", value: summary.byOrigin.REGRA },
      { label: "Origem: manual", value: summary.byOrigin.MANUAL },
      { label: "Atrasadas em aberto (esquecidas)", value: summary.overdueOpen },
      { label: "Concluídas no prazo", value: summary.completedOnTime },
      { label: "Concluídas com atraso", value: summary.completedLate },
      { label: "Pontualidade", value: formatPercentage(summary.onTimePercentage) },
    ],
    columns: ["Evento", "Data do evento", "Tarefa", "Origem", "Equipe", "Status", "Prazo", "Concluída em", "Situação"],
    rows: items.map((item) => [
      item.eventName,
      formatDateTime(item.eventDate),
      item.title,
      taskOriginLabels[item.origin],
      item.teamName,
      taskStatusLabels[item.status],
      formatOptionalDateTime(item.dueDate),
      formatOptionalDateTime(item.completedAt),
      taskSituation(item),
    ]),
  };
}

export function teamPerformanceDocument(report: TeamPerformanceReport, header: Header): ReportDocument {
  const { summary } = report;
  return {
    title: "Relatório de desempenho das equipes",
    ...header,
    summary: [
      { label: "Equipes", value: summary.teams },
      { label: "Tarefas atribuídas", value: summary.tasks },
      { label: "Concluídas no prazo", value: summary.completedOnTime },
      { label: "Concluídas com atraso", value: summary.completedLate },
      { label: "Atrasadas em aberto (esquecidas)", value: summary.overdueOpen },
      { label: "Canceladas", value: summary.canceled },
      { label: "Pontualidade geral", value: formatPercentage(summary.onTimePercentage) },
      { label: "Atribuição média (regra)", value: formatMinutes(summary.avgAssignmentMinutes.REGRA) },
      { label: "Atribuição média (manual)", value: formatMinutes(summary.avgAssignmentMinutes.MANUAL) },
    ],
    columns: [
      "Equipe", "Especialidade", "Tarefas", "Concluídas", "No prazo", "Com atraso", "Atrasadas em aberto", "Canceladas", "Pontualidade", "Atribuição média (regra)", "Atribuição média (manual)",
    ],
    rows: report.items.map((item) => [
      item.teamName,
      teamSpecialtyLabels[item.specialty],
      item.total,
      item.completed,
      item.completedOnTime,
      item.completedLate,
      item.overdueOpen,
      item.canceled,
      formatPercentage(item.onTimePercentage),
      formatMinutes(item.avgAssignmentMinutes.REGRA),
      formatMinutes(item.avgAssignmentMinutes.MANUAL),
    ]),
  };
}
