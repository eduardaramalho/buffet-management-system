import type { EventRepository } from "../../events/domain/event.types.js";
import { formatAuditActivityMessage } from "../../../shared/auditActivity.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import type { AuditRepository } from "../domain/user-management.types.js";

const EVENT_HISTORY_LIMIT = 20;

export class AuditHistoryService {
  constructor(
    private readonly events: Pick<EventRepository, "findById">,
    private readonly audits: Pick<AuditRepository, "listByEntity">,
  ) {}

  async listEventHistory(eventId: string) {
    const event = await this.events.findById(eventId);
    if (!event) throw new NotFoundError("Evento não encontrado");

    const logs = await this.audits.listByEntity("Event", eventId, EVENT_HISTORY_LIMIT);
    // DTO keeps only business data (what, who, when): action/entity codes and the changes JSON are
    // technical details that must not reach the frontend (KAN-78).
    return logs.slice(0, EVENT_HISTORY_LIMIT).map(({ id, action, entity, changes, actorName, createdAt }) => ({
      id,
      message: formatAuditActivityMessage({ action, entity, changes: changes as never, subject: event.name }),
      actorName,
      createdAt,
    }));
  }
}