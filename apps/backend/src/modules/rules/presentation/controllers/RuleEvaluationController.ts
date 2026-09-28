import type { Request, Response } from "express";
import { RuleManagementError } from "../../application/RuleEngineService.js";
import type { RuleEngineService } from "../../application/RuleEngineService.js";
import type { EventRepository } from "../../../events/domain/event.types.js";

// Preview-only endpoint: resolves an Event (read-only) and delegates to the pure evaluate()
// query — no tasks are created and no teams are assigned here, that is Part 2's job.
export class RuleEvaluationController {
  constructor(
    private readonly ruleEngine: RuleEngineService,
    private readonly events: EventRepository,
  ) {}

  getMatches = async (request: Request, response: Response) => {
    const event = await this.events.findById(String(request.params.eventId));
    if (!event) throw new RuleManagementError("Evento não encontrado");

    const contractedServiceIds = event.services.map((service) => service.serviceId);
    const matches = await this.ruleEngine.evaluate(
      { serviceType: event.serviceType, guestsCount: event.guestsCount },
      contractedServiceIds,
    );
    response.json(matches);
  };
}
