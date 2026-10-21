import { httpClient } from './httpClient'
import type { CreateEventInput, Event, EventFilters, UpdateEventInput } from '../types/event'

export const listEvents = async (filters: EventFilters = {}) => (await httpClient.get<Event[]>('/api/v1/events', { params: filters })).data
export const getEvent = async (id: string) => (await httpClient.get<Event>(`/api/v1/events/${id}`)).data
export const createEvent = async (input: CreateEventInput) => (await httpClient.post<Event>('/api/v1/events', input)).data
export const updateEvent = async (id: string, input: UpdateEventInput) => (await httpClient.put<Event>(`/api/v1/events/${id}`, input)).data
export const removeEvent = async (id: string) => { await httpClient.delete(`/api/v1/events/${id}`) }
export const attachEventService = async (eventId: string, serviceId: string, customLabel?: string | null) => (await httpClient.post<Event>(`/api/v1/events/${eventId}/services`, { serviceId, customLabel })).data
export const detachEventService = async (eventId: string, serviceId: string) => { await httpClient.delete(`/api/v1/events/${eventId}/services/${serviceId}`) }
export const getEventHistory = async (eventId: string) => (await httpClient.get<EventHistory[]>(`/api/v1/events/${eventId}/history`)).data

export type EventHistory = { id: string; action: string; message: string; actorName: string | null; createdAt: string }