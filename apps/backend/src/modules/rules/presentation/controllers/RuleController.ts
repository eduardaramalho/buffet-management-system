import type { Request, Response } from "express";
import { z } from "zod";
import { eventTypes } from "../../../events/domain/event.types.js";
import { teamSpecialties } from "../../../teams/domain/team.types.js";
import type { RuleEngineService } from "../../application/RuleEngineService.js";

const resourceRequirementSchema = z.object({
  specialty: z.enum(teamSpecialties),
  minQuantity: z.number().int().min(1),
});
const taskTemplateSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().optional().nullable(),
  daysBeforeEvent: z.number().int().min(0).max(365).optional().nullable(),
  specialty: z.enum(teamSpecialties).optional().nullable(),
});

// Base sem defaults: o .partial() do Zod 4 mantém .default(), o que sobrescreveria campos omitidos no PUT.
const ruleBaseSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).nullable().optional(),
  conditionServiceTypeIn: z.array(z.enum(eventTypes)).nullable().optional(),
  conditionMinGuests: z.number().int().min(0).nullable().optional(),
  conditionMaxGuests: z.number().int().min(0).nullable().optional(),
  conditionRequiredServiceIds: z.array(z.string().min(1)).nullable().optional(),
  resourceRequirements: z.array(resourceRequirementSchema),
  taskTemplates: z.array(taskTemplateSchema).max(20).optional(),
});
const ruleSchema = ruleBaseSchema.extend({
  description: ruleBaseSchema.shape.description.default(null),
  conditionServiceTypeIn: ruleBaseSchema.shape.conditionServiceTypeIn.default(null),
  conditionMinGuests: ruleBaseSchema.shape.conditionMinGuests.default(null),
  conditionMaxGuests: ruleBaseSchema.shape.conditionMaxGuests.default(null),
  conditionRequiredServiceIds: ruleBaseSchema.shape.conditionRequiredServiceIds.default(null),
  resourceRequirements: ruleBaseSchema.shape.resourceRequirements.default([]),
});
const updateSchema = ruleBaseSchema.partial().extend({ isActive: z.boolean().optional() });
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
