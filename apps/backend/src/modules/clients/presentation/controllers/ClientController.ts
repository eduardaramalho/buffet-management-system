import type { Request, Response } from "express";
import { z } from "zod";
import { clientTypes } from "../../domain/client.types.js";
import type { ClientService } from "../../application/ClientService.js";

// Base sem defaults: o .partial() do Zod 4 mantém .default(), o que sobrescreveria campos omitidos no PUT.
// Formato e dígitos do documento são regra de domínio (dependem do tipo atual no update), validados no service.
const clientBaseSchema = z.object({
  type: z.enum(clientTypes),
  name: z.string().min(1).max(150),
  document: z.string().max(18).nullable().optional(),
  email: z.email().max(150).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
const createSchema = clientBaseSchema.extend({
  document: clientBaseSchema.shape.document.default(null),
  email: clientBaseSchema.shape.email.default(null),
  phone: clientBaseSchema.shape.phone.default(null),
  notes: clientBaseSchema.shape.notes.default(null),
});
const updateSchema = clientBaseSchema.partial();
const listSchema = z.object({ search: z.string().max(100).optional() });
const routeId = (request: Request) => String(request.params.id);

export class ClientController {
  constructor(private readonly service: ClientService) {}

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
}
