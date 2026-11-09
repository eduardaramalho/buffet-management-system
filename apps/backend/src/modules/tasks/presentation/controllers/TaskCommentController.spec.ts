import express from "express";
import request from "supertest";
import { describe, expect, it, jest } from "@jest/globals";

import { TaskCommentController } from "./TaskCommentController.js";
import { TaskManagementError } from "../../application/TaskService.js";
import { TASK_COMMENT_MAX_LENGTH } from "../../domain/taskComment.types.js";
import { errorHandler } from "../../../../shared/middlewares/errorHandler.js";

const comment = {
  id: "comment-1",
  taskId: "task-1",
  authorId: "actor-1",
  authorName: "Marina Costa",
  body: "Cliente confirmou",
  createdAt: new Date("2026-11-08T12:00:00.000Z"),
};

const buildApp = (service: Record<string, unknown>, withUser = true) => {
  const controller = new TaskCommentController(service as never);
  const app = express();
  app.use(express.json());
  if (withUser) {
    app.use((req, _res, next) => {
      req.user = { sub: "actor-1", email: "a@b.c" };
      next();
    });
  }
  app.get("/tasks/:id/comments", controller.list);
  app.post("/tasks/:id/comments", controller.create);
  app.use(errorHandler);
  return app;
};

describe("TaskCommentController", () => {
  it("lists the comments of a task", async () => {
    const list = jest.fn(async (_taskId: string) => [comment]);

    const response = await request(buildApp({ list })).get("/tasks/task-1/comments");

    expect(list).toHaveBeenCalledWith("task-1");
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ ...comment, createdAt: "2026-11-08T12:00:00.000Z" }]);
  });

  it("creates a comment trimming the body and returns 201", async () => {
    const create = jest.fn(async (_taskId: string, _body: string, _actorId: string) => comment);

    const response = await request(buildApp({ create })).post("/tasks/task-1/comments").send({ body: "  Cliente confirmou  " });

    expect(create).toHaveBeenCalledWith("task-1", "Cliente confirmou", "actor-1");
    expect(response.status).toBe(201);
    expect(response.body.id).toBe("comment-1");
  });

  it.each([
    ["an empty body", { body: "   " }],
    ["a missing body", {}],
    ["a body over the limit", { body: "x".repeat(TASK_COMMENT_MAX_LENGTH + 1) }],
  ])("returns 422 for %s", async (_label, payload) => {
    const create = jest.fn();

    const response = await request(buildApp({ create })).post("/tasks/task-1/comments").send(payload);

    expect(response.status).toBe(422);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns 401 when there is no authenticated user", async () => {
    const create = jest.fn();

    const response = await request(buildApp({ create }, false)).post("/tasks/task-1/comments").send({ body: "Oi" });

    expect(response.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it("maps a missing task to 400 through the error handler", async () => {
    const list = jest.fn(async () => { throw new TaskManagementError("Tarefa não encontrada"); });

    const response = await request(buildApp({ list })).get("/tasks/task-1/comments");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Tarefa não encontrada");
  });
});
