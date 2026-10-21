import { httpClient } from './httpClient'
import type { Client, ClientFilters, ClientInput } from '../types/client'

export const listClients = async (filters: ClientFilters = {}) => (await httpClient.get<Client[]>('/api/v1/clients', { params: filters })).data
export const createClient = async (input: ClientInput) => (await httpClient.post<Client>('/api/v1/clients', input)).data
export const updateClient = async (id: string, input: Partial<ClientInput>) => (await httpClient.put<Client>(`/api/v1/clients/${id}`, input)).data
export const removeClient = async (id: string) => { await httpClient.delete(`/api/v1/clients/${id}`) }
