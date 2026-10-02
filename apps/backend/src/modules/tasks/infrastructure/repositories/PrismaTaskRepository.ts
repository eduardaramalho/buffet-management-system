import type { PrismaClient } from "../../../../generated/client.js";
import type { TransactionClient } from "../../../../shared/domain/transaction.types.js";
import type { CreateTaskInput, TaskListFilter, TaskRecord, TaskRepository, UpdateTaskStatusInput } from "../../domain/task.types.js";

export class PrismaTaskRepository implements TaskRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: CreateTaskInput, tx?: TransactionClient) {
    const client = (tx as PrismaClient | undefined) ?? this.prisma;
    return client.task.create({ data: input }) as Promise<TaskRecord>;
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

  update(id: string, input: UpdateTaskStatusInput) {
    return this.prisma.task.update({ where: { id }, data: input }) as Promise<TaskRecord>;
  }
}
