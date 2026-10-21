import type { Request, Response } from "express";
import { z } from "zod";
import { eventStatuses, eventTypes } from "../../../events/domain/event.types.js";
import { taskStatuses } from "../../../tasks/domain/task.types.js";
import { exportFormats, taskOrigins } from "../../domain/report.types.js";
import type { ExportRequest, ReportService } from "../../application/ReportService.js";

// Caps the amount of data a single query or export can touch (protects the database and the PDF size).
export const MAX_PERIOD_DAYS = 366;
const MAX_PERIOD_MS = MAX_PERIOD_DAYS * 24 * 60 * 60 * 1000;

const idSchema = z.string().min(1).max(36);
const periodShape = { from: z.coerce.date(), to: z.coerce.date() };
const pageShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};
const formatShape = { format: z.enum(exportFormats) };
const eventFilterShape = { status: z.enum(eventStatuses).optional(), serviceType: z.enum(eventTypes).optional(), clientId: idSchema.optional() };
const taskFilterShape = { status: z.enum(taskStatuses).optional(), teamId: idSchema.optional(), origin: z.enum(taskOrigins).optional() };

// Period rules are applied to each final schema (Zod 4 forbids .extend() on refined objects).
function withPeriodRules<T extends z.ZodObject<typeof periodShape>>(schema: T) {
  return schema.superRefine((value, context) => {
    const span = value.to.getTime() - value.from.getTime();
    if (span < 0) context.addIssue({ code: "custom", path: ["to"], message: "A data final deve ser igual ou posterior à data inicial" });
    if (span > MAX_PERIOD_MS) context.addIssue({ code: "custom", path: ["to"], message: `O período deve ter no máximo ${MAX_PERIOD_DAYS} dias` });
  });
}

const eventsSchema = withPeriodRules(z.object({ ...periodShape, ...eventFilterShape, ...pageShape }));
const tasksSchema = withPeriodRules(z.object({ ...periodShape, ...taskFilterShape, ...pageShape }));
const teamsSchema = withPeriodRules(z.object(periodShape));
const eventsExportSchema = withPeriodRules(z.object({ ...periodShape, ...eventFilterShape, ...formatShape }));
const tasksExportSchema = withPeriodRules(z.object({ ...periodShape, ...taskFilterShape, ...formatShape }));
const teamsExportSchema = withPeriodRules(z.object({ ...periodShape, ...formatShape }));

export class ReportController {
  constructor(private readonly service: ReportService) {}

  events = async (request: Request, response: Response) => {
    const { page, pageSize, ...filter } = eventsSchema.parse(request.query);
    response.json(await this.service.eventsReport(filter, { page, pageSize }));
  };

  tasks = async (request: Request, response: Response) => {
    const { page, pageSize, ...filter } = tasksSchema.parse(request.query);
    response.json(await this.service.tasksReport(filter, { page, pageSize }));
  };

  teamsPerformance = async (request: Request, response: Response) => {
    response.json(await this.service.teamPerformanceReport(teamsSchema.parse(request.query)));
  };

  exportEvents = async (request: Request, response: Response) => {
    const { format, ...filter } = eventsExportSchema.parse(request.query);
    await this.sendExport(request, response, { kind: "events", filter }, format);
  };

  exportTasks = async (request: Request, response: Response) => {
    const { format, ...filter } = tasksExportSchema.parse(request.query);
    await this.sendExport(request, response, { kind: "tasks", filter }, format);
  };

  exportTeamsPerformance = async (request: Request, response: Response) => {
    const { format, ...filter } = teamsExportSchema.parse(request.query);
    await this.sendExport(request, response, { kind: "teams-performance", filter }, format);
  };

  private async sendExport(request: Request, response: Response, exportRequest: ExportRequest, format: (typeof exportFormats)[number]) {
    const actorId = request.user?.sub;
    if (!actorId) return response.status(401).json({ message: "Não autenticado" });
    const file = await this.service.exportReport(exportRequest, format, actorId);
    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    // Reports carry personal data (client names): browsers and proxies must not cache them.
    response.setHeader("Cache-Control", "no-store");
    response.send(file.content);
  }
}
