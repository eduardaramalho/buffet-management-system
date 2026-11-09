import type { AuditService, TaskRepository } from "../domain/task.types.js";
import type { TaskCommentRepository } from "../domain/taskComment.types.js";
import { TaskManagementError } from "./TaskService.js";

/**
 * ADR 0017: comments are a separate use case from editing the task, so the colaborador can comment
 * (tasks:comment) without the tasks:update permission. Terminal tasks still accept comments: the
 * status is frozen, the post-event notes are not.
 */
export class TaskCommentService {
  constructor(
    private readonly comments: TaskCommentRepository,
    private readonly tasks: Pick<TaskRepository, "findById">,
    private readonly audit: AuditService,
  ) {}

  async list(taskId: string) {
    await this.assertTaskExists(taskId);
    return this.comments.listByTask(taskId);
  }

  async create(taskId: string, body: string, actorId: string) {
    await this.assertTaskExists(taskId);
    const comment = await this.comments.create({ taskId, authorId: actorId, body });
    await this.audit.record({
      userId: actorId,
      action: "TASK_COMMENTED",
      entity: "Task",
      entityId: taskId,
      changes: { commentId: comment.id },
    });
    return comment;
  }

  private async assertTaskExists(taskId: string) {
    const task = await this.tasks.findById(taskId);
    if (!task) throw new TaskManagementError("Tarefa não encontrada");
  }
}
