import type { Task } from '../types/task'

const OPEN_STATUSES = ['PENDENTE', 'EM_ANDAMENTO']

/**
 * Same rule as the backend reports and dashboard (report.metrics.ts): an open task whose deadline
 * has passed. These are the "forgotten" tasks the RFC hypothesis wants to reduce.
 */
export function isTaskOverdue(task: Pick<Task, 'status' | 'dueDate'>, now: Date = new Date()): boolean {
  return OPEN_STATUSES.includes(task.status) && task.dueDate !== null && new Date(task.dueDate).getTime() < now.getTime()
}

const dueTime = (task: Pick<Task, 'dueDate'>) => (task.dueDate === null ? Number.POSITIVE_INFINITY : new Date(task.dueDate).getTime())

/**
 * Execution order of the tasks (RFC 3.1.1: "em que sequência devem ser executadas"): the rule engine sets
 * each deadline from daysBeforeEvent, so the earliest deadline comes first. Tasks without a deadline go last;
 * ties keep the creation order. Returns a new array.
 */
export function sortTasksBySchedule<T extends Pick<Task, 'dueDate' | 'createdAt'>>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => dueTime(a) - dueTime(b) || a.createdAt.localeCompare(b.createdAt))
}
