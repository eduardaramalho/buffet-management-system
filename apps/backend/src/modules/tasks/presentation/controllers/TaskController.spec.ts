import express from "express";
import request from "supertest";
import { describe, expect, it, jest } from "@jest/globals";

import { TaskController } from "./TaskController.js";
import { TaskManagementError } from "../../application/TaskService.js";
import { errorHandler } from "../../../../shared/middlewares/errorHandler.js";
import type { TaskRecord } from "../../domain/task.types.js";

const makeTask = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  id: "task-1",
  eventId: "event-1",
  title: "Confirmar decoração",
  description: null,
  dueDate: null,
  status: "PENDENTE",
  assignedTeamId: null,
  sourceRuleId: "rule-1",
  createdAt: new Date("2026-09-28T00:00:00.000Z"),
  updatedAt: new Date("2026-09-28T00:00:00.000Z"),
  deletedAt: null,
  ...overrides,
});

describe("TaskController", () => {
  it("lists tasks parsing eventId and status query filters", async () => {
    const list = jest.fn(async () => [makeTask()]);
    const controller = new TaskController({ list } as never);
    const app = express();
    app.get("/tasks", controller.list);

    const response = await request(app).get("/tasks").query({ eventId: "event-1", status: "PENDENTE" });

    expect(list).toHaveBeenCalledWith({ eventId: "event-1", status: "PENDENTE" });
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  it("lists tasks with no filters", async () => {
    const list = jest.fn(async () => []);
    const controller = new TaskController({ list } as never);
    const app = express();
    app.get("/tasks", controller.list);

    const response = await request(app).get("/tasks");

    expect(list).toHaveBeenCalledWith({});
    expect(response.status).toBe(200);
  });

  it("gets a task by id", async () => {
    const task = makeTask();
    const get = jest.fn(async () => task);
    const controller = new TaskController({ get } as never);
    const app = express();
    app.get("/tasks/:id", controller.get);

    const response = await request(app).get("/tasks/task-1");

    expect(get).toHaveBeenCalledWith("task-1");
    expect(response.status).toBe(200);
    expect(response.body.id).toBe("task-1");
  });

  it("updates a task's status for the authenticated actor", async () => {
    const updatedTask = makeTask({ status: "EM_ANDAMENTO" });
    const updateStatus = jest.fn(async () => updatedTask);
    const controller = new TaskController({ updateStatus } as never);
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { sub: "actor-1", email: "admin@buffet.local" };
      next();
    });
    app.patch("/tasks/:id/status", controller.updateStatus);

    const response = await request(app).patch("/tasks/task-1/status").send({ status: "EM_ANDAMENTO" });

    expect(updateStatus).toHaveBeenCalledWith("task-1", "EM_ANDAMENTO", "actor-1");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("EM_ANDAMENTO");
  });

  it("rejects updating a task's status without an authenticated actor", async () => {
    const updateStatus = jest.fn();
    const controller = new TaskController({ updateStatus } as never);
    const app = express();
    app.use(express.json());
    app.patch("/tasks/:id/status", controller.updateStatus);

    const response = await request(app).patch("/tasks/task-1/status").send({ status: "EM_ANDAMENTO" });

    expect(response.status).toBe(401);
    expect(updateStatus).not.toHaveBeenCalled();
  });
});

const buildManualApp = (service: Record<string, unknown>, authenticated = true) => {
  const controller = new TaskController(service as never);
  const app = express();
  app.use(express.json());
  if (authenticated) {
    app.use((req, _res, next) => {
      req.user = { sub: "actor-1", email: "admin@buffet.local" };
      next();
    });
  }
  app.post("/tasks", controller.create);
  app.put("/tasks/:id", controller.update);
  app.delete("/tasks/:id", controller.remove);
  app.use(errorHandler);
  return app;
};

describe("TaskController manual tasks", () => {
  it("creates a task, trimming the title and parsing dueDate", async () => {
    const create = jest.fn(async () => makeTask({ id: "task-9" }));
    const app = buildManualApp({ create });

    const response = await request(app)
      .post("/tasks")
      .send({ eventId: "event-1", title: "  Buscar flores  ", dueDate: "2026-10-30T12:00:00.000Z", assignedTeamId: "team-1" });

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      { eventId: "event-1", title: "Buscar flores", dueDate: new Date("2026-10-30T12:00:00.000Z"), assignedTeamId: "team-1" },
      "actor-1",
    );
  });

  it.each([
    ["empty title", { eventId: "event-1", title: "   " }],
    ["title over 150 chars", { eventId: "event-1", title: "a".repeat(151) }],
    ["missing eventId", { title: "X" }],
    ["invalid dueDate", { eventId: "event-1", title: "X", dueDate: "not-a-date" }],
  ])("rejects creation with %s (422)", async (_name, body) => {
    const create = jest.fn();
    const response = await request(buildManualApp({ create })).post("/tasks").send(body);

    expect(response.status).toBe(422);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns 400 with the business message when the service rejects", async () => {
    const create = jest.fn(async () => {
      throw new TaskManagementError("Aloque a equipe ao evento antes de atribuí-la à tarefa");
    });

    const response = await request(buildManualApp({ create })).post("/tasks").send({ eventId: "event-1", title: "X", assignedTeamId: "team-1" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Aloque a equipe ao evento antes de atribuí-la à tarefa");
  });

  it("requires an authenticated actor to create, update and delete", async () => {
    const service = { create: jest.fn(), update: jest.fn(), remove: jest.fn() };
    const app = buildManualApp(service, false);

    expect((await request(app).post("/tasks").send({ eventId: "event-1", title: "X" })).status).toBe(401);
    expect((await request(app).put("/tasks/task-1").send({ title: "X" })).status).toBe(401);
    expect((await request(app).delete("/tasks/task-1")).status).toBe(401);
    expect(service.create).not.toHaveBeenCalled();
  });

  it("passes only the provided fields on a partial PUT", async () => {
    const update = jest.fn(async () => makeTask());

    const response = await request(buildManualApp({ update })).put("/tasks/task-1").send({ description: "Nova" });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith("task-1", { description: "Nova" }, "actor-1");
  });

  it("accepts null to unassign the team and clear the due date on PUT", async () => {
    const update = jest.fn(async () => makeTask());

    await request(buildManualApp({ update })).put("/tasks/task-1").send({ assignedTeamId: null, dueDate: null });

    expect(update).toHaveBeenCalledWith("task-1", { assignedTeamId: null, dueDate: null }, "actor-1");
  });

  it("rejects an invalid title on PUT (422)", async () => {
    const update = jest.fn();

    const response = await request(buildManualApp({ update })).put("/tasks/task-1").send({ title: "" });

    expect(response.status).toBe(422);
    expect(update).not.toHaveBeenCalled();
  });

  it("deletes a task and returns 204", async () => {
    const remove = jest.fn(async () => undefined);

    const response = await request(buildManualApp({ remove })).delete("/tasks/task-1");

    expect(response.status).toBe(204);
    expect(remove).toHaveBeenCalledWith("task-1", "actor-1");
  });
});
