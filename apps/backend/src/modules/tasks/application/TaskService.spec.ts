import { describe, expect, it, jest } from "@jest/globals";

import { TaskService, TaskManagementError } from "./TaskService.js";
import type { TaskRecord, TaskRepository } from "../domain/task.types.js";

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

describe("TaskService", () => {
  it("lists tasks using the repository filter (eventId and status)", async () => {
    const tasks = { list: jest.fn(async () => [makeTask()]) } as unknown as TaskRepository;
    const service = new TaskService(tasks);

    const result = await service.list({ eventId: "event-1", status: "PENDENTE" });

    expect(tasks.list).toHaveBeenCalledWith({ eventId: "event-1", status: "PENDENTE" });
    expect(result).toHaveLength(1);
  });

  it("gets an existing task and rejects a missing one", async () => {
    const task = makeTask();
    const tasks = { findById: jest.fn(async (id: string) => (id === "task-1" ? task : null)) } as unknown as TaskRepository;
    const service = new TaskService(tasks);

    await expect(service.get("task-1")).resolves.toEqual(task);
    await expect(service.get("missing")).rejects.toThrow(TaskManagementError);
    await expect(service.get("missing")).rejects.toThrow("Tarefa não encontrada");
  });
});
