import { describe, expect, it, jest } from "@jest/globals";
import { DashboardService } from "./DashboardService.js";

const now = new Date("2026-10-06T12:00:00.000Z");
const mockFunction = () => jest.fn() as jest.MockedFunction<(...args: any[]) => any>;

const createPrisma = () => ({
  event: { count: mockFunction(), findMany: mockFunction() },
  task: { count: mockFunction(), findMany: mockFunction(), groupBy: mockFunction() },
  team: { count: mockFunction() },
});

describe("DashboardService", () => {
  it("returns the summary and null percentage when there are no eligible completed tasks", async () => {
    const prisma = createPrisma();
    prisma.event.count.mockResolvedValue(3);
    prisma.task.count.mockResolvedValueOnce(4).mockResolvedValueOnce(1);
    prisma.team.count.mockResolvedValue(2);
    prisma.task.findMany.mockResolvedValue([]);
    const service = new DashboardService(prisma as never, () => now);

    await expect(service.getSummary()).resolves.toEqual({
      eventsThisMonth: 3,
      pendingTasks: 4,
      overdueTasks: 1,
      activeTeams: 2,
      completedOnTimePercentage: null,
    });

    prisma.event.count.mockResolvedValue(0);
    prisma.task.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    prisma.team.count.mockResolvedValue(0);
    await expect(service.getSummary()).resolves.toEqual({
      eventsThisMonth: 0,
      pendingTasks: 0,
      overdueTasks: 0,
      activeTeams: 0,
      completedOnTimePercentage: null,
    });
  });

  // Mesma definição de tarefa esquecida dos relatórios (report.metrics.ts): aberta e com o prazo vencido.
  it("counts open tasks whose deadline has passed as overdue", async () => {
    const prisma = createPrisma();
    prisma.event.count.mockResolvedValue(0);
    prisma.task.count.mockResolvedValue(0);
    prisma.team.count.mockResolvedValue(0);
    prisma.task.findMany.mockResolvedValue([]);

    await new DashboardService(prisma as never, () => now).getSummary();

    expect(prisma.task.count).toHaveBeenCalledWith({
      where: { deletedAt: null, status: { in: ["PENDENTE", "EM_ANDAMENTO"] }, dueDate: { lt: now } },
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

  it("does not expose the audit log feed (recent activity card removed from the dashboard)", () => {
    const service = new DashboardService(createPrisma() as never, () => now);

    expect("getRecentActivity" in service).toBe(false);
  });
});
