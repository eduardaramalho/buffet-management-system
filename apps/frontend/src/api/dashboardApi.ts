import { httpClient } from './httpClient'
import type { DashboardSummary, TaskStatusCounts, UpcomingEvent } from '../types/dashboard'

export const getDashboardSummary = async () => (await httpClient.get<DashboardSummary>('/api/v1/dashboard/summary')).data
export const getUpcomingEvents = async (limit = 5) => (await httpClient.get<UpcomingEvent[]>('/api/v1/dashboard/upcoming-events', { params: { limit } })).data
export const getTasksByStatus = async () => (await httpClient.get<TaskStatusCounts>('/api/v1/dashboard/tasks-by-status')).data
