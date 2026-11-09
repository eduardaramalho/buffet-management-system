import { describe, expect, it, jest } from "@jest/globals";

import { TaskCommentService } from "./TaskCommentService.js";
import { TaskManagementError } from "./TaskService.js";
import type { AuditService, TaskRecord, TaskRepository } from "../domain/task.types.js";
import type { TaskCommentRecord, TaskCommentRepository } from "../domain/taskComment.types.js";

const makeTask = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  id: "task-1",
  eventId: "event-1",
  title: "Confirmar cardápio",
  description: null,
  dueDate: null,
  status: "PENDENTE",
  assignedTeamId: null,
  sourceRuleId: null,
  createdAt: new Date("2026-11-01T00:00:00.000Z"),
  updatedAt: new Date("2026-11-01T00:00:00.000Z"),
  deletedAt: null,
  ...overrides,
});

const makeComment = (overrides: Partial<TaskCommentRecord> = {}): TaskCommentRecord => ({
  id: "comment-1",
  taskId: "task-1",
  authorId: "actor-1",
  authorName: "Marina Costa",
  body: "Cliente confirmou por e-mail",
  createdAt: new Date("2026-11-08T12:00:00.000Z"),
  ...overrides,
});

const setup = (task: TaskRecord | null = makeTask()) => {
  const tasks = { findById: jest.fn(async () => task) };
  const comments = {
    listByTask: jest.fn(async (_taskId: string) => [makeComment()]),
    create: jest.fn(async (input: { taskId: string; authorId: string; body: string }) => makeComment({ ...input, id: "comment-new" })),
  };
  const audit = { record: jest.fn(async (_input: Record<string, unknown>) => undefined) };
  const service = new TaskCommentService(
    comments as unknown as TaskCommentRepository,
    tasks as unknown as TaskRepository,
    audit as unknown as AuditService,
  );
  return { service, tasks, comments, audit };
};

describe("TaskCommentService.list", () => {
  it("lists the comments of an existing task", async () => {
    const { service, comments } = setup();

    const result = await service.list("task-1");

    expect(comments.listByTask).toHaveBeenCalledWith("task-1");
    expect(result).toEqual([makeComment()]);
  });

  it("rejects a missing or soft-deleted task", async () => {
    const { service, comments } = setup(null);

    await expect(service.list("task-1")).rejects.toThrow(new TaskManagementError("Tarefa não encontrada"));
    expect(comments.listByTask).not.toHaveBeenCalled();
  });
});

describe("TaskCommentService.create", () => {
  it("creates the comment with the actor as author and audits TASK_COMMENTED", async () => {
    const { service, comments, audit } = setup();

    const created = await service.create("task-1", "Cliente confirmou por e-mail", "actor-1");

    expect(comments.create).toHaveBeenCalledWith({ taskId: "task-1", authorId: "actor-1", body: "Cliente confirmou por e-mail" });
    expect(created.id).toBe("comment-new");
    expect(audit.record).toHaveBeenCalledWith({
      userId: "actor-1",
      action: "TASK_COMMENTED",
      entity: "Task",
      entityId: "task-1",
      changes: { commentId: "comment-new" },
    });
  });

  // Concluded or cancelled tasks keep their history open for post-event notes; only the status is frozen.
  it.each(["CONCLUIDA", "CANCELADA"] as const)("accepts comments on a %s task", async (status) => {
    const { service, comments } = setup(makeTask({ status }));

    await service.create("task-1", "Registro pós-evento", "actor-1");

    expect(comments.create).toHaveBeenCalled();
  });

  it("rejects a missing task without writing or auditing", async () => {
    const { service, comments, audit } = setup(null);

    await expect(service.create("task-1", "Oi", "actor-1")).rejects.toThrow("Tarefa não encontrada");
    expect(comments.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
