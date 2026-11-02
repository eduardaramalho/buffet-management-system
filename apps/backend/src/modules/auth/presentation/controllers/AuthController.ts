import type { Request, Response } from "express";
import { z } from "zod";
import { AuthError, AuthService } from "../../application/AuthService.js";
import { PASSWORD_MIN_LENGTH } from "../../domain/password.policy.js";

const credentialsSchema = z.object({ email: z.string().email(), password: z.string().min(PASSWORD_MIN_LENGTH) });
const refreshSchema = z.object({ refreshToken: z.string().min(1) });
const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1), newPassword: z.string().min(PASSWORD_MIN_LENGTH) })
  .refine((input) => input.currentPassword !== input.newPassword, { message: "A nova senha precisa ser diferente da atual", path: ["newPassword"] });

export class AuthController {
  constructor(private readonly service: AuthService) {}

  login = async (request: Request, response: Response) => {
    const input = credentialsSchema.parse(request.body);
    const result = await this.service.login(input.email, input.password, request.ip);
    response.json(result);
  };

  refresh = async (request: Request, response: Response) => {
    const input = refreshSchema.parse(request.body);
    const result = await this.service.refresh(input.refreshToken, request.ip);
    response.json(result);
  };

  logout = async (request: Request, response: Response) => {
    const input = refreshSchema.parse(request.body);
    await this.service.logout(input.refreshToken);
    response.status(204).send();
  };

  changePassword = async (request: Request, response: Response) => {
    const userId = request.user?.sub;
    if (!userId) return response.status(401).json({ message: "Não autenticado" });
    const input = changePasswordSchema.parse(request.body);
    response.json(await this.service.changePassword(userId, input.currentPassword, input.newPassword, request.ip));
  };

  me = async (request: Request, response: Response) => {
    const userId = request.user?.sub;
    if (!userId) return response.status(401).json({ message: "Não autenticado" });
    response.json(await this.service.me(userId));
  };
}

export const authErrorStatus = (error: unknown) => error instanceof AuthError ? 401 : 400;