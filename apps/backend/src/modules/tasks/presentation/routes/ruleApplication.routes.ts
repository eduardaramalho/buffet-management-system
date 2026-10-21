import { Router } from "express";
import { authenticate } from "../../../auth/presentation/middlewares/authenticate.js";
import { authorize } from "../../../auth/presentation/middlewares/authorize.js";
import { ruleApplicationController } from "../../infrastructure/factories/task.factory.js";

// Mounted at /api/v1/events alongside (not instead of) the Events module's own router, same
// convention as the Rules module's ruleEvaluation.routes.ts.
export const ruleApplicationRoutes = Router();
ruleApplicationRoutes.use(authenticate);
ruleApplicationRoutes.get("/:eventId/rule-applications", authorize("rules:read"), ruleApplicationController.list);
ruleApplicationRoutes.post("/:eventId/apply-rules", authorize("rules:apply"), ruleApplicationController.apply);
