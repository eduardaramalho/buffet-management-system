import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { auditHistoryController } from "../../infrastructure/factories/audit.factory.js";

export const auditRoutes = Router();
auditRoutes.use(authenticate);
auditRoutes.get("/:eventId/history", authorize("audit:read"), auditHistoryController.listEventHistory);