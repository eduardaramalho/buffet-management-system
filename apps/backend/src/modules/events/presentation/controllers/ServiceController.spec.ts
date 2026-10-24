process.env.DATABASE_URL = "mysql://user:password@localhost:3306/buffet_test";
process.env.JWT_ACCESS_SECRET = "test-secret";
process.env.CORS_ORIGIN = "http://localhost:5173";

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import app from "../../../../app.js";
import { authService, tokenProvider } from "../../../auth/infrastructure/factories/auth.factory.js";
import { serviceCatalogService } from "../../infrastructure/factories/event.factory.js";
import { ServiceCatalogConflictError, ServiceCatalogError } from "../../application/ServiceCatalogService.js";
import { NotFoundError } from "../../../../shared/errors/NotFoundError.js";

const auth = () => ({ Authorization: `Bearer ${tokenProvider.createAccessToken({ sub: "actor-1", email: "actor@buffet.com" })}` });

describe("ServiceController (RF06)", () => {
  afterEach(() => { jest.restoreAllMocks(); });

  it("protects each route with its own permission", async () => {
    const hasPermission = jest.spyOn(authService, "hasPermission").mockResolvedValue(false);

    const responses = await Promise.all([
      request(app).get("/api/v1/services").set(auth()),
      request(app).get("/api/v1/services/service-1").set(auth()),
      request(app).post("/api/v1/services").set(auth()).send({ name: "Bar" }),
      request(app).put("/api/v1/services/service-1").set(auth()).send({ name: "Bar" }),
      request(app).delete("/api/v1/services/service-1").set(auth()),
    ]);

    expect(responses.map((response) => response.status)).toEqual([403, 403, 403, 403, 403]);
    for (const permission of ["services:list", "services:read", "services:create", "services:update", "services:delete"]) {
      expect(hasPermission).toHaveBeenCalledWith("actor-1", permission);
    }
  });

  it("requires authentication", async () => {
    expect((await request(app).get("/api/v1/services")).status).toBe(401);
  });

  it("lists, gets, creates, updates and removes", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    jest.spyOn(serviceCatalogService, "list").mockResolvedValue([]);
    jest.spyOn(serviceCatalogService, "get").mockResolvedValue({} as never);
    const create = jest.spyOn(serviceCatalogService, "create").mockResolvedValue({ id: "service-1" } as never);
    const update = jest.spyOn(serviceCatalogService, "update").mockResolvedValue({ id: "service-1" } as never);
    const remove = jest.spyOn(serviceCatalogService, "remove").mockResolvedValue({} as never);

    expect((await request(app).get("/api/v1/services").set(auth())).status).toBe(200);
    expect((await request(app).get("/api/v1/services/service-1").set(auth())).status).toBe(200);
    expect((await request(app).post("/api/v1/services").set(auth()).send({ name: "Bar" })).status).toBe(201);
    expect((await request(app).put("/api/v1/services/service-1").set(auth()).send({ name: "Bar 2" })).status).toBe(200);
    expect((await request(app).delete("/api/v1/services/service-1").set(auth())).status).toBe(204);
    expect(create).toHaveBeenCalledWith({ name: "Bar", isCustom: false }, "actor-1");
    expect(update).toHaveBeenCalledWith("service-1", { name: "Bar 2" }, "actor-1");
    expect(remove).toHaveBeenCalledWith("service-1", "actor-1");
  });

  it("rejects invalid payloads with 422", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    const create = jest.spyOn(serviceCatalogService, "create");

    const empty = await request(app).post("/api/v1/services").set(auth()).send({ name: "" });
    const tooLong = await request(app).put("/api/v1/services/service-1").set(auth()).send({ name: "x".repeat(101) });

    expect([empty.status, tooLong.status]).toEqual([422, 422]);
    expect(create).not.toHaveBeenCalled();
  });

  it("maps a missing service to 404, a rule to 400 and a duplicate to 409", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    jest.spyOn(serviceCatalogService, "get").mockRejectedValueOnce(new NotFoundError("Serviço não encontrado"));
    jest.spyOn(serviceCatalogService, "remove").mockRejectedValueOnce(new ServiceCatalogError("O serviço genérico Outro não pode ser excluído"));
    jest.spyOn(serviceCatalogService, "create").mockRejectedValueOnce(new ServiceCatalogConflictError("Já existe um serviço com este nome"));

    const missing = await request(app).get("/api/v1/services/missing").set(auth());
    const protectedRemoval = await request(app).delete("/api/v1/services/service-outro").set(auth());
    const duplicate = await request(app).post("/api/v1/services").set(auth()).send({ name: "Bar" });

    expect(missing.status).toBe(404);
    expect(protectedRemoval.status).toBe(400);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({ message: "Já existe um serviço com este nome" });
  });
});
