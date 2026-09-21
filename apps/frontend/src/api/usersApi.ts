import { httpClient } from './httpClient'
import type { User } from '../types'

export const listUsers = async (search = '') => (await httpClient.get<User[]>('/api/v1/users', { params: { search: search || undefined } })).data
export const getUser = async (id: string) => (await httpClient.get<User>(`/api/v1/users/${id}`)).data
export const createUser = async (input: { name: string; email: string; password: string; roleId: string }) => (await httpClient.post<User>('/api/v1/users', input)).data
export const updateUser = async (id: string, input: Partial<{ name: string; email: string; password: string }>) => (await httpClient.put<User>(`/api/v1/users/${id}`, input)).data
export const setUserActive = async (id: string, isActive: boolean) => (await httpClient.patch<User>(`/api/v1/users/${id}/${isActive ? 'activate' : 'deactivate'}`)).data