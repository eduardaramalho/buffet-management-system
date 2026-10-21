import { Router } from "express";
import { authenticate } from "../../../auth/presentation/middlewares/authenticate.js";
import { authorize } from "../../../auth/presentation/middlewares/authorize.js";
import { clientController } from "../../infrastructure/factories/client.factory.js";

export const clientRoutes = Router();
clientRoutes.use(authenticate);
clientRoutes.get("/", authorize("clients:list"), clientController.list);
clientRoutes.get("/:id", authorize("clients:read"), clientController.get);
clientRoutes.post("/", authorize("clients:create"), clientController.create);
clientRoutes.put("/:id", authorize("clients:update"), clientController.update);
clientRoutes.delete("/:id", authorize("clients:delete"), clientController.remove);
