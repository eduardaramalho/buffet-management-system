import type { Request, Response } from "express";
import { z } from "zod";
import { eventTypes } from "../../../events/domain/event.types.js";
import { teamSpecialties } from "../../../teams/domain/team.types.js";
import type { RuleEngineService } from "../../application/RuleEngineService.js";

const resourceRequirementSchema = z.object({
  specialty: z.enum(teamSpecialties),
  minQuantity: z.number().int().min(1),
});

const ruleSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).nullable().optional().default(null),
  conditionServiceTypeIn: z.array(z.enum(eventTypes)).nullable().optional().default(null),
  conditionMinGuests: z.number().int().min(0).nullable().optional().default(null),
  conditionMaxGuests: z.number().int().min(0).nullable().optional().default(null),
  conditionRequiredServiceIds: z.array(z.string().min(1)).nullable().optional().default(null),
  resourceRequirements: z.array(resourceRequirementSchema).default([]),
});
const updateSchema = ruleSchema.partial().extend({ isActive: z.boolean().optional() });
const listSchema = z.object({
  search: z.string().optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
});
const routeId = (request: Request) => String(request.params.id);

export class RuleController {
  constructor(private readonly service: RuleEngineService) {}

  list = async (request: Request, response: Response) => response.json(await this.service.list(listSchema.parse(request.query)));
  get = async (request: Request, response: Response) => response.json(await this.service.get(routeId(request)));
  create = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    response.status(201).json(await this.service.create({ ...ruleSchema.parse(request.body), createdById: actorId }));
  };
  update = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    response.json(await this.service.update(routeId(request), updateSchema.parse(request.body), actorId));
  };
  remove = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    await this.service.remove(routeId(request), actorId);
    response.status(204).send();
  };
  setActive = (isActive: boolean) => async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    response.json(await this.service.setActive(routeId(request), isActive, actorId));
  };
}
