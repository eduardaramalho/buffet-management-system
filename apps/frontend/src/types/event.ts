export const EVENT_STATUSES = ['PLANEJAMENTO', 'CONFIRMADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO'] as const
export type EventStatus = typeof EVENT_STATUSES[number]
export const EVENT_TYPES = ['CASAMENTO', 'ANIVERSARIO', 'FORMATURA', 'CORPORATIVO', 'CONFRATERNIZACAO', 'BATIZADO', 'OUTRO'] as const
export type EventType = typeof EVENT_TYPES[number]

export type Service = { id: string; name: string; isCustom: boolean; createdAt: string; deletedAt: string | null }
export type EventService = { serviceId: string; customLabel: string | null; service: Service }
// Only what the event screens show about the client (the document stays in the clients module).
export type EventClient = { id: string; name: string; email: string | null; phone: string | null; deletedAt: string | null }
export type Event = {
  id: string; name: string; eventDate: string; endDate: string | null; location: string; serviceType: EventType
  guestsCount: number; observations: string | null; status: EventStatus; createdById: string; createdAt: string
  updatedAt: string; deletedAt: string | null; services: EventService[]
  // Null only for events created before the clients module (they must be linked when edited).
  clientId: string | null; client: EventClient | null
}
export type CreateEventInput = Omit<Event, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'services' | 'createdById' | 'client' | 'clientId'> & { clientId: string }
export type UpdateEventInput = Partial<Omit<CreateEventInput, 'createdById'>> & { status?: EventStatus; reason?: string }
export type EventFilters = { status?: EventStatus; from?: string; to?: string; search?: string }