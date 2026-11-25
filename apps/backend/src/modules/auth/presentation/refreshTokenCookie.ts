import type { CookieOptions, Request, Response } from "express";

export const REFRESH_TOKEN_COOKIE_NAME = "eventospro_rt";
/** Só as rotas de autenticação recebem o cookie: as demais requisições da API não carregam o refresh token. */
export const REFRESH_TOKEN_COOKIE_PATH = "/api/v1/auth";

type RefreshTokenCookieOptions = { secure: boolean; maxAgeMs: number };

/**
 * Transporte do refresh token em cookie httpOnly (ADR 0020). O JavaScript da página não lê o cookie,
 * o que tira o token do alcance de um XSS, e SameSite=Strict impede que outro site dispare o refresh ou o logout.
 */
export class RefreshTokenCookie {
  constructor(private readonly options: RefreshTokenCookieOptions) {}

  write(response: Response, refreshToken: string) {
    response.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, { ...this.attributes(), maxAge: this.options.maxAgeMs });
  }

  // O navegador só remove o cookie se nome, Path e demais atributos baterem com os usados na gravação.
  clear(response: Response) {
    response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, this.attributes());
  }

  read(request: Request): string | undefined {
    const value: unknown = request.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private attributes(): CookieOptions {
    return { httpOnly: true, secure: this.options.secure, sameSite: "strict", path: REFRESH_TOKEN_COOKIE_PATH };
  }
}
