import type { Request, Response } from "express";
import { z } from "zod";
import { AuthError, AuthService } from "../../application/AuthService.js";

const credentialsSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const refreshSchema = z.object({ refreshToken: z.string().min(1) });
const forgotPasswordSchema = z.object({ email: z.string().email() });
const resetPasswordSchema = z.object({ token: z.string().min(1), password: z.string().min(8) });

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

  forgotPassword = async (request: Request, response: Response) => {
    await this.service.forgotPassword(forgotPasswordSchema.parse(request.body).email);
    response.json({ message: "Se o e-mail existir, as instruções foram enviadas" });
  };

  resetPassword = async (request: Request, response: Response) => {
    const input = resetPasswordSchema.parse(request.body);
    await this.service.resetPassword(input.token, input.password);
    response.json({ message: "Senha redefinida com sucesso" });
  };

  me = async (request: Request, response: Response) => {
    const userId = request.user?.sub;
    if (!userId) return response.status(401).json({ message: "Não autenticado" });
    response.json(await this.service.me(userId));
  };
}

export const authErrorStatus = (error: unknown) => error instanceof AuthError ? 401 : 400;