import { httpClient } from './httpClient'
import type { Collaborator, CollaboratorFilters, CreateCollaboratorInput, UpdateCollaboratorInput } from '../types/collaborator'

export const listCollaborators = async (filters: CollaboratorFilters = {}) => (await httpClient.get<Collaborator[]>('/api/v1/collaborators', { params: filters })).data
export const getCollaborator = async (id: string) => (await httpClient.get<Collaborator>(`/api/v1/collaborators/${id}`)).data
export const createCollaborator = async (input: CreateCollaboratorInput) => (await httpClient.post<Collaborator>('/api/v1/collaborators', input)).data
export const updateCollaborator = async (id: string, input: UpdateCollaboratorInput) => (await httpClient.put<Collaborator>(`/api/v1/collaborators/${id}`, input)).data
export const setCollaboratorActive = async (id: string, active: boolean) => (await httpClient.patch<Collaborator>(`/api/v1/collaborators/${id}/status`, { active })).data
