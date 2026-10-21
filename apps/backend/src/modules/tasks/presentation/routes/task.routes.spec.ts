import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { authService, tokenProvider } from "../../../auth/infrastructure/factories/auth.factory.js";
import { taskController } from "../../infrastructure/factories/task.factory.js";
import { taskRoutes } from "./task.routes.js";

afterEach(() => { jest.restoreAllMocks(); });

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/tasks", taskRoutes);
  return app;
};

const routes = [
  ["post", "/tasks", "tasks:create"],
  ["put", "/tasks/task-1", "tasks:update"],
  ["delete", "/tasks/task-1", "tasks:delete"],
] as const;

describe("manual task routes", () => {
  it.each(routes)("%s %s returns 403 without %s and never reaches the controller", async (method, path, permission) => {
    jest.spyOn(tokenProvider, "verifyAccessToken").mockReturnValue({ sub: "actor-1", email: "a@b.c" } as never);
    const hasPermission = jest.spyOn(authService, "hasPermission").mockResolvedValue(false);
    const create = jest.spyOn(taskController, "create");

    const response = await request(buildApp())[method](path).set("Authorization", "Bearer token").send({});

    expect(response.status).toBe(403);
    expect(hasPermission).toHaveBeenCalledWith("actor-1", permission);
    expect(create).not.toHaveBeenCalled();
  });

  it.each(routes)("%s %s returns 401 without a token", async (method, path) => {
    const response = await request(buildApp())[method](path).send({});

    expect(response.status).toBe(401);
  });
});
