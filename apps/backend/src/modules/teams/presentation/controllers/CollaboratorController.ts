import type { Request, Response } from "express";
import { z } from "zod";
import type { CollaboratorService } from "../../application/CollaboratorService.js";

const collaboratorSchema = z.object({
  name: z.string().min(1).max(150),
  phone: z.string().max(30).nullable().optional().default(null),
  position: z.string().min(1).max(100),
});
const statusSchema = z.object({ active: z.boolean() });
const listSchema = z.object({ search: z.string().optional() });
const routeId = (request: Request) => String(request.params.id);

export class CollaboratorController {
  constructor(private readonly service: CollaboratorService) {}

  list = async (request: Request, response: Response) => response.json(await this.service.list(listSchema.parse(request.query)));
  get = async (request: Request, response: Response) => response.json(await this.service.get(routeId(request)));
  create = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    response.status(201).json(await this.service.create(collaboratorSchema.parse(request.body), actorId));
  };
  update = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    response.json(await this.service.update(routeId(request), collaboratorSchema.partial().parse(request.body), actorId));
  };
  setStatus = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    response.json(await this.service.setActive(routeId(request), statusSchema.parse(request.body).active, actorId));
  };
}
