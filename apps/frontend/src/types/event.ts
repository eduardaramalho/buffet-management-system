export const EVENT_STATUSES = ['PLANEJAMENTO', 'CONFIRMADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO'] as const
export type EventStatus = typeof EVENT_STATUSES[number]
export const EVENT_TYPES = ['CASAMENTO', 'ANIVERSARIO', 'FORMATURA', 'CORPORATIVO', 'CONFRATERNIZACAO', 'BATIZADO', 'OUTRO'] as const
export type EventType = typeof EVENT_TYPES[number]

export type Service = { id: string; name: string; isCustom: boolean; createdAt: string; deletedAt: string | null }
export type EventService = { serviceId: string; customLabel: string | null; service: Service }
export type Event = {
  id: string; name: string; eventDate: string; endDate: string | null; location: string; serviceType: EventType
  guestsCount: number; observations: string | null; status: EventStatus; createdById: string; createdAt: string
  updatedAt: string; deletedAt: string | null; services: EventService[]
}
export type CreateEventInput = Omit<Event, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'services' | 'createdById'>
export type UpdateEventInput = Partial<Omit<CreateEventInput, 'createdById'>> & { status?: EventStatus; reason?: string }
export type EventFilters = { status?: EventStatus; from?: string; to?: string; search?: string }