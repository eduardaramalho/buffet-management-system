import { httpClient } from './httpClient'
import type { Task, TaskFilters, TaskStatus } from '../types/task'

export const listTasks = async (filters: TaskFilters = {}) => (await httpClient.get<Task[]>('/api/v1/tasks', { params: filters })).data
export const getTask = async (id: string) => (await httpClient.get<Task>(`/api/v1/tasks/${id}`)).data
export const updateTaskStatus = async (id: string, status: TaskStatus) => (await httpClient.patch<Task>(`/api/v1/tasks/${id}/status`, { status })).data
