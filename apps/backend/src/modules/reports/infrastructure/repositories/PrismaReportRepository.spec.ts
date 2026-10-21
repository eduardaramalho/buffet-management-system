import { describe, expect, it, jest } from "@jest/globals";

import { PrismaReportRepository } from "./PrismaReportRepository.js";

const from = new Date("2026-10-01T03:00:00.000Z");
const to = new Date("2026-11-01T02:59:59.999Z");
const now = new Date("2026-10-21T15:00:00.000Z");
const dueDateRef = { name: "dueDate", modelName: "Task" };

const eventPeriod = { deletedAt: null, eventDate: { gte: from, lte: to } };
const taskBase = { deletedAt: null, event: eventPeriod };

type Fn = ReturnType<typeof jest.fn>;
const fn = (value: unknown) => jest.fn(async (..._args: unknown[]) => value) as Fn;

describe("PrismaReportRepository.eventAggregates", () => {
  it("groups non-deleted events of the period by status and by service type, applying optional filters", async () => {
    const groupBy = jest.fn(async (args: { by: string[]; [key: string]: unknown }) => args.by[0] === "status"
      ? [{ status: "CONFIRMADO", _count: { _all: 2 } }]
      : [{ serviceType: "CASAMENTO", _count: { _all: 2 } }]);
    const repository = new PrismaReportRepository({ event: { groupBy } } as never);

    const result = await repository.eventAggregates({ from, to, status: "CONFIRMADO", serviceType: "CASAMENTO", clientId: "client-1" });

    const where = { ...eventPeriod, status: "CONFIRMADO", serviceType: "CASAMENTO", clientId: "client-1" };
    expect(groupBy).toHaveBeenCalledWith({ by: ["status"], where, _count: { _all: true } });
    expect(groupBy).toHaveBeenCalledWith({ by: ["serviceType"], where, _count: { _all: true } });
    expect(result).toEqual({ byStatus: [{ status: "CONFIRMADO", count: 2 }], byServiceType: [{ serviceType: "CASAMENTO", count: 2 }] });
  });
});

describe("PrismaReportRepository.eventRows", () => {
  it("loads one page of events and counts their tasks with a single grouped query (no N+1)", async () => {
    const findMany = fn([
      { id: "event-1", name: "Casamento", eventDate: from, status: "CONFIRMADO", serviceType: "CASAMENTO", guestsCount: 100, client: { name: "Ana" } },
      { id: "event-2", name: "Formatura", eventDate: to, status: "PLANEJAMENTO", serviceType: "FORMATURA", guestsCount: 50, client: null },
    ]);
    const taskGroupBy = fn([
      { eventId: "event-1", status: "CONCLUIDA", _count: { _all: 2 } },
      { eventId: "event-1", status: "PENDENTE", _count: { _all: 3 } },
    ]);
    const repository = new PrismaReportRepository({ event: { findMany }, task: { groupBy: taskGroupBy } } as never);

    const rows = await repository.eventRows({ from, to }, { page: 2, pageSize: 10 });

    expect(findMany).toHaveBeenCalledWith({
      where: eventPeriod,
      orderBy: [{ eventDate: "asc" }, { id: "asc" }],
      skip: 10,
      take: 10,
      select: { id: true, name: true, eventDate: true, status: true, serviceType: true, guestsCount: true, client: { select: { name: true } } },
    });
    expect(taskGroupBy).toHaveBeenCalledTimes(1);
    expect(taskGroupBy).toHaveBeenCalledWith({ by: ["eventId", "status"], where: { deletedAt: null, eventId: { in: ["event-1", "event-2"] } }, _count: { _all: true } });
    expect(rows).toEqual([
      { id: "event-1", name: "Casamento", eventDate: from, status: "CONFIRMADO", serviceType: "CASAMENTO", guestsCount: 100, clientName: "Ana", tasksTotal: 5, tasksCompleted: 2 },
      { id: "event-2", name: "Formatura", eventDate: to, status: "PLANEJAMENTO", serviceType: "FORMATURA", guestsCount: 50, clientName: null, tasksTotal: 0, tasksCompleted: 0 },
    ]);
  });

  it("loads every row without pagination for exports and skips the task query when there are no events", async () => {
    const findMany = fn([]);
    const taskGroupBy = fn([]);
    const repository = new PrismaReportRepository({ event: { findMany }, task: { groupBy: taskGroupBy } } as never);

    const rows = await repository.eventRows({ from, to });

    expect(findMany).toHaveBeenCalledWith(expect.not.objectContaining({ skip: expect.anything() }));
    expect(taskGroupBy).not.toHaveBeenCalled();
    expect(rows).toEqual([]);
  });
});

describe("PrismaReportRepository.taskAggregates", () => {
  it("runs a fixed set of aggregate queries and compares completion with the deadline in the database", async () => {
    const groupBy = fn([{ status: "PENDENTE", _count: { _all: 4 } }]);
    const count = jest.fn(async (args: { where: { AND: Array<Record<string, unknown>> } }) => {
      const extra = args.where.AND[1];
      if ("sourceRuleId" in extra) return 1;
      if ("dueDate" in extra) return 2;
      const completedAt = extra.completedAt as Record<string, unknown>;
      return "lte" in completedAt ? 3 : 4;
    });
    const repository = new PrismaReportRepository({ task: { groupBy, count, fields: { dueDate: dueDateRef } } } as never);

    const result = await repository.taskAggregates({ from, to, status: "PENDENTE", teamId: "team-1", origin: "REGRA" }, now);

    const where = { ...taskBase, status: "PENDENTE", assignedTeamId: "team-1", sourceRuleId: { not: null } };
    expect(groupBy).toHaveBeenCalledWith({ by: ["status"], where, _count: { _all: true } });
    expect(count).toHaveBeenCalledWith({ where: { AND: [where, { sourceRuleId: null }] } });
    expect(count).toHaveBeenCalledWith({ where: { AND: [where, { status: { in: ["PENDENTE", "EM_ANDAMENTO"] }, dueDate: { lt: now } }] } });
    expect(count).toHaveBeenCalledWith({ where: { AND: [where, { status: "CONCLUIDA", completedAt: { lte: dueDateRef } }] } });
    expect(count).toHaveBeenCalledWith({ where: { AND: [where, { status: "CONCLUIDA", completedAt: { gt: dueDateRef } }] } });
    expect(result).toEqual({ byStatus: [{ status: "PENDENTE", count: 4 }], manualCount: 1, overdueOpen: 2, completedOnTime: 3, completedLate: 4 });
  });

  it("filters manual tasks by the absence of a source rule", async () => {
    const groupBy = fn([]);
    const count = fn(0);
    const repository = new PrismaReportRepository({ task: { groupBy, count, fields: { dueDate: dueDateRef } } } as never);

    await repository.taskAggregates({ from, to, origin: "MANUAL" }, now);

    expect(groupBy).toHaveBeenCalledWith({ by: ["status"], where: { ...taskBase, sourceRuleId: null }, _count: { _all: true } });
  });
});

describe("PrismaReportRepository.taskRows", () => {
  it("loads tasks with event and team in the same query, ordered by event date", async () => {
    const createdAt = new Date("2026-10-02T12:00:00.000Z");
    const findMany = fn([{
      id: "task-1", title: "Montar salão", status: "PENDENTE", dueDate: null, completedAt: null, createdAt, assignedAt: null, sourceRuleId: null,
      event: { id: "event-1", name: "Casamento", eventDate: from }, assignedTeam: { name: "Salão" },
    }, {
      id: "task-2", title: "Alerta", status: "PENDENTE", dueDate: null, completedAt: null, createdAt, assignedAt: null, sourceRuleId: "rule-1",
      event: { id: "event-1", name: "Casamento", eventDate: from }, assignedTeam: null,
    }]);
    const repository = new PrismaReportRepository({ task: { findMany } } as never);

    const rows = await repository.taskRows({ from, to }, { page: 1, pageSize: 20 });

    expect(findMany).toHaveBeenCalledWith({
      where: taskBase,
      orderBy: [{ event: { eventDate: "asc" } }, { dueDate: "asc" }, { id: "asc" }],
      skip: 0,
      take: 20,
      select: {
        id: true, title: true, status: true, dueDate: true, completedAt: true, createdAt: true, assignedAt: true, sourceRuleId: true,
        event: { select: { id: true, name: true, eventDate: true } },
        assignedTeam: { select: { name: true } },
      },
    });
    expect(rows).toEqual([
      { id: "task-1", title: "Montar salão", status: "PENDENTE", dueDate: null, completedAt: null, createdAt, assignedAt: null, sourceRuleId: null, eventId: "event-1", eventName: "Casamento", eventDate: from, teamName: "Salão" },
      { id: "task-2", title: "Alerta", status: "PENDENTE", dueDate: null, completedAt: null, createdAt, assignedAt: null, sourceRuleId: "rule-1", eventId: "event-1", eventName: "Casamento", eventDate: from, teamName: null },
    ]);
  });

  it("loads every row without pagination for exports", async () => {
    const findMany = fn([]);
    const repository = new PrismaReportRepository({ task: { findMany } } as never);

    await repository.taskRows({ from, to });

    expect(findMany).toHaveBeenCalledWith(expect.not.objectContaining({ take: expect.anything() }));
  });
});

describe("PrismaReportRepository.teamPerformance", () => {
  it("aggregates per team in one parameterized SQL query and normalizes driver numeric types", async () => {
    const queryRaw = fn([{
      teamId: "team-1", teamName: "Cozinha", specialty: "COZINHA",
      total: 10n, completed: "6", completedOnTime: 3, completedLate: { toString: () => "1" }, overdueOpen: 2n, canceled: null,
      ruleAssignedCount: 2n, ruleAssignmentSeconds: "7200", manualAssignedCount: 0n, manualAssignmentSeconds: null,
    }]);
    const repository = new PrismaReportRepository({ $queryRaw: queryRaw } as never);

    const result = await repository.teamPerformance({ from, to }, now);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const query = queryRaw.mock.calls[0][0] as { sql: string; values: unknown[] };
    expect(query.values).toEqual([now, from, to]);
    expect(query.sql).toContain("FROM tasks t");
    expect(query.sql).toContain("INNER JOIN events e ON e.id = t.event_id");
    expect(query.sql).toContain("INNER JOIN teams tm ON tm.id = t.assigned_team_id");
    expect(query.sql).toContain("t.deleted_at IS NULL AND e.deleted_at IS NULL");
    expect(query.sql).toContain("e.event_date BETWEEN ? AND ?");
    expect(query.sql).toContain("TIMESTAMPDIFF(SECOND, t.created_at, t.assigned_at)");
    expect(query.sql).toContain("GROUP BY t.assigned_team_id, tm.name, tm.specialty");
    expect(result).toEqual([{
      teamId: "team-1", teamName: "Cozinha", specialty: "COZINHA",
      total: 10, completed: 6, completedOnTime: 3, completedLate: 1, overdueOpen: 2, canceled: 0,
      ruleAssignedCount: 2, ruleAssignmentSeconds: 7200, manualAssignedCount: 0, manualAssignmentSeconds: 0,
    }]);
  });
});
