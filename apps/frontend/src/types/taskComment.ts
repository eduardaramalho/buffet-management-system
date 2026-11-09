// ADR 0017: same limit as the backend (TASK_COMMENT_MAX_LENGTH).
export const TASK_COMMENT_MAX_LENGTH = 2000

export type TaskComment = {
  id: string
  taskId: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
}
