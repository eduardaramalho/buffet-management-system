import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { authService } from "../../../auth/infrastructure/factories/auth.factory.js";
import { authorize } from "../../../auth/presentation/middlewares/authorize.js";

const permissionKeys = ["tasks:list", "tasks:read", "tasks:update-status", "tasks:create", "tasks:update", "tasks:delete", "tasks:comment", "rules:apply", "rules:read"] as const;

afterEach(() => { jest.restoreAllMocks(); });

describe("task/rule-application permissions", () => {
  it.each(permissionKeys)("returns 403 without %s", async (permissionKey) => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(false);
    const app = express();
    app.use((req, _res, next) => {
      req.user = { sub: "actor-1", email: "admin@buffet.local" };
      next();
    });
    app.get("/protected", authorize(permissionKey), (_req, response) => response.sendStatus(204));

    const response = await request(app).get("/protected");

    expect(response.status).toBe(403);
    expect(authService.hasPermission).toHaveBeenCalledWith("actor-1", permissionKey);
  });
});
