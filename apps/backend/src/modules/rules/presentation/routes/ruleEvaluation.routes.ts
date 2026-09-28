import { Router } from "express";
import { authenticate } from "../../../auth/presentation/middlewares/authenticate.js";
import { authorize } from "../../../auth/presentation/middlewares/authorize.js";
import { ruleEvaluationController } from "../../infrastructure/factories/rule.factory.js";

// Mounted at /api/v1/events alongside (not instead of) the Events module's own router — the
// path shape (/:eventId/rule-matches) never collides with Events' own single-segment routes.
export const ruleEvaluationRoutes = Router();
ruleEvaluationRoutes.use(authenticate);
ruleEvaluationRoutes.get("/:eventId/rule-matches", authorize("rules:evaluate"), ruleEvaluationController.getMatches);
