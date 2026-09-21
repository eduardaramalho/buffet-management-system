import { httpClient } from './httpClient'
import type { Permission, Role } from '../types'

export const listRoles = async () => (await httpClient.get<Role[]>('/api/v1/roles')).data
export const getRole = async (id: string) => (await httpClient.get<Role>(`/api/v1/roles/${id}`)).data
export const createRole = async (input: { name: string; description?: string }) => (await httpClient.post<Role>('/api/v1/roles', input)).data
export const updateRole = async (id: string, input: Partial<{ name: string; description: string }>) => (await httpClient.put<Role>(`/api/v1/roles/${id}`, input)).data
export const listPermissions = async () => (await httpClient.get<Permission[]>('/api/v1/roles/permissions')).data
export const assignPermission = async (roleId: string, permissionId: string) => { await httpClient.post(`/api/v1/roles/${roleId}/permissions`, { permissionId }) }
export const revokePermission = async (roleId: string, permissionId: string) => { await httpClient.delete(`/api/v1/roles/${roleId}/permissions`, { data: { permissionId } }) }