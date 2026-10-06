import { describe, expect, it, jest } from "@jest/globals";
import { DashboardService } from "./DashboardService.js";

const now = new Date("2026-10-06T12:00:00.000Z");
const mockFunction = () => jest.fn() as jest.MockedFunction<(...args: any[]) => any>;

const createPrisma = () => ({
  event: { count: mockFunction(), findMany: mockFunction() },
  task: { count: mockFunction(), findMany: mockFunction(), groupBy: mockFunction() },
  team: { count: mockFunction() },
  auditLog: { findMany: mockFunction() },
});

describe("DashboardService", () => {
  it("returns the summary and null percentage when there are no eligible completed tasks", async () => {
    const prisma = createPrisma();
    prisma.event.count.mockResolvedValue(3);
    prisma.task.count.mockResolvedValueOnce(4).mockResolvedValueOnce(0);
    prisma.team.count.mockResolvedValue(2);
    prisma.task.findMany.mockResolvedValue([]);
    const service = new DashboardService(prisma as never, () => now);

    await expect(service.getSummary()).resolves.toEqual({
      eventsThisMonth: 3,
      pendingTasks: 4,
      activeTeams: 2,
      completedOnTimePercentage: null,
    });

    prisma.event.count.mockResolvedValue(0);
    prisma.task.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    prisma.team.count.mockResolvedValue(0);
    await expect(service.getSummary()).resolves.toEqual({
      eventsThisMonth: 0,
      pendingTasks: 0,
      activeTeams: 0,
      completedOnTimePercentage: null,
    });
  });

  it("lists upcoming events and returns an empty list when none exist", async () => {
    const prisma = createPrisma();
    const events = [{ id: "event-1", name: "Casamento", eventDate: now, location: "Salao", status: "CONFIRMADO" }];
    prisma.event.findMany.mockResolvedValueOnce(events).mockResolvedValueOnce([]);
    const service = new DashboardService(prisma as never, () => now);

    await expect(service.getUpcomingEvents()).resolves.toEqual(events);
    await expect(service.getUpcomingEvents(5)).resolves.toEqual([]);
  });

  it("returns every task status count and zeros when the grouped result is empty", async () => {
    const prisma = createPrisma();
    prisma.task.groupBy.mockResolvedValueOnce([
      { status: "PENDENTE", _count: { _all: 2 } },
      { status: "CONCLUIDA", _count: { _all: 3 } },
    ]).mockResolvedValueOnce([]);
    const service = new DashboardService(prisma as never);

    await expect(service.getTasksByStatus()).resolves.toEqual({ PENDENTE: 2, EM_ANDAMENTO: 0, CONCLUIDA: 3, CANCELADA: 0 });
    await expect(service.getTasksByStatus()).resolves.toEqual({ PENDENTE: 0, EM_ANDAMENTO: 0, CONCLUIDA: 0, CANCELADA: 0 });
  });

  it("formats recent activity and returns an empty list when there are no audit logs", async () => {
    const prisma = createPrisma();
    prisma.auditLog.findMany.mockResolvedValueOnce([
      { id: "audit-1", action: "EVENT_CREATED", entity: "Event", entityId: "event-1", changes: { name: "Casamento" }, createdAt: now },
      { id: "audit-2", action: "TASK_STATUS_CHANGED", entity: "Task", entityId: "task-1", changes: { title: "Convites", after: "CONCLUIDA" }, createdAt: now },
      { id: "audit-3", action: "UNKNOWN_ACTION", entity: "Team", entityId: "team-1", changes: null, createdAt: now },
    ]).mockResolvedValueOnce([]);
    const service = new DashboardService(prisma as never, () => now);

    await expect(service.getRecentActivity()).resolves.toEqual([
      { id: "audit-1", message: "Evento 'Casamento' criado", action: "EVENT_CREATED", entity: "Event", createdAt: now },
      { id: "audit-2", message: "Tarefa 'Convites' marcada como CONCLUIDA", action: "TASK_STATUS_CHANGED", entity: "Task", createdAt: now },
      { id: "audit-3", message: "UNKNOWN_ACTION em Team", action: "UNKNOWN_ACTION", entity: "Team", createdAt: now },
    ]);
    await expect(service.getRecentActivity()).resolves.toEqual([]);
  });
});
