import { Router } from "express";
import { authenticate } from "../../../auth/presentation/middlewares/authenticate.js";
import { authorize } from "../../../auth/presentation/middlewares/authorize.js";
import { reportController } from "../../infrastructure/factories/report.factory.js";

export const reportRoutes = Router();
reportRoutes.use(authenticate, authorize("reports:view"));
reportRoutes.get("/events", reportController.events);
reportRoutes.get("/events/export", reportController.exportEvents);
reportRoutes.get("/tasks", reportController.tasks);
reportRoutes.get("/tasks/export", reportController.exportTasks);
reportRoutes.get("/teams-performance", reportController.teamsPerformance);
reportRoutes.get("/teams-performance/export", reportController.exportTeamsPerformance);
