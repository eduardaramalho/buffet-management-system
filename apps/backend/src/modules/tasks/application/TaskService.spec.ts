import { describe, expect, it, jest } from "@jest/globals";

import { TaskService, TaskManagementError } from "./TaskService.js";
import type { AuditService, TaskRecord, TaskRepository } from "../domain/task.types.js";

const noReaders = {} as never;

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
    const service = new TaskService(tasks, { record: jest.fn() } as unknown as AuditService, noReaders);

    const result = await service.list({ eventId: "event-1", status: "PENDENTE" });

    expect(tasks.list).toHaveBeenCalledWith({ eventId: "event-1", status: "PENDENTE" });
    expect(result).toHaveLength(1);
  });

  it("gets an existing task and rejects a missing one", async () => {
    const task = makeTask();
    const tasks = { findById: jest.fn(async (id: string) => (id === "task-1" ? task : null)) } as unknown as TaskRepository;
    const service = new TaskService(tasks, { record: jest.fn() } as unknown as AuditService, noReaders);

    await expect(service.get("task-1")).resolves.toEqual(task);
    await expect(service.get("missing")).rejects.toThrow(TaskManagementError);
    await expect(service.get("missing")).rejects.toThrow("Tarefa não encontrada");
  });

  describe("updateStatus (ADR 0014)", () => {
    const makeStatusService = (task: TaskRecord, eventStatus = "EM_ANDAMENTO") => {
      const tasks = {
        findById: jest.fn(async () => task),
        update: jest.fn(async (_id: string, input: { status: string; completedAt: Date | null }) => ({ ...task, ...input })),
      } as unknown as TaskRepository;
      const audit = { record: jest.fn(async (_input: Parameters<AuditService["record"]>[0]) => undefined) } as unknown as AuditService;
      const events = { findById: jest.fn(async () => ({ id: task.eventId, status: eventStatus, deletedAt: null })) };
      const service = new TaskService(tasks, audit, { events } as never);
      return { service, tasks, audit };
    };

    it("updates the status and records an audit entry when the transition is allowed", async () => {
      const { service, tasks, audit } = makeStatusService(makeTask({ status: "PENDENTE" }));

      const result = await service.updateStatus("task-1", "EM_ANDAMENTO", "actor-1");

      expect(tasks.update).toHaveBeenCalledWith("task-1", { status: "EM_ANDAMENTO", completedAt: null });
      expect(audit.record).toHaveBeenCalledWith({
        userId: "actor-1",
        action: "TASK_STATUS_CHANGED",
        entity: "Task",
        entityId: "task-1",
        changes: { before: "PENDENTE", after: "EM_ANDAMENTO" },
      });
      expect(result.status).toBe("EM_ANDAMENTO");
    });

    it("sets completedAt when a task in progress is concluded", async () => {
      const { service, tasks } = makeStatusService(makeTask({ status: "EM_ANDAMENTO" }));

      await service.updateStatus("task-1", "CONCLUIDA", "actor-1");

      expect(tasks.update).toHaveBeenCalledWith("task-1", { status: "CONCLUIDA", completedAt: expect.any(Date) });
    });

    it("lets a task in progress go back to pending", async () => {
      const { service, tasks } = makeStatusService(makeTask({ status: "EM_ANDAMENTO" }));

      await service.updateStatus("task-1", "PENDENTE", "actor-1");

      expect(tasks.update).toHaveBeenCalledWith("task-1", { status: "PENDENTE", completedAt: null });
    });

    it("requires the task to be started before it is concluded", async () => {
      const { service, tasks, audit } = makeStatusService(makeTask({ status: "PENDENTE" }));

      await expect(service.updateStatus("task-1", "CONCLUIDA", "actor-1")).rejects.toThrow(
        "Transição de status inválida: de Pendente para Concluída",
      );
      expect(tasks.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    // Antes, CONCLUIDA -> CANCELADA era aceito e apagava o completedAt, distorcendo o indicador de pontualidade.
    it.each(["PENDENTE", "EM_ANDAMENTO", "CANCELADA"] as const)("never moves a concluded task, not even to %s", async (status) => {
      const { service, tasks } = makeStatusService(makeTask({ status: "CONCLUIDA", completedAt: new Date() }));

      await expect(service.updateStatus("task-1", status, "actor-1")).rejects.toThrow(
        "Tarefas concluídas ou canceladas não podem mudar de status",
      );
      expect(tasks.update).not.toHaveBeenCalled();
    });

    it("never moves a cancelled task", async () => {
      const { service, tasks } = makeStatusService(makeTask({ status: "CANCELADA" }));

      await expect(service.updateStatus("task-1", "CONCLUIDA", "actor-1")).rejects.toThrow(TaskManagementError);
      expect(tasks.update).not.toHaveBeenCalled();
    });

    it("refuses the current status without writing an audit entry", async () => {
      const { service, tasks, audit } = makeStatusService(makeTask({ status: "EM_ANDAMENTO" }));

      await expect(service.updateStatus("task-1", "EM_ANDAMENTO", "actor-1")).rejects.toThrow("A tarefa já está em Em andamento");
      expect(tasks.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it.each(["CONCLUIDO", "CANCELADO"])("only lets open tasks be cancelled when the event is %s", async (eventStatus) => {
      const { service, tasks } = makeStatusService(makeTask({ status: "PENDENTE" }), eventStatus);

      await expect(service.updateStatus("task-1", "EM_ANDAMENTO", "actor-1")).rejects.toThrow(
        "Em eventos concluídos ou cancelados, as tarefas em aberto só podem ser canceladas",
      );
      expect(tasks.update).not.toHaveBeenCalled();

      await service.updateStatus("task-1", "CANCELADA", "actor-1");
      expect(tasks.update).toHaveBeenCalledWith("task-1", { status: "CANCELADA", completedAt: null });
    });
  });

  it("rejects updating the status of a missing task", async () => {
    const tasks = { findById: jest.fn(async () => null), update: jest.fn() } as unknown as TaskRepository;
    const audit = { record: jest.fn() } as unknown as AuditService;
    const service = new TaskService(tasks, audit, noReaders);

    await expect(service.updateStatus("missing", "EM_ANDAMENTO", "actor-1")).rejects.toThrow(TaskManagementError);
    expect(tasks.update).not.toHaveBeenCalled();
  });
});
