process.env.DATABASE_URL = "mysql://user:password@localhost:3306/buffet_test";
process.env.JWT_ACCESS_SECRET = "test-secret";
process.env.CORS_ORIGIN = "http://localhost:5173";

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import app from "../../../../app.js";
import { authService, tokenProvider } from "../../../auth/infrastructure/factories/auth.factory.js";
import { eventReplicationService } from "../../infrastructure/factories/event.factory.js";
import { EventReplicationConflictError, EventReplicationError } from "../../application/EventReplicationService.js";
import { NotFoundError } from "../../../../shared/errors/NotFoundError.js";

const token = () => tokenProvider.createAccessToken({ sub: "actor-1", email: "actor@buffet.com" });
const auth = () => ({ Authorization: `Bearer ${token()}` });

const replicateBody = {
  name: "Casamento de Bruna",
  eventDate: "2026-12-12T18:00:00.000Z",
  location: "Salão Principal",
  serviceType: "CASAMENTO",
  guestsCount: 180,
  clientId: "client-1",
  services: [{ serviceId: "service-bar" }],
  tasks: [{ sourceTaskId: "task-1", dueDate: null }, { sourceTaskId: "task-2" }],
  teamIds: ["team-1"],
};

describe("EventReplicationController (RF25)", () => {
  afterEach(() => jest.restoreAllMocks());

  it("protects both routes with the events:replicate permission (decision P3)", async () => {
    const hasPermission = jest.spyOn(authService, "hasPermission").mockResolvedValue(false);
    const preview = jest.spyOn(eventReplicationService, "preview");
    const replicate = jest.spyOn(eventReplicationService, "replicate");

    const previewResponse = await request(app).get("/api/v1/events/source-1/replication-preview").query({ eventDate: "2026-12-12T18:00:00.000Z" }).set(auth());
    const replicateResponse = await request(app).post("/api/v1/events/source-1/replicate").set(auth()).send(replicateBody);

    expect(previewResponse.status).toBe(403);
    expect(replicateResponse.status).toBe(403);
    expect(hasPermission).toHaveBeenCalledWith("actor-1", "events:replicate");
    expect(preview).not.toHaveBeenCalled();
    expect(replicate).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    const response = await request(app).post("/api/v1/events/source-1/replicate").send(replicateBody);

    expect(response.status).toBe(401);
  });

  it("returns the preview for the new schedule", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    const preview = jest.spyOn(eventReplicationService, "preview").mockResolvedValue({ tasks: [], teams: [] } as never);

    const response = await request(app)
      .get("/api/v1/events/source-1/replication-preview")
      .query({ eventDate: "2026-12-12T18:00:00.000Z", endDate: "2026-12-13T02:00:00.000Z" })
      .set(auth());

    expect(response.status).toBe(200);
    expect(preview).toHaveBeenCalledWith("source-1", { eventDate: new Date("2026-12-12T18:00:00.000Z"), endDate: new Date("2026-12-13T02:00:00.000Z") });
  });

  it("requires the new event date to build the preview", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    const preview = jest.spyOn(eventReplicationService, "preview");

    const response = await request(app).get("/api/v1/events/source-1/replication-preview").set(auth());

    expect(response.status).toBe(422);
    expect(preview).not.toHaveBeenCalled();
  });

  it("replicates and answers 201, keeping omitted deadlines undefined (recalculate) and null ones null (no deadline)", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    const replicate = jest.spyOn(eventReplicationService, "replicate").mockResolvedValue({ id: "replica-1" } as never);

    const response = await request(app).post("/api/v1/events/source-1/replicate").set(auth()).send(replicateBody);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: "replica-1" });
    expect(replicate).toHaveBeenCalledWith("source-1", {
      name: "Casamento de Bruna",
      eventDate: new Date("2026-12-12T18:00:00.000Z"),
      endDate: null,
      location: "Salão Principal",
      serviceType: "CASAMENTO",
      guestsCount: 180,
      observations: null,
      clientId: "client-1",
      services: [{ serviceId: "service-bar" }],
      tasks: [{ sourceTaskId: "task-1", dueDate: null }, { sourceTaskId: "task-2" }],
      teamIds: ["team-1"],
    }, "actor-1");
  });

  it("defaults services, tasks and teams to empty lists", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    const replicate = jest.spyOn(eventReplicationService, "replicate").mockResolvedValue({ id: "replica-1" } as never);
    const { services: _services, tasks: _tasks, teamIds: _teamIds, ...body } = replicateBody;

    await request(app).post("/api/v1/events/source-1/replicate").set(auth()).send(body);

    expect(replicate).toHaveBeenCalledWith("source-1", expect.objectContaining({ services: [], tasks: [], teamIds: [] }), "actor-1");
  });

  it("rejects an invalid payload with 422 (name and date are mandatory, empty task title)", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    const replicate = jest.spyOn(eventReplicationService, "replicate");

    const withoutName = await request(app).post("/api/v1/events/source-1/replicate").set(auth()).send({ ...replicateBody, name: undefined });
    const withoutDate = await request(app).post("/api/v1/events/source-1/replicate").set(auth()).send({ ...replicateBody, eventDate: undefined });
    const emptyTitle = await request(app).post("/api/v1/events/source-1/replicate").set(auth()).send({ ...replicateBody, tasks: [{ sourceTaskId: "task-1", title: "" }] });

    expect([withoutName.status, withoutDate.status, emptyTitle.status]).toEqual([422, 422, 422]);
    expect(replicate).not.toHaveBeenCalled();
  });

  it("maps a missing source to 404, a business rule to 400 and unavailable teams to 409 with the details", async () => {
    jest.spyOn(authService, "hasPermission").mockResolvedValue(true);
    jest.spyOn(eventReplicationService, "replicate")
      .mockRejectedValueOnce(new NotFoundError("Evento de origem não encontrado"))
      .mockRejectedValueOnce(new EventReplicationError("Serviço repetido"))
      .mockRejectedValueOnce(new EventReplicationConflictError([
        { teamId: "team-1", reason: "SCHEDULE_CONFLICT", conflictingEvent: { id: "event-9", name: "Formatura X" } },
      ]));

    const notFound = await request(app).post("/api/v1/events/source-1/replicate").set(auth()).send(replicateBody);
    const badRequest = await request(app).post("/api/v1/events/source-1/replicate").set(auth()).send(replicateBody);
    const conflict = await request(app).post("/api/v1/events/source-1/replicate").set(auth()).send(replicateBody);

    expect(notFound.status).toBe(404);
    expect(badRequest.status).toBe(400);
    expect(badRequest.body).toEqual({ message: "Serviço repetido" });
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({
      message: "Há equipes indisponíveis para a nova data",
      conflicts: [{ teamId: "team-1", reason: "SCHEDULE_CONFLICT", conflictingEvent: { id: "event-9", name: "Formatura X" } }],
    });
  });
});
