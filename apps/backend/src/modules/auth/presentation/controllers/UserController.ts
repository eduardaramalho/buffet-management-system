import type { Request, Response } from "express";
import { z } from "zod";
import type { UserService } from "../../application/UserService.js";

const createSchema = z.object({ name: z.string().min(2).max(150), email: z.string().email(), password: z.string().min(8), roleId: z.string().uuid() });
// ADR 0012: a senha não muda pela edição (users:update também é do gestor e do colaborador).
// strict(): enviar "password" é recusado com 422 em vez de ser ignorado em silêncio.
const updateSchema = z.object({ name: z.string().min(2).max(150).optional(), email: z.string().email().optional() }).strict();
const routeId = (request: Request) => String(request.params.id);

export class UserController {
  constructor(private readonly service: UserService) {}

  list = async (request: Request, response: Response) => {
    const status = request.query.status === "active" || request.query.status === "inactive" ? request.query.status : undefined;
    response.json(await this.service.list({ search: String(request.query.search || "") || undefined, role: String(request.query.role || "") || undefined, status }));
  };

  get = async (request: Request, response: Response) => response.json(await this.service.get(routeId(request)));

  create = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    const input = createSchema.parse(request.body);
    response.status(201).json(await this.service.create(input, actorId));
  };

  update = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    response.json(await this.service.update(routeId(request), updateSchema.parse(request.body), actorId));
  };

  setActive = (isActive: boolean) => async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    response.json(await this.service.setActive(routeId(request), isActive, actorId));
  };

  remove = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    await this.service.remove(routeId(request), actorId);
    response.status(204).send();
  };
}