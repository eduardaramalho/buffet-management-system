import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { authService, tokenProvider } from "../../infrastructure/factories/auth.factory.js";
import { roleService } from "../../infrastructure/factories/role.factory.js";
import { roleRoutes } from "./role.routes.js";

/**
 * Valida o mapeamento real rota -> permissão do router de papéis (RBAC por permissão, ADR 0001).
 * O banco não é acessado: o token é simulado e o RoleService é espionado.
 */
afterEach(() => { jest.restoreAllMocks(); });

const PERMISSION_ID = "6f1c2b7e-4d1a-4c1e-9b7a-2f3d4e5a6b7c";

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/roles", roleRoutes);
  return app;
};

const authenticateAs = (actorId = "actor-1") =>
  jest.spyOn(tokenProvider, "verifyAccessToken").mockReturnValue({ sub: actorId, email: "admin@buffet.local" } as never);

type Method = "get" | "post" | "put" | "delete";
type ServiceMethod = "list" | "listPermissions" | "get" | "create" | "update" | "remove" | "assignPermission" | "revokePermission";
type RouteCase = { method: Method; path: string; permission: string; service: ServiceMethod; body?: object; status: number };

// Visão tipada do serviço apenas para espionagem: os métodos reais têm assinaturas distintas.
const spyOnService = (method: ServiceMethod) =>
  jest.spyOn(roleService as unknown as Record<ServiceMethod, (...args: unknown[]) => Promise<unknown>>, method);

const routes: RouteCase[] = [
  { method: "get", path: "/roles", permission: "roles:list", service: "list", status: 200 },
  { method: "get", path: "/roles/permissions", permission: "roles:manage-permissions", service: "listPermissions", status: 200 },
  { method: "get", path: "/roles/role-1", permission: "roles:read", service: "get", status: 200 },
  { method: "post", path: "/roles", permission: "roles:create", service: "create", body: { name: "Gestor" }, status: 201 },
  { method: "put", path: "/roles/role-1", permission: "roles:update", service: "update", body: { description: "Coordena" }, status: 200 },
  { method: "delete", path: "/roles/role-1", permission: "roles:delete", service: "remove", status: 204 },
  { method: "post", path: "/roles/role-1/permissions", permission: "roles:manage-permissions", service: "assignPermission", body: { permissionId: PERMISSION_ID }, status: 204 },
  { method: "delete", path: "/roles/role-1/permissions", permission: "roles:manage-permissions", service: "revokePermission", body: { permissionId: PERMISSION_ID }, status: 204 },
];

const send = (route: RouteCase, withToken = true) => {
  const pending = request(buildApp())[route.method](route.path);
  if (withToken) pending.set("Authorization", "Bearer token");
  return pending.send(route.body ?? {});
};

describe("role routes", () => {
  it.each(routes)("$method $path retorna 401 sem token", async (route) => {
    const response = await send(route, false);

    expect(response.status).toBe(401);
  });

  it.each(routes)("$method $path retorna 403 sem $permission e não chega ao serviço", async (route) => {
    authenticateAs();
    const hasPermission = jest.spyOn(authService, "hasPermission").mockResolvedValue(false);
    const service = spyOnService(route.service).mockResolvedValue(undefined);

    const response = await send(route);

    expect(response.status).toBe(403);
    expect(hasPermission).toHaveBeenCalledWith("actor-1", route.permission);
    expect(service).not.toHaveBeenCalled();
  });

  it.each(routes)("$method $path com $permission chega ao serviço", async (route) => {
    authenticateAs();
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    const service = spyOnService(route.service).mockResolvedValue({ id: "role-1" });

    const response = await send(route);

    expect(response.status).toBe(route.status);
    expect(service).toHaveBeenCalledTimes(1);
  });
});
