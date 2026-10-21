import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { authService } from "../../infrastructure/factories/auth.factory.js";
import { authorize } from "../middlewares/authorize.js";

afterEach(() => jest.restoreAllMocks());

describe("audit history permissions", () => {
  it("returns 403 without audit:read", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(false);
    const app = express();
    app.use((req, _res, next) => {
      req.user = { sub: "actor-1", email: "admin@buffet.local" };
      next();
    });
    app.get("/events/:eventId/history", authorize("audit:read"), (_req, response) => response.sendStatus(204));

    const response = await request(app).get("/events/event-1/history");

    expect(response.status).toBe(403);
    expect(authService.hasPermission).toHaveBeenCalledWith("actor-1", "audit:read");
  });
});