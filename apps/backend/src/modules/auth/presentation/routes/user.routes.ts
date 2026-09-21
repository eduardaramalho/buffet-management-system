import { Router } from "express";
import { userController } from "../../infrastructure/factories/user.factory.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

export const userRoutes = Router();
userRoutes.use(authenticate);
userRoutes.get("/", authorize("users:list"), userController.list);
userRoutes.get("/:id", authorize("users:read"), userController.get);
userRoutes.post("/", authorize("users:create"), userController.create);
userRoutes.put("/:id", authorize("users:update"), userController.update);
userRoutes.delete("/:id", authorize("users:delete"), userController.remove);
userRoutes.patch("/:id/activate", authorize("users:update"), userController.setActive(true));
userRoutes.patch("/:id/deactivate", authorize("users:update"), userController.setActive(false));