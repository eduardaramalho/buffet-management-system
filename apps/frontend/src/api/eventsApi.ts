import { httpClient } from './httpClient'
import type { CreateEventInput, Event, EventFilters, UpdateEventInput } from '../types/event'
import type { ReplicateEventInput, ReplicationPreview } from '../types/replication'

export const listEvents = async (filters: EventFilters = {}) => (await httpClient.get<Event[]>('/api/v1/events', { params: filters })).data
export const getEvent = async (id: string) => (await httpClient.get<Event>(`/api/v1/events/${id}`)).data
export const createEvent = async (input: CreateEventInput) => (await httpClient.post<Event>('/api/v1/events', input)).data
export const updateEvent = async (id: string, input: UpdateEventInput) => (await httpClient.put<Event>(`/api/v1/events/${id}`, input)).data
// Soft-deleted events (permission events:restore); restore brings the event back exactly as it was.
export const listDeletedEvents = async () => (await httpClient.get<Event[]>('/api/v1/events/deleted')).data
export const restoreEvent = async (id: string) => (await httpClient.patch<Event>(`/api/v1/events/${id}/restore`)).data
export const removeEvent = async (id: string) => { await httpClient.delete(`/api/v1/events/${id}`) }
export const attachEventService = async (eventId: string, serviceId: string, customLabel?: string | null) => (await httpClient.post<Event>(`/api/v1/events/${eventId}/services`, { serviceId, customLabel })).data
export const detachEventService = async (eventId: string, serviceId: string) => { await httpClient.delete(`/api/v1/events/${eventId}/services/${serviceId}`) }
// RF25: endDate travels only when informed, so an empty value does not become the string "null".
export const getReplicationPreview = async (eventId: string, schedule: { eventDate: string; endDate: string | null }) =>
  (await httpClient.get<ReplicationPreview>(`/api/v1/events/${eventId}/replication-preview`, { params: { eventDate: schedule.eventDate, ...(schedule.endDate ? { endDate: schedule.endDate } : {}) } })).data
export const replicateEvent = async (eventId: string, input: ReplicateEventInput) => (await httpClient.post<Event>(`/api/v1/events/${eventId}/replicate`, input)).data
export const getEventHistory = async (eventId: string) => (await httpClient.get<EventHistory[]>(`/api/v1/events/${eventId}/history`)).data

export type EventHistory = { id: string; action: string; message: string; actorName: string | null; createdAt: string }