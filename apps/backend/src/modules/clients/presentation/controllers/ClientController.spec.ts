process.env.DATABASE_URL = "mysql://user:password@localhost:3306/buffet_test";
process.env.JWT_ACCESS_SECRET = "test-secret";
process.env.CORS_ORIGIN = "http://localhost:5173";

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import app from "../../../../app.js";
import { authService, tokenProvider } from "../../../auth/infrastructure/factories/auth.factory.js";
import { ClientController } from "./ClientController.js";
import { clientService } from "../../infrastructure/factories/client.factory.js";
import { ClientConflictError, ClientManagementError } from "../../domain/client.errors.js";
import { NotFoundError } from "../../../../shared/errors/NotFoundError.js";

const token = () => tokenProvider.createAccessToken({ sub: "actor-1", email: "actor@buffet.com" });
const auth = () => ({ Authorization: `Bearer ${token()}` });

describe("ClientController", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("lists with search and gets a client with the matching permissions", async () => {
    const hasPermission = jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    jest.spyOn(clientService, "list").mockResolvedValue([]);
    jest.spyOn(clientService, "get").mockResolvedValue({} as never);

    const listResponse = await request(app).get("/api/v1/clients?search=Ana").set(auth());
    const getResponse = await request(app).get("/api/v1/clients/client-1").set(auth());

    expect(listResponse.status).toBe(200);
    expect(getResponse.status).toBe(200);
    expect(clientService.list).toHaveBeenCalledWith({ search: "Ana" });
    expect(clientService.get).toHaveBeenCalledWith("client-1");
    expect(hasPermission).toHaveBeenCalledWith("actor-1", "clients:list");
    expect(hasPermission).toHaveBeenCalledWith("actor-1", "clients:read");
  });

  it("creates with defaults for optional fields, updates partially and soft deletes", async () => {
    const hasPermission = jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    jest.spyOn(clientService, "create").mockResolvedValue({ id: "client-1" } as never);
    jest.spyOn(clientService, "update").mockResolvedValue({ id: "client-1" } as never);
    jest.spyOn(clientService, "remove").mockResolvedValue({} as never);

    const createResponse = await request(app).post("/api/v1/clients").set(auth()).send({ type: "PF", name: "Ana" });
    const updateResponse = await request(app).put("/api/v1/clients/client-1").set(auth()).send({ phone: "47999990000" });
    const removeResponse = await request(app).delete("/api/v1/clients/client-1").set(auth());

    expect(createResponse.status).toBe(201);
    expect(updateResponse.status).toBe(200);
    expect(removeResponse.status).toBe(204);
    expect(clientService.create).toHaveBeenCalledWith({ type: "PF", name: "Ana", document: null, email: null, phone: null, notes: null }, "actor-1");
    expect(clientService.update).toHaveBeenCalledWith("client-1", { phone: "47999990000" }, "actor-1");
    expect(clientService.remove).toHaveBeenCalledWith("client-1", "actor-1");
    for (const permission of ["clients:create", "clients:update", "clients:delete"]) {
      expect(hasPermission).toHaveBeenCalledWith("actor-1", permission);
    }
  });

  it("returns 422 for invalid payloads without calling the service", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    const create = jest.spyOn(clientService, "create").mockResolvedValue({} as never);
    const update = jest.spyOn(clientService, "update").mockResolvedValue({} as never);

    const invalidType = await request(app).post("/api/v1/clients").set(auth()).send({ type: "XX", name: "Ana" });
    const invalidEmail = await request(app).post("/api/v1/clients").set(auth()).send({ type: "PF", name: "Ana", email: "nao-e-email" });
    const invalidUpdate = await request(app).put("/api/v1/clients/client-1").set(auth()).send({ name: "x".repeat(151) });

    expect(invalidType.status).toBe(422);
    expect(invalidEmail.status).toBe(422);
    expect(invalidUpdate.status).toBe(422);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("maps business errors to 400, conflicts to 409 and missing clients to 404", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    jest.spyOn(clientService, "create").mockRejectedValueOnce(new ClientManagementError("CPF inválido"));
    jest.spyOn(clientService, "remove").mockRejectedValueOnce(new ClientConflictError("O cliente possui 1 evento em aberto e não pode ser excluído"));
    jest.spyOn(clientService, "get").mockRejectedValueOnce(new NotFoundError("Cliente não encontrado"));

    const badRequest = await request(app).post("/api/v1/clients").set(auth()).send({ type: "PF", name: "Ana", document: "123" });
    const conflict = await request(app).delete("/api/v1/clients/client-1").set(auth());
    const notFound = await request(app).get("/api/v1/clients/missing").set(auth());

    expect(badRequest.status).toBe(400);
    expect(badRequest.body).toEqual({ message: "CPF inválido" });
    expect(conflict.status).toBe(409);
    expect(notFound.status).toBe(404);
  });

  it("returns 403 without the permission and 401 without a token", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(false);

    const forbidden = await request(app).get("/api/v1/clients").set(auth());
    const unauthenticated = await request(app).get("/api/v1/clients");

    expect(forbidden.status).toBe(403);
    expect(unauthenticated.status).toBe(401);
  });
});

describe("ClientController without an authenticated actor", () => {
  it.each([
    ["post", "/clients", "create"],
    ["put", "/clients/client-1", "update"],
    ["delete", "/clients/client-1", "remove"],
  ] as const)("returns 401 on %s %s", async (method, path, handler) => {
    const service = { create: jest.fn(), update: jest.fn(), remove: jest.fn() };
    const controller = new ClientController(service as never);
    const bare = express();
    bare.use(express.json());
    bare.post("/clients", controller.create);
    bare.put("/clients/:id", controller.update);
    bare.delete("/clients/:id", controller.remove);

    const response = await request(bare)[method](path).send({ type: "PF", name: "Ana" });

    expect(response.status).toBe(401);
    expect(service[handler]).not.toHaveBeenCalled();
  });
});
