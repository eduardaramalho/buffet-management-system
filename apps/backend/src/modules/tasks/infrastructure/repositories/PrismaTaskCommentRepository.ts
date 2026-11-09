import type { PrismaClient } from "../../../../generated/client.js";
import type { CreateTaskCommentInput, TaskCommentRecord, TaskCommentRepository } from "../../domain/taskComment.types.js";

const withAuthorName = { author: { select: { name: true } } } as const;

type CommentRow = {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  author: { name: string };
};

const toRecord = ({ id, taskId, authorId, body, createdAt, author }: CommentRow): TaskCommentRecord => ({
  id,
  taskId,
  authorId,
  authorName: author.name,
  body,
  createdAt,
});

export class PrismaTaskCommentRepository implements TaskCommentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByTask(taskId: string) {
    const rows = await this.prisma.taskComment.findMany({
      where: { taskId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: withAuthorName,
    });
    return rows.map(toRecord);
  }

  async create(input: CreateTaskCommentInput) {
    return toRecord(await this.prisma.taskComment.create({ data: input, include: withAuthorName }));
  }
}
