import { Router } from "express";
import { authenticate } from "../../../auth/presentation/middlewares/authenticate.js";
import { authorize } from "../../../auth/presentation/middlewares/authorize.js";
import { taskCommentController, taskController } from "../../infrastructure/factories/task.factory.js";

export const taskRoutes = Router();
taskRoutes.use(authenticate);
taskRoutes.get("/", authorize("tasks:list"), taskController.list);
taskRoutes.get("/:id", authorize("tasks:read"), taskController.get);
taskRoutes.post("/", authorize("tasks:create"), taskController.create);
taskRoutes.put("/:id", authorize("tasks:update"), taskController.update);
taskRoutes.delete("/:id", authorize("tasks:delete"), taskController.remove);
taskRoutes.patch("/:id/status", authorize("tasks:update-status"), taskController.updateStatus);
// ADR 0017: reading comments comes with reading the task; writing one is its own permission.
taskRoutes.get("/:id/comments", authorize("tasks:read"), taskCommentController.list);
taskRoutes.post("/:id/comments", authorize("tasks:comment"), taskCommentController.create);
