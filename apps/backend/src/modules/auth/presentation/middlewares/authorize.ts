import type { NextFunction, Request, Response } from "express";
import { authService } from "../../infrastructure/factories/auth.factory.js";

export const authorize = (permissionKey: string) => async (request: Request, response: Response, next: NextFunction) => {
  const userId = request.user?.sub;
  if (!userId) return response.status(401).json({ message: "Não autenticado" });

  if (!(await authService.hasPermission(userId, permissionKey))) {
    return response.status(403).json({ message: "Permissão insuficiente" });
  }

  next();
};