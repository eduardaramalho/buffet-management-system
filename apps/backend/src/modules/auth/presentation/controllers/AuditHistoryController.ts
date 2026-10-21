import type { Request, Response } from "express";
import type { AuditHistoryService } from "../../application/AuditHistoryService.js";

export class AuditHistoryController {
  constructor(private readonly service: AuditHistoryService) {}

  listEventHistory = async (request: Request, response: Response) => {
    response.json(await this.service.listEventHistory(String(request.params.eventId)));
  };
}