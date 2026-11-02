import { Router } from "express";
import { authController } from "../../infrastructure/factories/auth.factory.js";
import { authenticateAllowingPasswordChange } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

export const createAuthRoutes = (controller = authController) => {
	const authRoutes = Router();

	authRoutes.post("/login", controller.login);
	authRoutes.post("/refresh-token", controller.refresh);
	authRoutes.post("/logout", controller.logout);
	// Rotas liberadas durante a troca obrigatória de senha (ADR 0012): o frontend precisa restaurar o perfil e concluir a troca.
	authRoutes.get("/me", authenticateAllowingPasswordChange, authorize("users:read"), controller.me);
	// Sem authorize: trocar a própria senha é operação sobre a própria conta. Exigir permissão
	// trancaria para fora um papel sem ela no meio da troca obrigatória.
	authRoutes.post("/change-password", authenticateAllowingPasswordChange, controller.changePassword);
	return authRoutes;
};

export const authRoutes = createAuthRoutes();