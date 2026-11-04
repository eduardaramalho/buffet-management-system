import { Router } from "express";
import { authController } from "../../infrastructure/factories/auth.factory.js";
import { authenticateAllowingPasswordChange } from "../middlewares/authenticate.js";

export const createAuthRoutes = (controller = authController) => {
	const authRoutes = Router();

	authRoutes.post("/login", controller.login);
	authRoutes.post("/refresh-token", controller.refresh);
	authRoutes.post("/logout", controller.logout);
	// Rotas liberadas durante a troca obrigatória de senha (ADR 0012): o frontend precisa restaurar o perfil e concluir a troca.
	// Sem authorize (ADR 0013, atualização de 03/11/2026): ler o próprio perfil é operação sobre a própria conta.
	// Exigir users:read obrigava a dar a todo papel a leitura de qualquer usuário em GET /users/:id.
	authRoutes.get("/me", authenticateAllowingPasswordChange, controller.me);
	// Sem authorize: trocar a própria senha é operação sobre a própria conta. Exigir permissão
	// trancaria para fora um papel sem ela no meio da troca obrigatória.
	authRoutes.post("/change-password", authenticateAllowingPasswordChange, controller.changePassword);
	return authRoutes;
};

export const authRoutes = createAuthRoutes();