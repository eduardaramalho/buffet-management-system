import { Router } from "express";
import { authenticate } from "../../../auth/presentation/middlewares/authenticate.js";
import { authorize } from "../../../auth/presentation/middlewares/authorize.js";
import { ruleController } from "../../infrastructure/factories/rule.factory.js";

export const ruleRoutes = Router();
ruleRoutes.use(authenticate);
ruleRoutes.get("/", authorize("rules:list"), ruleController.list);
ruleRoutes.get("/:id", authorize("rules:read"), ruleController.get);
ruleRoutes.post("/", authorize("rules:create"), ruleController.create);
ruleRoutes.put("/:id", authorize("rules:update"), ruleController.update);
ruleRoutes.delete("/:id", authorize("rules:delete"), ruleController.remove);
ruleRoutes.patch("/:id/activate", authorize("rules:update"), ruleController.setActive(true));
ruleRoutes.patch("/:id/deactivate", authorize("rules:update"), ruleController.setActive(false));
