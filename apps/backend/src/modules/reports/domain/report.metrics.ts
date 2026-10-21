import type { TaskReportRecord } from "./report.types.js";

// Business definitions of the report indicators. Kept pure so the same rule is applied to the JSON
// summary, to each row and to exported files.

const OPEN_STATUSES = new Set(["PENDENTE", "EM_ANDAMENTO"]);

const roundOneDecimal = (value: number) => Math.round(value * 10) / 10;

/** Share of completed tasks that met their deadline. Canceled tasks and tasks without a deadline are not measured. */
export function onTimePercentage(completedOnTime: number, completedLate: number): number | null {
  const measured = completedOnTime + completedLate;
  return measured === 0 ? null : roundOneDecimal((completedOnTime / measured) * 100);
}

/** Average time between task creation and team assignment, in minutes. */
export function averageMinutes(totalSeconds: number, count: number): number | null {
  return count === 0 ? null : roundOneDecimal(totalSeconds / count / 60);
}

/** A "forgotten" task: still open after its deadline. */
export function isOverdue(task: Pick<TaskReportRecord, "status" | "dueDate">, now: Date): boolean {
  return OPEN_STATUSES.has(task.status) && task.dueDate !== null && task.dueDate.getTime() < now.getTime();
}

export function isCompletedLate(task: Pick<TaskReportRecord, "status" | "dueDate" | "completedAt">): boolean {
  return task.status === "CONCLUIDA" && task.dueDate !== null && task.completedAt !== null && task.completedAt.getTime() > task.dueDate.getTime();
}

export function isCompletedOnTime(task: Pick<TaskReportRecord, "status" | "dueDate" | "completedAt">): boolean {
  return task.status === "CONCLUIDA" && task.dueDate !== null && task.completedAt !== null && task.completedAt.getTime() <= task.dueDate.getTime();
}

export function totalPages(totalItems: number, pageSize: number): number {
  return Math.ceil(totalItems / pageSize);
}
