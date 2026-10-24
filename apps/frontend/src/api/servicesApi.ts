import { httpClient } from './httpClient'
import type { Service } from '../types/event'

export const listServices = async () => (await httpClient.get<Service[]>('/api/v1/services')).data
// RF06: the screen only creates regular services; the generic "Outro" comes from the seed (ADR 0001).
export const createService = async (name: string) => (await httpClient.post<Service>('/api/v1/services', { name })).data
export const updateService = async (id: string, name: string) => (await httpClient.put<Service>(`/api/v1/services/${id}`, { name })).data
export const removeService = async (id: string) => { await httpClient.delete(`/api/v1/services/${id}`) }