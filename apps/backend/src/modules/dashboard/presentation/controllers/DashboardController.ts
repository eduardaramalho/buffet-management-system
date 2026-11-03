import type { Request, Response } from "express";
import type { DashboardService } from "../../application/DashboardService.js";

const queryLimit = (request: Request, fallback: number) => {
  const value = Number(request.query.limit);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  summary = async (_request: Request, response: Response) => response.json(await this.service.getSummary());
  upcomingEvents = async (request: Request, response: Response) => response.json(await this.service.getUpcomingEvents(queryLimit(request, 5)));
  tasksByStatus = async (_request: Request, response: Response) => response.json(await this.service.getTasksByStatus());
}
