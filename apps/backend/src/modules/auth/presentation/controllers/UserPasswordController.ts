import type { Request, Response } from "express";
import { z } from "zod";
import type { UserPasswordService } from "../../application/UserPasswordService.js";

const paramsSchema = z.object({ id: z.string().uuid() });

export class UserPasswordController {
  constructor(private readonly service: UserPasswordService) {}

  reset = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    const { id } = paramsSchema.parse(request.params);
    response.json(await this.service.resetByAdmin(id, actorId));
  };
}
