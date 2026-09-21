export const eventStatuses = ["PLANEJAMENTO", "CONFIRMADO", "EM_ANDAMENTO", "CONCLUIDO", "CANCELADO"] as const;
export type EventStatus = (typeof eventStatuses)[number];

export const eventTypes = ["CASAMENTO", "ANIVERSARIO", "FORMATURA", "CORPORATIVO", "CONFRATERNIZACAO", "BATIZADO", "OUTRO"] as const;
export type EventType = (typeof eventTypes)[number];

export type ServiceRecord = {
  id: string;
  name: string;
  isCustom: boolean;
  createdAt: Date;
  deletedAt: Date | null;
};

export type EventServiceRecord = {
  serviceId: string;
  customLabel: string | null;
  service: ServiceRecord;
};

export type EventRecord = {
  id: string;
  name: string;
  eventDate: Date;
  endDate: Date | null;
  location: string;
  serviceType: EventType;
  guestsCount: number;
  observations: string | null;
  status: EventStatus;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  services: EventServiceRecord[];
};

export type CreateEventInput = {
  name: string;
  eventDate: Date;
  endDate: Date | null;
  location: string;
  serviceType: EventType;
  guestsCount: number;
  observations: string | null;
  createdById: string;
};

export type UpdateEventInput = Partial<Omit<CreateEventInput, "createdById">> & {
  status?: EventStatus;
  reason?: string;
};

export type EventListFilter = {
  status?: EventStatus;
  from?: Date;
  to?: Date;
  search?: string;
};

export type AttachServiceInput = {
  eventId: string;
  serviceId: string;
  customLabel?: string | null;
};

export interface EventRepository {
  create(input: CreateEventInput & { status: "PLANEJAMENTO" }): Promise<EventRecord>;
  findById(id: string): Promise<EventRecord | null>;
  list(filter: EventListFilter): Promise<EventRecord[]>;
  update(id: string, input: UpdateEventInput): Promise<EventRecord>;
  softDelete(id: string): Promise<EventRecord>;
  restore(id: string): Promise<EventRecord>;
  attachService(input: AttachServiceInput): Promise<EventRecord>;
  detachService(eventId: string, serviceId: string): Promise<void>;
}

export interface ServiceRepository {
  findById(id: string): Promise<ServiceRecord | null>;
  list(): Promise<ServiceRecord[]>;
  create(input: { name: string; isCustom: boolean }): Promise<ServiceRecord>;
  update(id: string, input: { name?: string; isCustom?: boolean }): Promise<ServiceRecord>;
  softDelete(id: string): Promise<ServiceRecord>;
}

export interface EventAuditService {
  record(input: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    changes?: Record<string, unknown>;
    reason?: string;
  }): Promise<void>;
}