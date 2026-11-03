import { Router } from "express";
import { authenticate } from "../../../auth/presentation/middlewares/authenticate.js";
import { authorize } from "../../../auth/presentation/middlewares/authorize.js";
import { dashboardController } from "../../infrastructure/dashboard.factory.js";

export const dashboardRoutes = Router();
dashboardRoutes.use(authenticate, authorize("dashboard:view"));
dashboardRoutes.get("/summary", dashboardController.summary);
dashboardRoutes.get("/upcoming-events", dashboardController.upcomingEvents);
dashboardRoutes.get("/tasks-by-status", dashboardController.tasksByStatus);
