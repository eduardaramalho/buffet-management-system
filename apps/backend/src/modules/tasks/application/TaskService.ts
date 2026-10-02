import type { TaskListFilter, TaskRepository } from "../domain/task.types.js";

export class TaskManagementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskManagementError";
  }
}

export class TaskService {
  constructor(private readonly tasks: TaskRepository) {}

  list(filter: TaskListFilter = {}) {
    return this.tasks.list(filter);
  }

  async get(id: string) {
    const task = await this.tasks.findById(id);
    if (!task) throw new TaskManagementError("Tarefa não encontrada");
    return task;
  }
}
