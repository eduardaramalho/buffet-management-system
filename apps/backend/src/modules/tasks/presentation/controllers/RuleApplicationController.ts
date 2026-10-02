import type { Request, Response } from "express";
import { z } from "zod";
import type { RuleEngineExecutionService } from "../../application/RuleEngineExecutionService.js";

const applyRulesSchema = z.object({ forceRuleId: z.string().min(1).optional() });

// Manual reprocessing endpoint (decision 5): the automatic trigger lives in EventManagementService.
export class RuleApplicationController {
  constructor(private readonly service: RuleEngineExecutionService) {}

  apply = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });

    const { forceRuleId } = applyRulesSchema.parse(request.body ?? {});
    const result = await this.service.applyRules(String(request.params.eventId), actorId, { forceRuleId });
    response.status(200).json(result);
  };
}
