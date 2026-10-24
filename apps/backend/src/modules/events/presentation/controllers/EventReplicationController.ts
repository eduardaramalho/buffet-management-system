import type { Request, Response } from "express";
import { z } from "zod";
import type { EventReplicationService } from "../../application/EventReplicationService.js";
import { createEventSchema, dateSchema } from "../schemas/event.schemas.js";

const previewQuerySchema = z.object({
  eventDate: dateSchema,
  endDate: dateSchema.nullable().optional().default(null),
});

// dueDate keeps the difference between "omitted" (recalculate from the source) and null (no deadline).
const replicatedTaskSchema = z.object({
  sourceTaskId: z.string().min(1).max(36),
  title: z.string().trim().min(1).max(150).optional(),
  description: z.string().max(2000).nullable().optional(),
  dueDate: dateSchema.nullable().optional(),
});

const replicateSchema = createEventSchema.extend({
  services: z.array(z.object({ serviceId: z.string().min(1).max(36), customLabel: z.string().max(255).nullable().optional() })).max(50).default([]),
  tasks: z.array(replicatedTaskSchema).max(200).default([]),
  teamIds: z.array(z.string().min(1).max(36)).max(50).default([]),
});

const routeId = (request: Request) => String(request.params.id);

export class EventReplicationController {
  constructor(private readonly service: EventReplicationService) {}

  preview = async (request: Request, response: Response) => {
    response.json(await this.service.preview(routeId(request), previewQuerySchema.parse(request.query)));
  };

  replicate = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) {
      response.status(401).json({ message: "Não autenticado" });
      return;
    }
    response.status(201).json(await this.service.replicate(routeId(request), replicateSchema.parse(request.body), actorId));
  };
}
