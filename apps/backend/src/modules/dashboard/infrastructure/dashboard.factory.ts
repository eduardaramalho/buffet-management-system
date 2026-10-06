import { prisma } from "../../../shared/config/database.js";
import { DashboardService } from "../application/DashboardService.js";
import { DashboardController } from "../presentation/controllers/DashboardController.js";

export const dashboardService = new DashboardService(prisma);
export const dashboardController = new DashboardController(dashboardService);
