import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { authService, tokenProvider } from "../../infrastructure/factories/auth.factory.js";
import { userPasswordService } from "../../infrastructure/factories/user.factory.js";
import { errorHandler } from "../../../../shared/middlewares/errorHandler.js";
import { authRoutes } from "./auth.routes.js";
import { userRoutes } from "./user.routes.js";

/**
 * Valida as rotas da redefinição administrativa e da troca obrigatória de senha (ADR 0012)
 * com os routers reais. O banco não é acessado: token, permissão e services são simulados.
 */
afterEach(() => { jest.restoreAllMocks(); });

const USER_ID = "6f1c2b7e-4d1a-4c1e-9b7a-2f3d4e5a6b7c";
const session = { accessToken: "a", refreshToken: "r", user: { id: "u1", name: "Bia", email: "bia@buffet.com", mustChangePassword: false } };

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRoutes);
  app.use("/users", userRoutes);
  app.use(errorHandler);
  return app;
};

const tokenFor = (mustChangePassword: boolean) =>
  jest.spyOn(tokenProvider, "verifyAccessToken").mockReturnValue({ sub: "u1", email: "bia@buffet.com", mustChangePassword });

describe("POST /users/:id/reset-password", () => {
  it("requires the users:reset-password permission", async () => {
    tokenFor(false);
    jest.spyOn(authService, "hasPermission").mockResolvedValue(false);
    const reset = jest.spyOn(userPasswordService, "resetByAdmin");

    const response = await request(buildApp()).post(`/users/${USER_ID}/reset-password`).set("Authorization", "Bearer t");

    expect(response.status).toBe(403);
    expect(authService.hasPermission).toHaveBeenCalledWith("u1", "users:reset-password");
    expect(reset).not.toHaveBeenCalled();
  });

  it("returns the temporary password to an authorized actor", async () => {
    tokenFor(false);
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    jest.spyOn(userPasswordService, "resetByAdmin").mockResolvedValue({ temporaryPassword: "Abcd2345efgh", expiresAt: new Date("2026-10-28T12:00:00.000Z") });

    const response = await request(buildApp()).post(`/users/${USER_ID}/reset-password`).set("Authorization", "Bearer t");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ temporaryPassword: "Abcd2345efgh", expiresAt: "2026-10-28T12:00:00.000Z" });
  });
});

describe("pending password change", () => {
  it("blocks other protected routes with PASSWORD_CHANGE_REQUIRED", async () => {
    tokenFor(true);
    const hasPermission = jest.spyOn(authService, "hasPermission").mockResolvedValue(true);

    const response = await request(buildApp()).get("/users").set("Authorization", "Bearer t");

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect(hasPermission).not.toHaveBeenCalled();
  });

  it("still serves the profile so the frontend can restore the session", async () => {
    tokenFor(true);
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    jest.spyOn(authService, "me").mockResolvedValue({ id: "u1", name: "Bia", email: "bia@buffet.com", mustChangePassword: true, roles: [] });

    const response = await request(buildApp()).get("/auth/me").set("Authorization", "Bearer t");

    expect(response.status).toBe(200);
    expect(response.body.mustChangePassword).toBe(true);
  });

  // ADR 0013 (atualização): o próprio perfil não exige permissão. Antes exigia users:read, que também abria GET /users/:id de qualquer pessoa.
  it("serves the own profile without asking for any permission", async () => {
    tokenFor(false);
    const hasPermission = jest.spyOn(authService, "hasPermission");
    jest.spyOn(authService, "me").mockResolvedValue({ id: "u1", name: "Bia", email: "bia@buffet.com", mustChangePassword: false, roles: [] });

    const response = await request(buildApp()).get("/auth/me").set("Authorization", "Bearer t");

    expect(response.status).toBe(200);
    expect(hasPermission).not.toHaveBeenCalled();
  });

  it("allows the password change and needs no extra permission", async () => {
    tokenFor(true);
    const hasPermission = jest.spyOn(authService, "hasPermission");
    const change = jest.spyOn(authService, "changePassword").mockResolvedValue(session);

    const response = await request(buildApp())
      .post("/auth/change-password")
      .set("Authorization", "Bearer t")
      .send({ currentPassword: "Abcd2345efgh", newPassword: "NovaSenha123" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(session);
    expect(change).toHaveBeenCalledWith("u1", "Abcd2345efgh", "NovaSenha123", expect.anything());
    expect(hasPermission).not.toHaveBeenCalled();
  });

  it("requires authentication to change the password", async () => {
    const response = await request(buildApp()).post("/auth/change-password").send({ currentPassword: "x", newPassword: "NovaSenha123" });

    expect(response.status).toBe(401);
  });
});
