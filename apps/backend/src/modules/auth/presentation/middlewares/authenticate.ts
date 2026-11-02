import type { NextFunction, Request, Response } from "express";
import { tokenProvider } from "../../infrastructure/factories/auth.factory.js";
import { AUTH_ERROR_CODES } from "../../domain/password.policy.js";

declare global {
  namespace Express {
    interface Request {
      user?: { sub: string; email: string; mustChangePassword?: boolean };
    }
  }
}

/**
 * Bloqueio seguro por padrão (ADR 0012): toda rota que usa `authenticate` recusa quem ainda precisa
 * trocar a senha temporária. Só as rotas que concluem a troca (perfil e troca de senha) usam
 * `authenticateAllowingPasswordChange`. Assim uma rota nova nasce protegida sem lista de exceções por URL.
 */
const authenticateWith = (allowPendingPasswordChange: boolean) => (request: Request, response: Response, next: NextFunction) => {
  const header = request.header("authorization");
  if (!header?.startsWith("Bearer ")) return response.status(401).json({ message: "Não autenticado" });

  let user: Request["user"];
  try {
    user = tokenProvider.verifyAccessToken(header.slice(7));
  } catch {
    return response.status(401).json({ message: "Token inválido" });
  }

  if (user.mustChangePassword && !allowPendingPasswordChange) {
    return response.status(403).json({ message: "Troque sua senha temporária para continuar", code: AUTH_ERROR_CODES.PASSWORD_CHANGE_REQUIRED });
  }

  request.user = user;
  next();
};

export const authenticate = authenticateWith(false);
export const authenticateAllowingPasswordChange = authenticateWith(true);
