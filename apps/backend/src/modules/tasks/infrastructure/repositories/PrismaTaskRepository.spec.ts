import { describe, expect, it, jest } from "@jest/globals";

import { PrismaTaskRepository } from "./PrismaTaskRepository.js";

describe("PrismaTaskRepository", () => {
  it("creates a task", async () => {
    const create = jest.fn(async (_input: unknown) => ({}));
    const repository = new PrismaTaskRepository({ task: { create } } as never);

    await repository.create({
      eventId: "event-1",
      title: "Confirmar decoração",
      description: null,
      dueDate: null,
      assignedTeamId: null,
      sourceRuleId: "rule-1",
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        eventId: "event-1",
        title: "Confirmar decoração",
        description: null,
        dueDate: null,
        assignedTeamId: null,
        sourceRuleId: "rule-1",
      },
    });
  });

  it("finds a task by id excluding soft-deleted records", async () => {
    const findFirst = jest.fn(async (_input: unknown) => null);
    const repository = new PrismaTaskRepository({ task: { findFirst } } as never);

    await repository.findById("task-1");

    expect(findFirst).toHaveBeenCalledWith({ where: { id: "task-1", deletedAt: null } });
  });

  it("lists tasks excluding soft-deleted records, filtering by eventId and status", async () => {
    const findMany = jest.fn(async (_input: unknown) => []);
    const repository = new PrismaTaskRepository({ task: { findMany } } as never);

    await repository.list({ eventId: "event-1", status: "PENDENTE" });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, eventId: "event-1", status: "PENDENTE" } }),
    );
  });

  it("lists all non-deleted tasks when no filter is given", async () => {
    const findMany = jest.fn(async (_input: unknown) => []);
    const repository = new PrismaTaskRepository({ task: { findMany } } as never);

    await repository.list({});

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null } }));
  });
});
