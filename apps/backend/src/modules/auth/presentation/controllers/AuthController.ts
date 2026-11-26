import type { Request, Response } from "express";
import { z } from "zod";
import { AuthError, AuthService } from "../../application/AuthService.js";
import { PASSWORD_MIN_LENGTH } from "../../domain/password.policy.js";
import type { RefreshTokenCookie } from "../refreshTokenCookie.js";

const credentialsSchema = z.object({ email: z.string().email(), password: z.string().min(PASSWORD_MIN_LENGTH) });
const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1), newPassword: z.string().min(PASSWORD_MIN_LENGTH) })
  .refine((input) => input.currentPassword !== input.newPassword, { message: "A nova senha precisa ser diferente da atual", path: ["newPassword"] });

type IssuedSession = Awaited<ReturnType<AuthService["login"]>>;

export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly refreshTokenCookie: RefreshTokenCookie
  ) {}

  login = async (request: Request, response: Response) => {
    const input = credentialsSchema.parse(request.body);
    this.respondWithSession(response, await this.service.login(input.email, input.password, request.ip));
  };

  refresh = async (request: Request, response: Response) => {
    const refreshToken = this.refreshTokenCookie.read(request);
    try {
      if (!refreshToken) throw new AuthError("Sessão expirada");
      this.respondWithSession(response, await this.service.refresh(refreshToken, request.ip));
    } catch (error) {
      // Token ausente, revogado ou expirado: apagar o cookie evita que o navegador continue enviando um token morto.
      if (error instanceof AuthError) this.refreshTokenCookie.clear(response);
      throw error;
    }
  };

  logout = async (request: Request, response: Response) => {
    const refreshToken = this.refreshTokenCookie.read(request);
    if (refreshToken) await this.service.logout(refreshToken);
    this.refreshTokenCookie.clear(response);
    response.status(204).send();
  };

  changePassword = async (request: Request, response: Response) => {
    const userId = request.user?.sub;
    if (!userId) return response.status(401).json({ message: "Não autenticado" });
    const input = changePasswordSchema.parse(request.body);
    this.respondWithSession(response, await this.service.changePassword(userId, input.currentPassword, input.newPassword, request.ip));
  };

  me = async (request: Request, response: Response) => {
    const userId = request.user?.sub;
    if (!userId) return response.status(401).json({ message: "Não autenticado" });
    response.json(await this.service.me(userId));
  };

  // O refresh token vai só no cookie httpOnly (ADR 0020); o corpo leva o access token, que fica em memória no frontend.
  private respondWithSession(response: Response, { refreshToken, accessToken, user }: IssuedSession) {
    this.refreshTokenCookie.write(response, refreshToken);
    response.json({ accessToken, user });
  }
}

export const authErrorStatus = (error: unknown) => error instanceof AuthError ? 401 : 400;
