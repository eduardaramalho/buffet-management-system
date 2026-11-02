import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { AccessTokenPayload, TokenProvider } from "../../domain/auth.types.js";

export class JwtTokenProvider implements TokenProvider {
  constructor(private readonly secret: string, private readonly accessTokenTtl: string | number = "15m") {}

  createAccessToken(payload: AccessTokenPayload) {
    return jwt.sign(payload, this.secret, { expiresIn: this.accessTokenTtl as jwt.SignOptions["expiresIn"] });
  }

  createRefreshToken() {
    return randomBytes(48).toString("base64url");
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const payload = jwt.verify(token, this.secret);
    if (typeof payload === "string" || !payload.sub || typeof payload.email !== "string") throw new Error("Token inválido");
    // Tokens emitidos antes da claim existir não têm troca pendente; só `true` explícito bloqueia.
    return { sub: payload.sub, email: payload.email, mustChangePassword: payload.mustChangePassword === true };
  }
}
