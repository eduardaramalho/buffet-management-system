import { describe, expect, it, jest } from "@jest/globals";

import { TaskService, TaskManagementError } from "./TaskService.js";
import type { AuditService, TaskRecord, TaskRepository } from "../domain/task.types.js";

const makeTask = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  id: "task-1",
  eventId: "event-1",
  title: "Confirmar decoração",
  description: null,
  dueDate: null,
  completedAt: null,
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
    const service = new TaskService(tasks, { record: jest.fn() } as unknown as AuditService);

    const result = await service.list({ eventId: "event-1", status: "PENDENTE" });

    expect(tasks.list).toHaveBeenCalledWith({ eventId: "event-1", status: "PENDENTE" });
    expect(result).toHaveLength(1);
  });

  it("gets an existing task and rejects a missing one", async () => {
    const task = makeTask();
    const tasks = { findById: jest.fn(async (id: string) => (id === "task-1" ? task : null)) } as unknown as TaskRepository;
    const service = new TaskService(tasks, { record: jest.fn() } as unknown as AuditService);

    await expect(service.get("task-1")).resolves.toEqual(task);
    await expect(service.get("missing")).rejects.toThrow(TaskManagementError);
    await expect(service.get("missing")).rejects.toThrow("Tarefa não encontrada");
  });

  it("rejects a transition from a terminal status (CONCLUIDA/CANCELADA) back to PENDENTE/EM_ANDAMENTO", async () => {
    const concludedTask = makeTask({ status: "CONCLUIDA" });
    const tasks = {
      findById: jest.fn(async () => concludedTask),
      update: jest.fn(async (_id: string, input: { status: string }) => ({ ...concludedTask, status: input.status })),
    } as unknown as TaskRepository;
    const audit = { record: jest.fn(async () => undefined) } as unknown as AuditService;
    const service = new TaskService(tasks, audit);

    await expect(service.updateStatus("task-1", "PENDENTE", "actor-1")).rejects.toThrow(TaskManagementError);
    await expect(service.updateStatus("task-1", "EM_ANDAMENTO", "actor-1")).rejects.toThrow(
      "Tarefas concluídas ou canceladas não podem retornar a um estado não terminal",
    );
    expect(tasks.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("rejects a transition from CANCELADA back to a non-terminal status too", async () => {
    const cancelledTask = makeTask({ status: "CANCELADA" });
    const tasks = {
      findById: jest.fn(async () => cancelledTask),
      update: jest.fn(),
    } as unknown as TaskRepository;
    const audit = { record: jest.fn() } as unknown as AuditService;
    const service = new TaskService(tasks, audit);

    await expect(service.updateStatus("task-1", "EM_ANDAMENTO", "actor-1")).rejects.toThrow(TaskManagementError);
    expect(tasks.update).not.toHaveBeenCalled();
  });

  it("updates the status and records an audit entry when the transition is allowed", async () => {
    const task = makeTask({ status: "PENDENTE" });
    const updatedTask = { ...task, status: "EM_ANDAMENTO" as const };
    const tasks = {
      findById: jest.fn(async () => task),
      update: jest.fn(async (_id: string, _input: { status: string }) => updatedTask),
    } as unknown as TaskRepository;
    const audit = { record: jest.fn(async (_input: Parameters<AuditService["record"]>[0]) => undefined) } as unknown as AuditService;
    const service = new TaskService(tasks, audit);

    const result = await service.updateStatus("task-1", "EM_ANDAMENTO", "actor-1");

    expect(tasks.update).toHaveBeenCalledWith("task-1", { status: "EM_ANDAMENTO", completedAt: null });
    expect(audit.record).toHaveBeenCalledWith({
      userId: "actor-1",
      action: "TASK_STATUS_CHANGED",
      entity: "Task",
      entityId: "task-1",
      changes: { before: "PENDENTE", after: "EM_ANDAMENTO" },
    });
    expect(result).toEqual(updatedTask);
  });

  it("sets completedAt when a task is concluded", async () => {
    const task = makeTask({ status: "EM_ANDAMENTO" });
    const tasks = {
      findById: jest.fn(async () => task),
      update: jest.fn(async (_id: string, input: { status: string; completedAt: Date | null }) => ({ ...task, ...input })),
    } as unknown as TaskRepository;
    const service = new TaskService(tasks, { record: jest.fn(async () => undefined) } as unknown as AuditService);

    await service.updateStatus("task-1", "CONCLUIDA", "actor-1");

    expect(tasks.update).toHaveBeenCalledWith("task-1", { status: "CONCLUIDA", completedAt: expect.any(Date) });
  });

  it("rejects updating the status of a missing task", async () => {
    const tasks = { findById: jest.fn(async () => null), update: jest.fn() } as unknown as TaskRepository;
    const audit = { record: jest.fn() } as unknown as AuditService;
    const service = new TaskService(tasks, audit);

    await expect(service.updateStatus("missing", "EM_ANDAMENTO", "actor-1")).rejects.toThrow(TaskManagementError);
    expect(tasks.update).not.toHaveBeenCalled();
  });
});
