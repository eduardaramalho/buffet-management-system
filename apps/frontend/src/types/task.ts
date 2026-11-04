export const TASK_STATUSES = ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA'] as const
export type TaskStatus = typeof TASK_STATUSES[number]

// Terminal states mirror EventStatus's convention: a task that reached CONCLUIDA/CANCELADA
// can never return to a non-terminal status.
export const TERMINAL_TASK_STATUSES: TaskStatus[] = ['CONCLUIDA', 'CANCELADA']

// ADR 0014: same matrix as the backend (task.statusTransitions.ts). The task must be started before it is concluded.
export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  PENDENTE: ['EM_ANDAMENTO', 'CANCELADA'],
  EM_ANDAMENTO: ['PENDENTE', 'CONCLUIDA', 'CANCELADA'],
  CONCLUIDA: [],
  CANCELADA: [],
}

const CLOSED_EVENT_STATUSES = ['CONCLUIDO', 'CANCELADO']

/** Next statuses offered for a task. In a closed event the open tasks can only be cancelled. */
export function getTaskDestinations(status: TaskStatus, eventStatus?: string): TaskStatus[] {
  const destinations = TASK_STATUS_TRANSITIONS[status]
  return eventStatus && CLOSED_EVENT_STATUSES.includes(eventStatus) ? destinations.filter((next) => next === 'CANCELADA') : destinations
}

export type Task = {
  id: string
  eventId: string
  title: string
  description: string | null
  dueDate: string | null
  completedAt?: string | null
  status: TaskStatus
  assignedTeamId: string | null
  assignedAt?: string | null
  sourceRuleId: string | null
  // RF25: manual task of the source event this one was copied from.
  sourceTaskId?: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type TaskFilters = { eventId?: string; status?: TaskStatus }

export const TASK_TITLE_MAX_LENGTH = 150

export type CreateTaskInput = {
  eventId: string
  title: string
  description?: string
  dueDate?: string
  assignedTeamId?: string
}

// PUT parcial: chaves omitidas não são alteradas; null limpa o campo.
export type UpdateTaskInput = {
  title?: string
  description?: string | null
  dueDate?: string | null
  assignedTeamId?: string | null
}
