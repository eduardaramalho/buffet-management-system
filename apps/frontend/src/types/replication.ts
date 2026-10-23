import type { EventStatus, EventType } from './event'

// RF25 (ADR 0008): contracts of GET /events/:id/replication-preview and POST /events/:id/replicate.

export type TeamUnavailableReason = 'NOT_FOUND' | 'INACTIVE' | 'SCHEDULE_CONFLICT'

export type ReplicationWarning =
  | { code: 'CLIENT_UNAVAILABLE' }
  | { code: 'SERVICE_UNAVAILABLE'; serviceId: string; name: string }

export type ReplicationPreviewTask = {
  sourceTaskId: string
  title: string
  description: string | null
  sourceStatus: string
  originalDueDate: string | null
  dueDate: string | null
  dueDateInPast: boolean
  assignedTeamId: string | null
  selected: boolean
}

export type ReplicationPreviewTeam = {
  teamId: string
  name: string
  specialty: string
  available: boolean
  reason: TeamUnavailableReason | null
  conflictingEvent: { id: string; name: string } | null
}

export type ReplicationPreview = {
  source: { id: string; name: string; status: EventStatus; eventDate: string; endDate: string | null }
  draft: {
    location: string
    serviceType: EventType
    guestsCount: number
    observations: string | null
    clientId: string | null
    services: Array<{ serviceId: string; name: string; isCustom: boolean; customLabel: string | null }>
  }
  warnings: ReplicationWarning[]
  tasks: ReplicationPreviewTask[]
  teams: ReplicationPreviewTeam[]
}

// dueDate omitted = the API recalculates it from the source; null = no deadline.
export type ReplicatedTaskInput = { sourceTaskId: string; title?: string; dueDate?: string | null }

export type ReplicateEventInput = {
  name: string
  eventDate: string
  endDate: string | null
  location: string
  serviceType: EventType
  guestsCount: number
  observations: string | null
  clientId: string
  services: Array<{ serviceId: string; customLabel?: string | null }>
  tasks: ReplicatedTaskInput[]
  teamIds: string[]
}

export type ReplicationTeamConflict = { teamId: string; reason: TeamUnavailableReason; conflictingEvent: { id: string; name: string } | null }
