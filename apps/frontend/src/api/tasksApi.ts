import { httpClient } from './httpClient'
import type { CreateTaskInput, Task, TaskFilters, TaskStatus, UpdateTaskInput } from '../types/task'
import type { TaskComment } from '../types/taskComment'

export const listTasks = async (filters: TaskFilters = {}) => (await httpClient.get<Task[]>('/api/v1/tasks', { params: filters })).data
export const getTask = async (id: string) => (await httpClient.get<Task>(`/api/v1/tasks/${id}`)).data
export const updateTaskStatus = async (id: string, status: TaskStatus) => (await httpClient.patch<Task>(`/api/v1/tasks/${id}/status`, { status })).data
export const createTask = async (input: CreateTaskInput) => (await httpClient.post<Task>('/api/v1/tasks', input)).data
export const updateTask = async (id: string, input: UpdateTaskInput) => (await httpClient.put<Task>(`/api/v1/tasks/${id}`, input)).data
export const removeTask = async (id: string) => { await httpClient.delete(`/api/v1/tasks/${id}`) }

// ADR 0017: comentários da tarefa.
export const listTaskComments = async (taskId: string) => (await httpClient.get<TaskComment[]>(`/api/v1/tasks/${taskId}/comments`)).data
export const createTaskComment = async (taskId: string, body: string) => (await httpClient.post<TaskComment>(`/api/v1/tasks/${taskId}/comments`, { body })).data
