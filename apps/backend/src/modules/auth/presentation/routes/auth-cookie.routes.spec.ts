import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { describe, expect, it, jest } from "@jest/globals";
import { AuthError, type AuthService } from "../../application/AuthService.js";
import { AuthController } from "../controllers/AuthController.js";
import { RefreshTokenCookie } from "../refreshTokenCookie.js";
import { errorHandler } from "../../../../shared/middlewares/errorHandler.js";
import { createAuthRoutes } from "./auth.routes.js";

/**
 * Contrato HTTP do refresh token em cookie httpOnly (ADR 0020), com os routers reais e o service simulado.
 */
const user = { id: "u1", name: "Bia", email: "bia@buffet.com", mustChangePassword: false };
const buildApp = (service: Partial<Record<keyof AuthService, unknown>>, secure = true) => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/v1/auth", createAuthRoutes(new AuthController(service as unknown as AuthService, new RefreshTokenCookie({ secure, maxAgeMs: 604800000 }))));
  app.use(errorHandler);
  return app;
};
type AnyFn = (...args: unknown[]) => Promise<unknown>;
const setCookie = (response: request.Response) => ([] as string[]).concat(response.headers["set-cookie"] ?? []).join("\n");

describe("refresh token cookie on the auth routes", () => {
  it("sets an httpOnly, Secure, SameSite=Strict cookie on login and never returns the token in the body", async () => {
    const app = buildApp({ login: jest.fn(async () => ({ accessToken: "access", refreshToken: "opaque", user })) });

    const response = await request(app).post("/api/v1/auth/login").send({ email: "bia@buffet.com", password: "Senha12345" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ accessToken: "access", user });
    expect(JSON.stringify(response.body)).not.toContain("opaque");
    const header = setCookie(response);
    expect(header).toContain("eventospro_rt=opaque");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=Strict");
    expect(header).toContain("Path=/api/v1/auth");
    expect(header).toContain("Max-Age=604800");
  });

  it("omits Secure when the configuration turns it off for local HTTP", async () => {
    const app = buildApp({ login: jest.fn(async () => ({ accessToken: "access", refreshToken: "opaque", user })) }, false);

    const response = await request(app).post("/api/v1/auth/login").send({ email: "bia@buffet.com", password: "Senha12345" });

    expect(setCookie(response)).not.toContain("Secure");
  });

  it("renews the session from the cookie alone and rotates it", async () => {
    const refresh = jest.fn<AnyFn>(async () => ({ accessToken: "access2", refreshToken: "opaque2", user }));
    const app = buildApp({ refresh });

    const response = await request(app).post("/api/v1/auth/refresh-token").set("Cookie", "eventospro_rt=opaque").send();

    expect(response.status).toBe(200);
    expect(refresh).toHaveBeenCalledWith("opaque", expect.anything());
    expect(response.body).toEqual({ accessToken: "access2", user });
    expect(setCookie(response)).toContain("eventospro_rt=opaque2");
  });

  it("ignores a refresh token sent in the body, as in the old contract", async () => {
    const refresh = jest.fn();
    const app = buildApp({ refresh });

    const response = await request(app).post("/api/v1/auth/refresh-token").send({ refreshToken: "opaque" });

    expect(response.status).toBe(400);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("clears the cookie when the refresh token is invalid", async () => {
    const app = buildApp({ refresh: jest.fn(async () => { throw new AuthError("Refresh token inválido"); }) });

    const response = await request(app).post("/api/v1/auth/refresh-token").set("Cookie", "eventospro_rt=revoked").send();

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Refresh token inválido" });
    expect(setCookie(response)).toMatch(/eventospro_rt=;.*Expires=Thu, 01 Jan 1970/);
  });

  it("revokes the session and clears the cookie on logout", async () => {
    const logout = jest.fn<AnyFn>(async () => undefined);
    const app = buildApp({ logout });

    const response = await request(app).post("/api/v1/auth/logout").set("Cookie", "eventospro_rt=opaque").send();

    expect(response.status).toBe(204);
    expect(logout).toHaveBeenCalledWith("opaque");
    expect(setCookie(response)).toMatch(/eventospro_rt=;.*Path=\/api\/v1\/auth/);
  });
});
