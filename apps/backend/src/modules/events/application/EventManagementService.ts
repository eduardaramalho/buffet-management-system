import type {
  CreateEventInput,
  EventAuditService,
  EventListFilter,
  EventRepository,
  EventRecord,
  AttachServiceInput,
  EventClientReader,
  EventRuleExecutionTrigger,
  ServiceRepository,
  UpdateEventInput,
} from "../domain/event.types.js";
import type { Logger } from "../../../shared/domain/logger.types.js";
import { normalizeServiceLabel } from "../domain/eventServiceLabel.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";

const MAX_GUESTS_COUNT = 5000;
const EVENT_NOT_FOUND = "Evento não encontrado";
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
    private readonly services?: ServiceRepository,
    private readonly ruleExecution?: EventRuleExecutionTrigger,
    private readonly logger?: Logger,
    private readonly clients?: EventClientReader,
  ) {}

  async create(input: CreateEventInput): Promise<EventRecord> {
    await this.assertCanCreate(input);

    const event = await this.events.create({ ...input, status: "PLANEJAMENTO" });
    await this.audit.record({
      userId: input.createdById,
      action: "EVENT_CREATED",
      entity: "Event",
      entityId: event.id,
      changes: { before: null, after: event },
    });
    return event;
  }

  // Creation rules shared with RF25 (EventReplicationService) so a replica is held to exactly the
  // same constraints as a brand-new event: future date, guest limits (RN03) and an active client.
  async assertCanCreate(input: CreateEventInput): Promise<void> {
    if (input.eventDate.getTime() < Date.now()) {
      throw new EventManagementError("A data do evento não pode estar no passado");
    }

    if (!Number.isInteger(input.guestsCount) || input.guestsCount < 1) {
      throw new EventManagementError("O número de convidados deve ser um inteiro maior ou igual a 1");
    }

    if (input.guestsCount > MAX_GUESTS_COUNT) {
      throw new EventManagementError(`O número de convidados não pode exceder ${MAX_GUESTS_COUNT}`);
    }

    if (!input.clientId?.trim()) throw new EventManagementError("O cliente do evento é obrigatório");
    await this.assertClientAvailable(input.clientId);
  }

  list(filter: EventListFilter) {
    return this.events.list(filter);
  }

  get(id: string) {
    return this.events.findDetailById(id).then((event) => {
      if (!event) throw new EventManagementError(EVENT_NOT_FOUND);
      return event;
    });
  }

  async update(id: string, input: UpdateEventInput, actorId: string) {
    const event = await this.events.findById(id);
    if (!event) throw new EventManagementError(EVENT_NOT_FOUND);

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
    // clientId is optional on update so legacy events (no client) can still change status from the Event Hub;
    // when sent, it must point to an active client. The change is audited through EVENT_UPDATED before/after.
    if (input.clientId !== undefined) await this.assertClientAvailable(input.clientId);

    const updated = await this.events.update(id, input);
    await this.audit.record({
      userId: actorId,
      action: input.status && input.status !== event.status ? "EVENT_STATUS_CHANGED" : "EVENT_UPDATED",
      entity: "Event",
      entityId: id,
      changes: { before: event, after: updated },
      reason: input.reason,
    });
    // Automatic trigger (decision): confirming an event kicks off Rule Engine Part 2. Failures here
    // are logged, not rethrown: the event update above already committed and was audited, so a 500
    // here would be misleading (the confirmation itself succeeded). The absence of a RuleApplication
    // row for this event is itself the signal that reprocessing is needed, via the manual
    // POST /api/v1/events/:id/apply-rules endpoint (Part 2) once someone notices and reprocesses.
    if (input.status === "CONFIRMADO" && event.status !== "CONFIRMADO") {
      try {
        await this.ruleExecution?.applyRules(id, actorId);
      } catch (error) {
        this.logger?.error({ eventId: id, err: error }, "Falha ao executar o motor de regras automaticamente após confirmar o evento");
      }
    }
    return updated;
  }

  async remove(id: string, actorId: string) {
    const event = await this.events.findById(id);
    if (!event) throw new EventManagementError(EVENT_NOT_FOUND);
    if (event.status === "CONCLUIDO") {
      throw new EventManagementError("Eventos concluídos não podem ser excluídos");
    }

    const deleted = await this.events.softDelete(id);
    await this.audit.record({
      userId: actorId,
      action: "EVENT_DELETED",
      entity: "Event",
      entityId: id,
      changes: { before: event, after: deleted },
    });
    return deleted;
  }

  listDeleted() {
    return this.events.listDeleted();
  }

  // Restores a soft-deleted event exactly as it was (same status, services, teams and tasks).
  async restore(id: string, actorId: string) {
    const deleted = await this.events.findDeletedById(id);
    if (!deleted) {
      if (await this.events.findById(id)) throw new EventManagementError("O evento não está excluído");
      throw new NotFoundError(EVENT_NOT_FOUND);
    }

    const restored = await this.events.restore(id);
    await this.audit.record({
      userId: actorId,
      action: "EVENT_RESTORED",
      entity: "Event",
      entityId: id,
      changes: { name: deleted.name, before: { deletedAt: deleted.deletedAt }, after: { deletedAt: null } },
    });
    return restored;
  }

  private async assertClientAvailable(clientId: string) {
    if (!this.clients) throw new EventManagementError("Cadastro de clientes não configurado");
    const client = await this.clients.findById(clientId);
    if (!client) throw new EventManagementError("Cliente não encontrado");
  }

  async attachService(input: AttachServiceInput, actorId: string) {
    if (!this.services) throw new EventManagementError("Catálogo de serviços não configurado");
    const service = await this.services.findById(input.serviceId);
    if (!service) throw new EventManagementError("Serviço não encontrado");

    const label = normalizeServiceLabel(service, input.customLabel);
    if (!label.ok) throw new EventManagementError(label.message);
    const { customLabel } = label;

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