import type { Request, Response } from "express";
import { z } from "zod";
import { teamSpecialties } from "../../domain/team.types.js";
import type { TeamService } from "../../application/TeamService.js";

const teamSchema = z.object({
  name: z.string().min(1).max(150),
  specialty: z.enum(teamSpecialties),
  observations: z.string().max(2000).nullable().optional().default(null),
});
const updateSchema = teamSchema.partial();
const memberSchema = z.object({ collaboratorId: z.string().min(1), isLeader: z.boolean().default(false) });
const listSchema = z.object({
  search: z.string().optional(),
  specialty: z.enum(teamSpecialties).optional(),
  status: z.enum(["ATIVA", "INATIVA"]).optional(),
});
const routeId = (request: Request) => String(request.params.id);

export class TeamController {
  constructor(private readonly service: TeamService) {}

  list = async (request: Request, response: Response) => response.json(await this.service.list(listSchema.parse(request.query)));
  get = async (request: Request, response: Response) => response.json(await this.service.get(routeId(request)));
  create = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    response.status(201).json(await this.service.create({ ...teamSchema.parse(request.body), createdById: actorId }));
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
  addMember = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    const input = memberSchema.parse(request.body);
    response.json(await this.service.addMember(routeId(request), input.collaboratorId, input.isLeader, actorId));
  };
  removeMember = async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    await this.service.removeMember(routeId(request), String(request.params.collaboratorId), actorId);
    response.status(204).send();
  };
  setActive = (active: boolean) => async (request: Request, response: Response) => {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    response.json(await this.service.setActive(routeId(request), active, actorId));
  };
}
