import type { EventStatus } from './event'
import type { TaskStatus } from './task'

export type DashboardSummary = {
  eventsThisMonth: number
  pendingTasks: number
  activeTeams: number
  completedOnTimePercentage: number | null
}

export type UpcomingEvent = { id: string; name: string; eventDate: string; location: string; status: EventStatus }
export type TaskStatusCounts = Record<TaskStatus, number>
