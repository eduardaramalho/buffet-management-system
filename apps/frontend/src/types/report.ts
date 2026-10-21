import type { EventStatus, EventType } from './event'
import type { TaskStatus } from './task'
import type { TeamSpecialty } from './team'

export const TASK_ORIGINS = ['REGRA', 'MANUAL'] as const
export type TaskOrigin = (typeof TASK_ORIGINS)[number]
export const TASK_ORIGIN_LABELS: Record<TaskOrigin, string> = { REGRA: 'Regra', MANUAL: 'Manual' }

export type ReportKind = 'events' | 'tasks' | 'teams-performance'
export type ExportFormat = 'csv' | 'pdf'

type ApiPeriod = { from: string; to: string }
export type Pagination = { page: number; pageSize: number; totalItems: number; totalPages: number }
export type PageParams = { page: number; pageSize: number }

// '' means "all" (empty select); the API layer drops empty values before sending the request.
export type EventReportFilters = { status?: EventStatus | ''; serviceType?: EventType | ''; clientId?: string }
export type TaskReportFilters = { status?: TaskStatus | ''; teamId?: string; origin?: TaskOrigin | '' }

export type EventReportRow = {
  id: string
  name: string
  eventDate: string
  status: EventStatus
  serviceType: EventType
  guestsCount: number
  clientName: string | null
  tasksTotal: number
  tasksCompleted: number
}

export type EventsReport = {
  period: ApiPeriod
  summary: { total: number; byStatus: Record<EventStatus, number>; byServiceType: Record<EventType, number> }
  items: EventReportRow[]
  pagination: Pagination
}

export type TaskReportRow = {
  id: string
  title: string
  status: TaskStatus
  dueDate: string | null
  completedAt: string | null
  createdAt: string
  assignedAt: string | null
  eventId: string
  eventName: string
  eventDate: string
  teamName: string | null
  origin: TaskOrigin
  overdue: boolean
  completedLate: boolean
}

export type TasksReport = {
  period: ApiPeriod
  summary: {
    total: number
    byStatus: Record<TaskStatus, number>
    byOrigin: Record<TaskOrigin, number>
    overdueOpen: number
    completedOnTime: number
    completedLate: number
    canceled: number
    onTimePercentage: number | null
  }
  items: TaskReportRow[]
  pagination: Pagination
}

export type TeamPerformanceRow = {
  teamId: string
  teamName: string
  specialty: TeamSpecialty
  total: number
  completed: number
  completedOnTime: number
  completedLate: number
  overdueOpen: number
  canceled: number
  onTimePercentage: number | null
  avgAssignmentMinutes: Record<TaskOrigin, number | null>
}

export type TeamPerformanceReport = {
  period: ApiPeriod
  summary: {
    teams: number
    tasks: number
    completedOnTime: number
    completedLate: number
    overdueOpen: number
    canceled: number
    onTimePercentage: number | null
    avgAssignmentMinutes: Record<TaskOrigin, number | null>
  }
  items: TeamPerformanceRow[]
}
