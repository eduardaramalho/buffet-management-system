import { describe, expect, it, jest } from "@jest/globals";

import { TaskService, TaskManagementError } from "./TaskService.js";
import type { AuditService, TaskRecord, TaskRepository } from "../domain/task.types.js";

const TEAM_NOT_LINKED_MESSAGE = "Aloque a equipe ao evento antes de atribuí-la à tarefa";

const makeTask = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  id: "task-1",
  eventId: "event-1",
  title: "Confirmar decoração",
  description: "Descrição original",
  dueDate: new Date("2026-10-30T00:00:00.000Z"),
  completedAt: null,
  status: "PENDENTE",
  assignedTeamId: null,
  assignedAt: null,
  sourceRuleId: null,
  createdAt: new Date("2026-09-28T00:00:00.000Z"),
  updatedAt: new Date("2026-09-28T00:00:00.000Z"),
  deletedAt: null,
  ...overrides,
});

type Setup = {
  task?: TaskRecord | null;
  eventStatus?: string | null;
  teamStatus?: "ATIVA" | "INATIVA" | null;
  linkedTeamIds?: string[];
};

const setup = ({ task = makeTask(), eventStatus = "PLANEJAMENTO", teamStatus = "ATIVA", linkedTeamIds = ["team-1"] }: Setup = {}) => {
  const tasks = {
    findById: jest.fn(async () => task),
    create: jest.fn(async (input: Record<string, unknown>) => makeTask({ ...(input as Partial<TaskRecord>), id: "task-new" })),
    update: jest.fn(async (_id: string, input: Record<string, unknown>) => ({ ...(task as TaskRecord), ...input })),
    softDelete: jest.fn(async () => undefined),
  };
  const audit = { record: jest.fn(async () => undefined) };
  const events = {
    findById: jest.fn(async () => (eventStatus === null ? null : { id: "event-1", status: eventStatus, deletedAt: null })),
  };
  const teams = { findById: jest.fn(async () => (teamStatus === null ? null : { id: "team-1", status: teamStatus })) };
  const eventTeams = { listTeamsByEvent: jest.fn(async () => linkedTeamIds.map((teamId) => ({ teamId }))) };
  const service = new TaskService(
    tasks as unknown as TaskRepository,
    audit as unknown as AuditService,
    { events, teams, eventTeams } as never,
  );
  return { service, tasks, audit, events, teams, eventTeams };
};

describe("TaskService.create", () => {
  it("creates a manual task (no sourceRuleId) and audits TASK_CREATED", async () => {
    const { service, tasks, audit } = setup();

    await service.create({ eventId: "event-1", title: "Buscar flores" }, "actor-1");

    expect(tasks.create).toHaveBeenCalledWith({
      eventId: "event-1",
      title: "Buscar flores",
      description: null,
      dueDate: null,
      assignedTeamId: null,
      assignedAt: null,
      sourceRuleId: null,
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ userId: "actor-1", action: "TASK_CREATED", entity: "Task", entityId: "task-new" }));
  });

  it("rejects a missing or soft-deleted event", async () => {
    const { service, tasks } = setup({ eventStatus: null });

    await expect(service.create({ eventId: "event-1", title: "X" }, "actor-1")).rejects.toThrow("Evento não encontrado");
    expect(tasks.create).not.toHaveBeenCalled();
  });

  it.each(["CONCLUIDO", "CANCELADO"])("rejects an event in terminal status %s", async (status) => {
    const { service, tasks } = setup({ eventStatus: status });

    await expect(service.create({ eventId: "event-1", title: "X" }, "actor-1")).rejects.toThrow(TaskManagementError);
    expect(tasks.create).not.toHaveBeenCalled();
  });

  it("assigns an active team linked to the event and fills assignedAt", async () => {
    const { service, tasks, audit } = setup();

    await service.create({ eventId: "event-1", title: "X", assignedTeamId: "team-1" }, "actor-1");

    expect(tasks.create).toHaveBeenCalledWith(expect.objectContaining({ assignedTeamId: "team-1", assignedAt: expect.any(Date) }));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "TASK_TEAM_ASSIGNED", changes: { before: null, after: "team-1" } }),
    );
  });

  it("rejects an inactive team", async () => {
    const { service, tasks } = setup({ teamStatus: "INATIVA" });

    await expect(service.create({ eventId: "event-1", title: "X", assignedTeamId: "team-1" }, "actor-1")).rejects.toThrow(TEAM_NOT_LINKED_MESSAGE);
    expect(tasks.create).not.toHaveBeenCalled();
  });

  it("rejects a team not linked to the event", async () => {
    const { service, tasks } = setup({ linkedTeamIds: [] });

    await expect(service.create({ eventId: "event-1", title: "X", assignedTeamId: "team-1" }, "actor-1")).rejects.toThrow(TEAM_NOT_LINKED_MESSAGE);
    expect(tasks.create).not.toHaveBeenCalled();
  });

  it("rejects a nonexistent team", async () => {
    const { service } = setup({ teamStatus: null });

    await expect(service.create({ eventId: "event-1", title: "X", assignedTeamId: "team-1" }, "actor-1")).rejects.toThrow(TEAM_NOT_LINKED_MESSAGE);
  });
});

describe("TaskService.update", () => {
  it("rejects a missing task", async () => {
    const { service } = setup({ task: null });

    await expect(service.update("task-1", { description: "x" }, "actor-1")).rejects.toThrow("Tarefa não encontrada");
  });

  it("keeps omitted fields untouched on a partial update", async () => {
    const { service, tasks, audit } = setup();

    await service.update("task-1", { description: "Nova descrição" }, "actor-1");

    expect(tasks.update).toHaveBeenCalledWith("task-1", { description: "Nova descrição" });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "TASK_UPDATED",
        entityId: "task-1",
        changes: { before: { description: "Descrição original" }, after: { description: "Nova descrição" } },
      }),
    );
    expect(audit.record).not.toHaveBeenCalledWith(expect.objectContaining({ action: "TASK_TEAM_ASSIGNED" }));
  });

  it("allows clearing description and dueDate with null", async () => {
    const { service, tasks } = setup();

    await service.update("task-1", { description: null, dueDate: null }, "actor-1");

    expect(tasks.update).toHaveBeenCalledWith("task-1", { description: null, dueDate: null });
  });

  it("does not write or audit when nothing changes", async () => {
    const { service, tasks, audit } = setup();

    await service.update("task-1", {}, "actor-1");

    expect(tasks.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("changes the title of a manual task", async () => {
    const { service, tasks } = setup();

    await service.update("task-1", { title: "Novo título" }, "actor-1");

    expect(tasks.update).toHaveBeenCalledWith("task-1", { title: "Novo título" });
  });

  it("rejects changing the title of a rule-generated task (idempotency key)", async () => {
    const { service, tasks } = setup({ task: makeTask({ sourceRuleId: "rule-1" }) });

    await expect(service.update("task-1", { title: "Outro título" }, "actor-1")).rejects.toThrow(
      "O título de uma tarefa gerada por regra não pode ser alterado",
    );
    expect(tasks.update).not.toHaveBeenCalled();
  });

  it("allows description, dueDate and team changes on a rule-generated task", async () => {
    const { service, tasks } = setup({ task: makeTask({ sourceRuleId: "rule-1" }) });
    const dueDate = new Date("2026-11-01T00:00:00.000Z");

    await service.update("task-1", { title: "Confirmar decoração", description: "x", dueDate, assignedTeamId: "team-1" }, "actor-1");

    expect(tasks.update).toHaveBeenCalledWith("task-1", expect.objectContaining({ description: "x", dueDate, assignedTeamId: "team-1" }));
    expect(tasks.update.mock.calls[0]?.[1]).not.toHaveProperty("title");
  });

  it.each(["CONCLUIDA", "CANCELADA"] as const)("rejects editing a %s task", async (status) => {
    const { service, tasks } = setup({ task: makeTask({ status }) });

    await expect(service.update("task-1", { description: "x" }, "actor-1")).rejects.toThrow(TaskManagementError);
    expect(tasks.update).not.toHaveBeenCalled();
  });

  it("fills assignedAt when a team is assigned (null -> team) and audits the assignment", async () => {
    const { service, tasks, audit } = setup();

    await service.update("task-1", { assignedTeamId: "team-1" }, "actor-1");

    expect(tasks.update).toHaveBeenCalledWith("task-1", { assignedTeamId: "team-1", assignedAt: expect.any(Date) });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "TASK_TEAM_ASSIGNED", entityId: "task-1", changes: { before: null, after: "team-1" } }),
    );
  });

  it("refreshes assignedAt when the team changes", async () => {
    const { service, tasks, audit } = setup({
      task: makeTask({ assignedTeamId: "team-0", assignedAt: new Date("2026-10-01T00:00:00.000Z") }),
      linkedTeamIds: ["team-1"],
    });

    await service.update("task-1", { assignedTeamId: "team-1" }, "actor-1");

    const input = tasks.update.mock.calls[0]?.[1] as { assignedAt: Date };
    expect(input.assignedAt.getTime()).toBeGreaterThan(new Date("2026-10-01T00:00:00.000Z").getTime());
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "TASK_TEAM_ASSIGNED", changes: { before: "team-0", after: "team-1" } }),
    );
  });

  it("keeps assignedAt when the same team is sent again", async () => {
    const { service, tasks, teams } = setup({ task: makeTask({ assignedTeamId: "team-1", assignedAt: new Date() }) });

    await service.update("task-1", { assignedTeamId: "team-1" }, "actor-1");

    expect(tasks.update).not.toHaveBeenCalled();
    expect(teams.findById).not.toHaveBeenCalled();
  });

  it("clears assignedAt when the team is unassigned (null)", async () => {
    const { service, tasks, audit } = setup({ task: makeTask({ assignedTeamId: "team-1", assignedAt: new Date() }) });

    await service.update("task-1", { assignedTeamId: null }, "actor-1");

    expect(tasks.update).toHaveBeenCalledWith("task-1", { assignedTeamId: null, assignedAt: null });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "TASK_TEAM_ASSIGNED", changes: { before: "team-1", after: null } }),
    );
  });

  it("rejects assigning an inactive team", async () => {
    const { service, tasks } = setup({ teamStatus: "INATIVA" });

    await expect(service.update("task-1", { assignedTeamId: "team-1" }, "actor-1")).rejects.toThrow(TEAM_NOT_LINKED_MESSAGE);
    expect(tasks.update).not.toHaveBeenCalled();
  });

  it("rejects assigning a team not linked to the task's event", async () => {
    const { service, eventTeams } = setup({ linkedTeamIds: [] });

    await expect(service.update("task-1", { assignedTeamId: "team-1" }, "actor-1")).rejects.toThrow(TEAM_NOT_LINKED_MESSAGE);
    expect(eventTeams.listTeamsByEvent).toHaveBeenCalledWith("event-1");
  });
});

describe("TaskService.remove", () => {
  it("soft deletes a task and audits TASK_DELETED", async () => {
    const { service, tasks, audit } = setup({ task: makeTask({ sourceRuleId: "rule-1" }) });

    await service.remove("task-1", "actor-1");

    expect(tasks.softDelete).toHaveBeenCalledWith("task-1");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "actor-1", action: "TASK_DELETED", entity: "Task", entityId: "task-1" }),
    );
  });

  it("rejects deleting a missing task", async () => {
    const { service, tasks } = setup({ task: null });

    await expect(service.remove("task-1", "actor-1")).rejects.toThrow("Tarefa não encontrada");
    expect(tasks.softDelete).not.toHaveBeenCalled();
  });

  it.each(["CONCLUIDA", "CANCELADA"] as const)("rejects deleting a %s task", async (status) => {
    const { service, tasks } = setup({ task: makeTask({ status }) });

    await expect(service.remove("task-1", "actor-1")).rejects.toThrow(TaskManagementError);
    expect(tasks.softDelete).not.toHaveBeenCalled();
  });
});
