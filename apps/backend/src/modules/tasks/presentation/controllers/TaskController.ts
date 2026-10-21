import type { Request, Response } from "express";
import { z } from "zod";
import { taskStatuses } from "../../domain/task.types.js";
import type { TaskService } from "../../application/TaskService.js";

const listSchema = z.object({
  eventId: z.string().min(1).optional(),
  status: z.enum(taskStatuses).optional(),
});
const updateStatusSchema = z.object({ status: z.enum(taskStatuses) });
const TITLE_MAX_LENGTH = 150;
const titleSchema = z.string().trim().min(1).max(TITLE_MAX_LENGTH);
const createSchema = z.object({
  eventId: z.string().min(1),
  title: titleSchema,
  description: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  assignedTeamId: z.string().min(1).optional(),
});
// Keys left out of the body stay undefined, so the service never touches omitted fields.
const updateSchema = z.object({
  title: titleSchema.optional(),
  description: z.string().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  assignedTeamId: z.string().min(1).nullable().optional(),
});
const routeId = (request: Request) => String(request.params.id);

export class TaskController {
  constructor(private readonly service: TaskService) {}

  list = async (request: Request, response: Response) => response.json(await this.service.list(listSchema.parse(request.query)));
  get = async (request: Request, response: Response) => response.json(await this.service.get(routeId(request)));

  create = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    response.status(201).json(await this.service.create(createSchema.parse(request.body), actorId));
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

  updateStatus = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    const { status } = updateStatusSchema.parse(request.body);
    response.json(await this.service.updateStatus(routeId(request), status, actorId));
  };
}
