import type { Request, Response } from "express";
import { z } from "zod";
import type { TaskCommentService } from "../../application/TaskCommentService.js";
import { TASK_COMMENT_MAX_LENGTH } from "../../domain/taskComment.types.js";

const createSchema = z.object({ body: z.string().trim().min(1).max(TASK_COMMENT_MAX_LENGTH) });
const routeId = (request: Request) => String(request.params.id);

export class TaskCommentController {
  constructor(private readonly service: TaskCommentService) {}

  list = async (request: Request, response: Response) => response.json(await this.service.list(routeId(request)));

  create = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    const { body } = createSchema.parse(request.body);
    response.status(201).json(await this.service.create(routeId(request), body, actorId));
  };
}
