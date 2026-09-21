import type { Request, Response } from "express";
import { z } from "zod";
import type { ServiceCatalogService } from "../../application/ServiceCatalogService.js";

const serviceSchema = z.object({ name: z.string().min(1).max(100), isCustom: z.boolean().default(false) });
const routeId = (request: Request) => String(request.params.id);

export class ServiceController {
  constructor(private readonly service: ServiceCatalogService) {}

  list = async (_request: Request, response: Response) => response.json(await this.service.list());
  get = async (request: Request, response: Response) => response.json(await this.service.get(routeId(request)));
  create = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    response.status(201).json(await this.service.create(serviceSchema.parse(request.body), actorId));
  };
  update = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    response.json(await this.service.update(routeId(request), serviceSchema.partial().parse(request.body), actorId));
  };
  remove = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    await this.service.remove(routeId(request), actorId);
    response.status(204).send();
  };
}