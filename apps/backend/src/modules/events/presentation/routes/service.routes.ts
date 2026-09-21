import { Router } from "express";
import { serviceController } from "../../infrastructure/factories/event.factory.js";
import { authenticate } from "../../../auth/presentation/middlewares/authenticate.js";
import { authorize } from "../../../auth/presentation/middlewares/authorize.js";

export const serviceRoutes = Router();
serviceRoutes.use(authenticate);
serviceRoutes.get("/", authorize("services:list"), serviceController.list);
serviceRoutes.get("/:id", authorize("services:read"), serviceController.get);
serviceRoutes.post("/", authorize("services:create"), serviceController.create);
serviceRoutes.put("/:id", authorize("services:update"), serviceController.update);
serviceRoutes.delete("/:id", authorize("services:delete"), serviceController.remove);