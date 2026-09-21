import type { Request, Response } from "express";
import type { EventTeamService } from "../../application/EventTeamService.js";

const actorId = (request: Request) => request.user?.sub;

export class EventTeamController {
  constructor(private readonly service: EventTeamService) {}

  assignTeamToEvent = async (request: Request, response: Response) => {
    const userId = actorId(request);
    if (!userId) return response.status(401).json({ message: "Não autenticado" });
    const assignment = await this.service.assignTeamToEvent(String(request.params.eventId), String(request.params.teamId), userId);
    response.status(201).json(assignment);
  };

  unassignTeamFromEvent = async (request: Request, response: Response) => {
    const userId = actorId(request);
    if (!userId) return response.status(401).json({ message: "Não autenticado" });
    await this.service.unassignTeamFromEvent(String(request.params.eventId), String(request.params.teamId), userId);
    response.status(204).send();
  };

  listTeamsByEvent = async (request: Request, response: Response) => response.json(
    await this.service.listTeamsByEvent(String(request.params.eventId)),
  );

  listEventsByTeam = async (request: Request, response: Response) => response.json(
    await this.service.listEventsByTeam(String(request.params.teamId)),
  );
}
