// ADR 0017: comments on a task. Same limit in the Zod schema and in the frontend form.
export const TASK_COMMENT_MAX_LENGTH = 2000;

export type TaskCommentRecord = {
  id: string;
  taskId: string;
  authorId: string;
  // Denormalized for the response only: the board shows who wrote it without a second request.
  authorName: string;
  body: string;
  createdAt: Date;
};

export type CreateTaskCommentInput = {
  taskId: string;
  authorId: string;
  body: string;
};

export interface TaskCommentRepository {
  // Oldest first, soft-deleted rows excluded.
  listByTask(taskId: string): Promise<TaskCommentRecord[]>;
  create(input: CreateTaskCommentInput): Promise<TaskCommentRecord>;
}
