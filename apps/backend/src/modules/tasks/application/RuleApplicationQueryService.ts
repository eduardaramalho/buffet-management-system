import type { EventRepository } from "../../events/domain/event.types.js";
import type { RuleApplicationRepository } from "../domain/task.types.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";

export class RuleApplicationQueryService {
  constructor(
    private readonly events: Pick<EventRepository, "findById">,
    private readonly applications: Pick<RuleApplicationRepository, "listByEvent">,
  ) {}

  async listByEvent(eventId: string) {
    const event = await this.events.findById(eventId);
    if (!event) throw new NotFoundError("Evento não encontrado");
    const applications = await this.applications.listByEvent(eventId);
    return applications.sort((left, right) => right.appliedAt.getTime() - left.appliedAt.getTime());
  }
}