import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
export class JwtTokenProvider {
    secret;
    accessTokenTtl;
    constructor(secret, accessTokenTtl = "15m") {
        this.secret = secret;
        this.accessTokenTtl = accessTokenTtl;
    }
    createAccessToken(payload) {
        return jwt.sign(payload, this.secret, { expiresIn: this.accessTokenTtl });
    }
    createRefreshToken() {
        return randomBytes(48).toString("base64url");
    }
    verifyAccessToken(token) {
        const payload = jwt.verify(token, this.secret);
        if (typeof payload === "string" || !payload.sub || typeof payload.email !== "string")
            throw new Error("Token inválido");
        return { sub: payload.sub, email: payload.email };
    }
}
