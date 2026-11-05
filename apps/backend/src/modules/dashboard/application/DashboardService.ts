import type { PrismaClient } from "../../../generated/client.js";

const TASK_STATUSES = ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"] as const;
type TaskStatus = (typeof TASK_STATUSES)[number];
const OPEN_TASK_STATUSES: TaskStatus[] = ["PENDENTE", "EM_ANDAMENTO"];

type DashboardSummary = {
  eventsThisMonth: number;
  pendingTasks: number;
  /** Open tasks past their deadline: the "forgotten" tasks of the RFC hypothesis, same rule as the reports. */
  overdueTasks: number;
  activeTeams: number;
  completedOnTimePercentage: number | null;
};

export class DashboardService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async getSummary(): Promise<DashboardSummary> {
    const currentDate = this.clock();
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const nextMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const [eventsThisMonth, pendingTasks, overdueTasks, activeTeams, completedTasks] = await Promise.all([
      this.prisma.event.count({ where: { deletedAt: null, eventDate: { gte: monthStart, lt: nextMonthStart } } }),
      this.prisma.task.count({ where: { deletedAt: null, status: { in: OPEN_TASK_STATUSES } } }),
      this.prisma.task.count({ where: { deletedAt: null, status: { in: OPEN_TASK_STATUSES }, dueDate: { lt: currentDate } } }),
      this.prisma.team.count({ where: { deletedAt: null, status: "ATIVA" } }),
      this.prisma.task.findMany({ where: { deletedAt: null, status: "CONCLUIDA", dueDate: { not: null } }, select: { completedAt: true, dueDate: true } }),
    ]);

    const eligibleTasks = completedTasks.filter((task) => task.completedAt !== null && task.dueDate !== null);
    const completedOnTimePercentage = eligibleTasks.length === 0
      ? null
      : (eligibleTasks.filter((task) => task.completedAt! <= task.dueDate!).length / eligibleTasks.length) * 100;

    return { eventsThisMonth, pendingTasks, overdueTasks, activeTeams, completedOnTimePercentage };
  }

  getUpcomingEvents(limit = 5) {
    return this.prisma.event.findMany({
      where: { deletedAt: null, eventDate: { gte: this.clock() }, status: { not: "CANCELADO" } },
      orderBy: { eventDate: "asc" },
      take: limit,
      select: { id: true, name: true, eventDate: true, location: true, status: true },
    });
  }

  async getTasksByStatus(): Promise<Record<TaskStatus, number>> {
    const grouped = await this.prisma.task.groupBy({
      by: ["status"],
      where: { deletedAt: null, status: { in: [...TASK_STATUSES] } },
      _count: { _all: true },
    });
    const result = Object.fromEntries(TASK_STATUSES.map((status) => [status, 0])) as Record<TaskStatus, number>;
    for (const item of grouped) result[item.status as TaskStatus] = item._count._all;
    return result;
  }
}
