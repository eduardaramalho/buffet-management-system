import type { Request, Response } from "express";
import { z } from "zod";
import { taskStatuses } from "../../domain/task.types.js";
import type { TaskService } from "../../application/TaskService.js";

const listSchema = z.object({
  eventId: z.string().min(1).optional(),
  status: z.enum(taskStatuses).optional(),
});
const routeId = (request: Request) => String(request.params.id);

// List/get only in this step — status updates belong to the next module.
export class TaskController {
  constructor(private readonly service: TaskService) {}

  list = async (request: Request, response: Response) => response.json(await this.service.list(listSchema.parse(request.query)));
  get = async (request: Request, response: Response) => response.json(await this.service.get(routeId(request)));
}
