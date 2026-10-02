import type { PrismaClient } from "../../../../generated/client.js";
import type { CreateTaskInput, TaskListFilter, TaskRecord, TaskRepository } from "../../domain/task.types.js";

export class PrismaTaskRepository implements TaskRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: CreateTaskInput) {
    return this.prisma.task.create({ data: input }) as Promise<TaskRecord>;
  }

  findById(id: string) {
    return this.prisma.task.findFirst({ where: { id, deletedAt: null } }) as Promise<TaskRecord | null>;
  }

  list(filter: TaskListFilter) {
    return this.prisma.task.findMany({
      where: {
        deletedAt: null,
        ...(filter.eventId ? { eventId: filter.eventId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: { createdAt: "asc" },
    }) as Promise<TaskRecord[]>;
  }
}
