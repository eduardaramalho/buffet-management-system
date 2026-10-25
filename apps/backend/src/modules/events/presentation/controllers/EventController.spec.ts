process.env.DATABASE_URL = "mysql://user:password@localhost:3306/buffet_test";
process.env.JWT_ACCESS_SECRET = "test-secret";
process.env.CORS_ORIGIN = "http://localhost:5173";

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import app from "../../../../app.js";
import { authService, tokenProvider } from "../../../auth/infrastructure/factories/auth.factory.js";
import { eventService } from "../../infrastructure/factories/event.factory.js";

describe("EventController", () => {
  afterEach(() => jest.restoreAllMocks());

  const token = () => tokenProvider.createAccessToken({ sub: "actor-1", email: "actor@buffet.com" });

  it("lists and gets events with the corresponding permissions", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    jest.spyOn(eventService, "list").mockResolvedValue([]);
    jest.spyOn(eventService, "get").mockResolvedValue({} as never);

    const listResponse = await request(app).get("/api/v1/events?search=casamento").set("Authorization", `Bearer ${token()}`);
    const getResponse = await request(app).get("/api/v1/events/event-1").set("Authorization", `Bearer ${token()}`);

    expect(listResponse.status).toBe(200);
    expect(getResponse.status).toBe(200);
    expect(eventService.list).toHaveBeenCalled();
    expect(eventService.get).toHaveBeenCalledWith("event-1");
  });

  it("creates, updates, removes and restores an event", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    jest.spyOn(eventService, "create").mockResolvedValue({} as never);
    jest.spyOn(eventService, "update").mockResolvedValue({} as never);
    jest.spyOn(eventService, "remove").mockResolvedValue({} as never);
    jest.spyOn(eventService, "restore").mockResolvedValue({} as never);

    const createResponse = await request(app).post("/api/v1/events").set("Authorization", `Bearer ${token()}`).send({
      name: "Casamento de Alice", eventDate: "2026-10-10T15:00:00.000Z", endDate: null, location: "Salao", serviceType: "CASAMENTO", guestsCount: 100, observations: null, clientId: "client-1",
    });
    const updateResponse = await request(app).put("/api/v1/events/event-1").set("Authorization", `Bearer ${token()}`).send({ observations: "Atualizado" });
    const removeResponse = await request(app).delete("/api/v1/events/event-1").set("Authorization", `Bearer ${token()}`);
    const restoreResponse = await request(app).patch("/api/v1/events/event-1/restore").set("Authorization", `Bearer ${token()}`);

    expect(createResponse.status).toBe(201);
    expect(updateResponse.status).toBe(200);
    expect(removeResponse.status).toBe(204);
    expect(restoreResponse.status).toBe(200);
    expect(eventService.create).toHaveBeenCalledWith(expect.objectContaining({ createdById: "actor-1", clientId: "client-1" }));
    expect(eventService.update).toHaveBeenCalledWith("event-1", expect.any(Object), "actor-1");
    expect(eventService.remove).toHaveBeenCalledWith("event-1", "actor-1");
    expect(eventService.restore).toHaveBeenCalledWith("event-1", "actor-1");
  });

  it("attaches and detaches a service from an event", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    jest.spyOn(eventService, "attachService").mockResolvedValue({} as never);
    jest.spyOn(eventService, "detachService").mockResolvedValue(undefined);

    const attachResponse = await request(app).post("/api/v1/events/event-1/services").set("Authorization", `Bearer ${token()}`).send({ serviceId: "service-1" });
    const detachResponse = await request(app).delete("/api/v1/events/event-1/services/service-1").set("Authorization", `Bearer ${token()}`);

    expect(attachResponse.status).toBe(200);
    expect(detachResponse.status).toBe(204);
    expect(eventService.attachService).toHaveBeenCalledWith({ eventId: "event-1", serviceId: "service-1" }, "actor-1");
    expect(eventService.detachService).toHaveBeenCalledWith("event-1", "service-1", "actor-1");
  });
  it("rejects invalid event payloads with Zod", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValueOnce(true);
    const create = jest.spyOn(eventService, "create").mockResolvedValueOnce({} as never);
    const token = tokenProvider.createAccessToken({ sub: "actor-1", email: "actor@buffet.com" });

    const response = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "x", serviceType: "INVALID", guestsCount: 0 });

    expect(response.status).toBe(422);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns 403 when the authenticated user lacks events:list", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValueOnce(false);
    const token = tokenProvider.createAccessToken({ sub: "actor-1", email: "actor@buffet.com" });

    const response = await request(app)
      .get("/api/v1/events")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Permissão insuficiente" });
  });
  it("requires clientId on create and accepts it on a partial update", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    const create = jest.spyOn(eventService, "create").mockResolvedValue({} as never);
    const update = jest.spyOn(eventService, "update").mockResolvedValue({} as never);

    const missingClient = await request(app).post("/api/v1/events").set("Authorization", `Bearer ${token()}`).send({
      name: "Casamento de Alice", eventDate: "2026-10-10T15:00:00.000Z", location: "Salao", serviceType: "CASAMENTO", guestsCount: 100,
    });
    const updateResponse = await request(app).put("/api/v1/events/event-1").set("Authorization", `Bearer ${token()}`).send({ clientId: "client-2" });

    expect(missingClient.status).toBe(422);
    expect(create).not.toHaveBeenCalled();
    expect(updateResponse.status).toBe(200);
    expect(update).toHaveBeenCalledWith("event-1", { clientId: "client-2" }, "actor-1");
  });

  it("lists deleted events only with events:restore, on a route that does not clash with /:id", async () => {
    const hasPermission = jest.spyOn(authService, "hasPermission").mockResolvedValueOnce(false).mockResolvedValue(true);
    const listDeleted = jest.spyOn(eventService, "listDeleted").mockResolvedValue([]);
    const get = jest.spyOn(eventService, "get");

    const forbidden = await request(app).get("/api/v1/events/deleted").set("Authorization", `Bearer ${token()}`);
    const allowed = await request(app).get("/api/v1/events/deleted").set("Authorization", `Bearer ${token()}`);

    expect(forbidden.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(hasPermission).toHaveBeenCalledWith("actor-1", "events:restore");
    expect(listDeleted).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
  });
});