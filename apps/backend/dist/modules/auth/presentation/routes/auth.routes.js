import { Router } from "express";
import { authController } from "../../infrastructure/factories/auth.factory.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
export const createAuthRoutes = (controller = authController) => {
    const authRoutes = Router();
    authRoutes.post("/login", controller.login);
    authRoutes.post("/refresh-token", controller.refresh);
    authRoutes.post("/logout", controller.logout);
    authRoutes.post("/forgot-password", controller.forgotPassword);
    authRoutes.post("/reset-password", controller.resetPassword);
    authRoutes.get("/me", authenticate, authorize("users:read"), controller.me);
    return authRoutes;
};
export const authRoutes = createAuthRoutes();
