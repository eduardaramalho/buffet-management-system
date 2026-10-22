import type { PrismaClient } from "../../../generated/client.js";
import { formatAuditActivityMessage, toAuditChanges } from "../../../shared/auditActivity.js";

const TASK_STATUSES = ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"] as const;
type TaskStatus = (typeof TASK_STATUSES)[number];

type DashboardSummary = {
  eventsThisMonth: number;
  pendingTasks: number;
  activeTeams: number;
  completedOnTimePercentage: number | null;
};

type RecentActivity = {
  id: string;
  message: string;
  action: string;
  entity: string;
  createdAt: Date;
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
    const [eventsThisMonth, pendingTasks, activeTeams, completedTasks] = await Promise.all([
      this.prisma.event.count({ where: { deletedAt: null, eventDate: { gte: monthStart, lt: nextMonthStart } } }),
      this.prisma.task.count({ where: { deletedAt: null, status: { in: ["PENDENTE", "EM_ANDAMENTO"] } } }),
      this.prisma.team.count({ where: { deletedAt: null, status: "ATIVA" } }),
      this.prisma.task.findMany({ where: { deletedAt: null, status: "CONCLUIDA", dueDate: { not: null } }, select: { completedAt: true, dueDate: true } }),
    ]);

    const eligibleTasks = completedTasks.filter((task) => task.completedAt !== null && task.dueDate !== null);
    const completedOnTimePercentage = eligibleTasks.length === 0
      ? null
      : (eligibleTasks.filter((task) => task.completedAt! <= task.dueDate!).length / eligibleTasks.length) * 100;

    return { eventsThisMonth, pendingTasks, activeTeams, completedOnTimePercentage };
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

  async getRecentActivity(limit = 10): Promise<RecentActivity[]> {
    const logs = await this.prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    return Promise.all(logs.map(async (log) => {
      const changes = toAuditChanges(log.changes);
      const after = typeof changes?.after === "object" ? changes.after : null;
      let subject = changes?.name ?? changes?.title ?? after?.name ?? after?.title ?? changes?.eventName;
      if (!subject && log.entityId && log.action === "TEAM_AUTO_ASSIGNED") {
        const event = await this.prisma.event.findUnique({ where: { id: log.entityId }, select: { name: true } });
        subject = event?.name;
      }
      if (!subject && log.entityId && log.action === "TASK_STATUS_CHANGED") {
        const task = await this.prisma.task.findUnique({ where: { id: log.entityId }, select: { title: true } });
        subject = task?.title;
      }
      subject ??= log.entityId ?? log.entity;
      const message = formatAuditActivityMessage({ action: log.action, entity: log.entity, changes, subject });
      return { id: log.id, message, action: log.action, entity: log.entity, createdAt: log.createdAt };
    }));
  }
}
