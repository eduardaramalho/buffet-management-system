import type { Request, Response } from "express";
import { z } from "zod";
import { eventStatuses, eventTypes } from "../../domain/event.types.js";
import type { EventManagementService } from "../../application/EventManagementService.js";

const dateSchema = z.coerce.date();
const createSchema = z.object({
  name: z.string().min(3).max(150),
  eventDate: dateSchema,
  endDate: dateSchema.nullable().optional().default(null),
  location: z.string().min(1).max(200),
  serviceType: z.enum(eventTypes),
  guestsCount: z.number().int().min(1).max(5000),
  observations: z.string().max(2000).nullable().optional().default(null),
});
const updateSchema = createSchema.partial().extend({ status: z.enum(eventStatuses).optional(), reason: z.string().max(1000).optional() });
const listSchema = z.object({
  status: z.enum(eventStatuses).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  search: z.string().optional(),
});
const routeId = (request: Request) => String(request.params.id);

export class EventController {
  constructor(private readonly service: EventManagementService) {}

  list = async (request: Request, response: Response) => response.json(await this.service.list(listSchema.parse(request.query)));
  get = async (request: Request, response: Response) => response.json(await this.service.get(routeId(request)));

  create = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    response.status(201).json(await this.service.create({ ...createSchema.parse(request.body), createdById: actorId }));
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

  restore = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    response.json(await this.service.restore(routeId(request), actorId));
  };

  attachService = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    response.json(await this.service.attachService({ eventId: routeId(request), ...z.object({ serviceId: z.string().min(1), customLabel: z.string().max(255).nullable().optional() }).parse(request.body) }, actorId));
  };

  detachService = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    await this.service.detachService(routeId(request), String(request.params.serviceId), actorId);
    response.status(204).send();
  };
}