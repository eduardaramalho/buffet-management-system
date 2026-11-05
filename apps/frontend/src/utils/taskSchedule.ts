import type { Task } from '../types/task'

const OPEN_STATUSES = ['PENDENTE', 'EM_ANDAMENTO']

/**
 * Same rule as the backend reports and dashboard (report.metrics.ts): an open task whose deadline
 * has passed. These are the "forgotten" tasks the RFC hypothesis wants to reduce.
 */
export function isTaskOverdue(task: Pick<Task, 'status' | 'dueDate'>, now: Date = new Date()): boolean {
  return OPEN_STATUSES.includes(task.status) && task.dueDate !== null && new Date(task.dueDate).getTime() < now.getTime()
}
