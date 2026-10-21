export const TASK_STATUSES = ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA'] as const
export type TaskStatus = typeof TASK_STATUSES[number]

// Terminal states mirror EventStatus's convention: a task that reached CONCLUIDA/CANCELADA
// can never return to a non-terminal status.
export const TERMINAL_TASK_STATUSES: TaskStatus[] = ['CONCLUIDA', 'CANCELADA']

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
