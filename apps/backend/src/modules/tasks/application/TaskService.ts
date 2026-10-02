import type { AuditService, TaskListFilter, TaskRepository, TaskStatus } from "../domain/task.types.js";

export class TaskManagementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskManagementError";
  }
}

// Mirrors EventStatus's terminal-state convention: once a task reaches CONCLUIDA/CANCELADA it
// can never return to a non-terminal status (no "reopening" a finished/cancelled task).
const TERMINAL_TASK_STATUSES: TaskStatus[] = ["CONCLUIDA", "CANCELADA"];
const NON_TERMINAL_TASK_STATUSES: TaskStatus[] = ["PENDENTE", "EM_ANDAMENTO"];

export class TaskService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly audit: AuditService,
  ) {}

  list(filter: TaskListFilter = {}) {
    return this.tasks.list(filter);
  }

  async get(id: string) {
    const task = await this.tasks.findById(id);
    if (!task) throw new TaskManagementError("Tarefa não encontrada");
    return task;
  }

  async updateStatus(id: string, status: TaskStatus, actorId: string) {
    const task = await this.tasks.findById(id);
    if (!task) throw new TaskManagementError("Tarefa não encontrada");

    if (TERMINAL_TASK_STATUSES.includes(task.status) && NON_TERMINAL_TASK_STATUSES.includes(status)) {
      throw new TaskManagementError("Tarefas concluídas ou canceladas não podem retornar a um estado não terminal");
    }

    const updated = await this.tasks.update(id, { status });
    await this.audit.record({
      userId: actorId,
      action: "TASK_STATUS_CHANGED",
      entity: "Task",
      entityId: id,
      changes: { before: task.status, after: status },
    });
    return updated;
  }
}
