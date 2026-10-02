import type { Request, Response } from "express";
import { z } from "zod";
import { taskStatuses } from "../../domain/task.types.js";
import type { TaskService } from "../../application/TaskService.js";

const listSchema = z.object({
  eventId: z.string().min(1).optional(),
  status: z.enum(taskStatuses).optional(),
});
const updateStatusSchema = z.object({ status: z.enum(taskStatuses) });
const routeId = (request: Request) => String(request.params.id);

export class TaskController {
  constructor(private readonly service: TaskService) {}

  list = async (request: Request, response: Response) => response.json(await this.service.list(listSchema.parse(request.query)));
  get = async (request: Request, response: Response) => response.json(await this.service.get(routeId(request)));

  updateStatus = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    const { status } = updateStatusSchema.parse(request.body);
    response.json(await this.service.updateStatus(routeId(request), status, actorId));
  };
}
