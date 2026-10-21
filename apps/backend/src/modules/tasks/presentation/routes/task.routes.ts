import { Router } from "express";
import { authenticate } from "../../../auth/presentation/middlewares/authenticate.js";
import { authorize } from "../../../auth/presentation/middlewares/authorize.js";
import { taskController } from "../../infrastructure/factories/task.factory.js";

export const taskRoutes = Router();
taskRoutes.use(authenticate);
taskRoutes.get("/", authorize("tasks:list"), taskController.list);
taskRoutes.get("/:id", authorize("tasks:read"), taskController.get);
taskRoutes.post("/", authorize("tasks:create"), taskController.create);
taskRoutes.put("/:id", authorize("tasks:update"), taskController.update);
taskRoutes.delete("/:id", authorize("tasks:delete"), taskController.remove);
taskRoutes.patch("/:id/status", authorize("tasks:update-status"), taskController.updateStatus);
