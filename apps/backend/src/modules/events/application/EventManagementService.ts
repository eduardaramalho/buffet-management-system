import type {
  CreateEventInput,
  EventAuditService,
  EventListFilter,
  EventRepository,
  EventRecord,
  AttachServiceInput,
  ServiceRepository,
  UpdateEventInput,
} from "../domain/event.types.js";

const MAX_GUESTS_COUNT = 5000;
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  PLANEJAMENTO: ["CONFIRMADO", "CANCELADO"],
  CONFIRMADO: ["EM_ANDAMENTO", "CANCELADO"],
  EM_ANDAMENTO: ["CONCLUIDO", "CANCELADO"],
  CONCLUIDO: [],
  CANCELADO: [],
};

export class EventManagementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventManagementError";
  }
}

export class EventManagementService {
  constructor(
    private readonly events: EventRepository,
    private readonly audit: EventAuditService,
    private readonly services?: ServiceRepository
  ) {}

  async create(input: CreateEventInput): Promise<EventRecord> {
    if (input.eventDate.getTime() < Date.now()) {
      throw new EventManagementError("A data do evento não pode estar no passado");
    }

    if (input.guestsCount > MAX_GUESTS_COUNT) {
      throw new EventManagementError(`O número de convidados não pode exceder ${MAX_GUESTS_COUNT}`);
    }

    const event = await this.events.create({ ...input, status: "PLANEJAMENTO" });
    await this.audit.record({
      userId: input.createdById,
      action: "EVENT_CREATED",
      entity: "Event",
      entityId: event.id,
      changes: { name: event.name, status: event.status },
    });
    return event;
  }

  list(filter: EventListFilter) {
    return this.events.list(filter);
  }

  get(id: string) {
    return this.events.findById(id).then((event) => {
      if (!event) throw new EventManagementError("Evento não encontrado");
      return event;
    });
  }

  async update(id: string, input: UpdateEventInput, actorId: string) {
    const event = await this.events.findById(id);
    if (!event) throw new EventManagementError("Evento não encontrado");

    if (input.status && input.status !== event.status && !VALID_STATUS_TRANSITIONS[event.status]?.includes(input.status)) {
      throw new EventManagementError("transição de status inválida");
    }
    if ((input.status === "CANCELADO" && ["CONFIRMADO", "EM_ANDAMENTO"].includes(event.status)) ||
      (event.status === "CONFIRMADO" && (input.eventDate !== undefined || input.location !== undefined))) {
      if (!input.reason?.trim()) throw new EventManagementError("reason é obrigatório para esta alteração");
    }
    if (input.guestsCount !== undefined && input.guestsCount > MAX_GUESTS_COUNT) {
      throw new EventManagementError(`O número de convidados não pode exceder ${MAX_GUESTS_COUNT}`);
    }

    const updated = await this.events.update(id, input);
    await this.audit.record({
      userId: actorId,
      action: input.status && input.status !== event.status ? "EVENT_STATUS_CHANGED" : "EVENT_UPDATED",
      entity: "Event",
      entityId: id,
      changes: { before: event, after: updated },
      reason: input.reason,
    });
    return updated;
  }

  async remove(id: string, actorId: string) {
    const event = await this.events.findById(id);
    if (!event) throw new EventManagementError("Evento não encontrado");
    if (event.status === "CONCLUIDO") {
      throw new EventManagementError("Eventos concluídos não podem ser excluídos");
    }

    const deleted = await this.events.softDelete(id);
    await this.audit.record({ userId: actorId, action: "EVENT_DELETED", entity: "Event", entityId: id });
    return deleted;
  }

  async restore(id: string, actorId: string) {
    const restored = await this.events.restore(id);
    await this.audit.record({ userId: actorId, action: "EVENT_RESTORED", entity: "Event", entityId: id });
    return restored;
  }

  async attachService(input: AttachServiceInput, actorId: string) {
    if (!this.services) throw new EventManagementError("Catálogo de serviços não configurado");
    const service = await this.services.findById(input.serviceId);
    if (!service) throw new EventManagementError("Serviço não encontrado");

    const customLabel = input.customLabel?.trim() || null;
    if (service.isCustom && !customLabel) {
      throw new EventManagementError("customLabel é obrigatório para o serviço Outro");
    }
    if (!service.isCustom && customLabel) {
      throw new EventManagementError("customLabel só pode ser usado para o serviço Outro");
    }

    const event = await this.events.attachService({ ...input, customLabel });
    await this.audit.record({
      userId: actorId,
      action: "EVENT_SERVICE_ATTACHED",
      entity: "Event",
      entityId: input.eventId,
      changes: { serviceId: input.serviceId, customLabel },
    });
    return event;
  }

  async detachService(eventId: string, serviceId: string, actorId: string) {
    await this.events.detachService(eventId, serviceId);
    await this.audit.record({
      userId: actorId,
      action: "EVENT_SERVICE_DETACHED",
      entity: "Event",
      entityId: eventId,
      changes: { serviceId },
    });
  }
}