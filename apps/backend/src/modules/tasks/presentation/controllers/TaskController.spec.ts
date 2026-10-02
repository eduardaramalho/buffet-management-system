import express from "express";
import request from "supertest";
import { describe, expect, it, jest } from "@jest/globals";

import { TaskController } from "./TaskController.js";
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
});
