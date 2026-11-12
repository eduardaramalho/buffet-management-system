import { Router } from "express";
import { userController, userPasswordController } from "../../infrastructure/factories/user.factory.js";
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
// ADR 0012: admin ou gestor (ADR 0018) gera uma senha temporária; o usuário é obrigado a trocá-la no próximo login.
userRoutes.post("/:id/reset-password", authorize("users:reset-password"), userPasswordController.reset);
