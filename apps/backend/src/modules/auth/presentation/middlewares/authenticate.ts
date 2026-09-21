import type { NextFunction, Request, Response } from "express";
import { tokenProvider } from "../../infrastructure/factories/auth.factory.js";

declare global {
  namespace Express {
    interface Request {
      user?: { sub: string; email: string };
    }
  }
}

export const authenticate = (request: Request, response: Response, next: NextFunction) => {
  const header = request.header("authorization");
  if (!header?.startsWith("Bearer ")) return response.status(401).json({ message: "Não autenticado" });

  try {
    request.user = tokenProvider.verifyAccessToken(header.slice(7));
    next();
  } catch {
    response.status(401).json({ message: "Token inválido" });
  }
};