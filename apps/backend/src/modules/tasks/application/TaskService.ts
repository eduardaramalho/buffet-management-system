import type {
  AuditService,
  CreateManualTaskInput,
  TaskListFilter,
  TaskReferenceReaders,
  TaskRepository,
  TaskStatus,
  UpdateTaskDetailsInput,
  UpdateTaskInput,
} from "../domain/task.types.js";
import { canTransitionTaskStatus, TASK_STATUS_LABELS } from "../domain/task.statusTransitions.js";

export class TaskManagementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskManagementError";
  }
}

// Mirrors EventStatus's terminal-state convention: a CONCLUIDA/CANCELADA task never changes again.
const TERMINAL_TASK_STATUSES: TaskStatus[] = ["CONCLUIDA", "CANCELADA"];
const TERMINAL_EVENT_STATUSES = ["CONCLUIDO", "CANCELADO"];
const ACTIVE_TEAM_STATUS = "ATIVA";
const TEAM_NOT_ALLOCATED_MESSAGE = "Aloque a equipe ao evento antes de atribuí-la à tarefa";

export class TaskService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly audit: AuditService,
    private readonly readers: TaskReferenceReaders,
  ) {}

  list(filter: TaskListFilter = {}) {
    return this.tasks.list(filter);
  }

  async get(id: string) {
    const task = await this.tasks.findById(id);
    if (!task) throw new TaskManagementError("Tarefa não encontrada");
    return task;
  }

  async create(input: CreateManualTaskInput, actorId: string) {
    const event = await this.readers.events.findById(input.eventId);
    if (!event || event.deletedAt) throw new TaskManagementError("Evento não encontrado");
    if (TERMINAL_EVENT_STATUSES.includes(event.status)) {
      throw new TaskManagementError("Não é possível criar tarefas em eventos concluídos ou cancelados");
    }

    const assignedTeamId = input.assignedTeamId ?? null;
    if (assignedTeamId) await this.assertTeamAssignable(input.eventId, assignedTeamId);

    const task = await this.tasks.create({
      eventId: input.eventId,
      title: input.title,
      description: input.description ?? null,
      dueDate: input.dueDate ?? null,
      assignedTeamId,
      assignedAt: assignedTeamId ? new Date() : null,
      sourceRuleId: null,
    });
    await this.audit.record({
      userId: actorId,
      action: "TASK_CREATED",
      entity: "Task",
      entityId: task.id,
      changes: { eventId: input.eventId, title: input.title },
    });
    if (assignedTeamId) await this.recordTeamAssignment(task.id, actorId, null, assignedTeamId);
    return task;
  }

  async update(id: string, input: UpdateTaskDetailsInput, actorId: string) {
    const task = await this.get(id);
    if (TERMINAL_TASK_STATUSES.includes(task.status)) {
      throw new TaskManagementError("Tarefas concluídas ou canceladas não podem ser editadas");
    }
    if (task.sourceRuleId && input.title !== undefined && input.title !== task.title) {
      // The title is the rule engine's idempotency key: renaming would make it regenerate the task.
      throw new TaskManagementError("O título de uma tarefa gerada por regra não pode ser alterado");
    }

    const data: UpdateTaskInput = {};
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const track = (field: "title" | "description" | "dueDate" | "assignedTeamId", value: string | Date | null) => {
      Object.assign(data, { [field]: value });
      before[field] = task[field];
      after[field] = value;
    };

    if (input.title !== undefined && input.title !== task.title) track("title", input.title);
    if (input.description !== undefined && input.description !== task.description) track("description", input.description);
    if (input.dueDate !== undefined && input.dueDate?.getTime() !== task.dueDate?.getTime()) track("dueDate", input.dueDate);

    const teamChanged = input.assignedTeamId !== undefined && input.assignedTeamId !== task.assignedTeamId;
    if (teamChanged) {
      if (input.assignedTeamId) await this.assertTeamAssignable(task.eventId, input.assignedTeamId);
      track("assignedTeamId", input.assignedTeamId ?? null);
      data.assignedAt = input.assignedTeamId ? new Date() : null;
    }

    if (Object.keys(data).length === 0) return task;

    const updated = await this.tasks.update(id, data);
    await this.audit.record({ userId: actorId, action: "TASK_UPDATED", entity: "Task", entityId: id, changes: { before, after } });
    if (teamChanged) await this.recordTeamAssignment(id, actorId, task.assignedTeamId, input.assignedTeamId ?? null);
    return updated;
  }

  async remove(id: string, actorId: string) {
    const task = await this.get(id);
    if (TERMINAL_TASK_STATUSES.includes(task.status)) {
      throw new TaskManagementError("Tarefas concluídas ou canceladas não podem ser excluídas");
    }
    await this.tasks.softDelete(id);
    await this.audit.record({
      userId: actorId,
      action: "TASK_DELETED",
      entity: "Task",
      entityId: id,
      changes: { eventId: task.eventId, title: task.title, sourceRuleId: task.sourceRuleId },
    });
  }

  private async assertTeamAssignable(eventId: string, teamId: string) {
    const team = await this.readers.teams.findById(teamId);
    if (!team || team.status !== ACTIVE_TEAM_STATUS) throw new TaskManagementError(TEAM_NOT_ALLOCATED_MESSAGE);
    const allocations = await this.readers.eventTeams.listTeamsByEvent(eventId);
    if (!allocations.some((allocation) => allocation.teamId === teamId)) throw new TaskManagementError(TEAM_NOT_ALLOCATED_MESSAGE);
  }

  private recordTeamAssignment(taskId: string, actorId: string, before: string | null, after: string | null) {
    return this.audit.record({
      userId: actorId,
      action: "TASK_TEAM_ASSIGNED",
      entity: "Task",
      entityId: taskId,
      changes: { before, after },
    });
  }

  async updateStatus(id: string, status: TaskStatus, actorId: string) {
    const task = await this.get(id);
    // ADR 0014: the backend owns the lifecycle; the board only offers the next valid statuses.
    if (TERMINAL_TASK_STATUSES.includes(task.status)) {
      throw new TaskManagementError("Tarefas concluídas ou canceladas não podem mudar de status");
    }
    if (task.status === status) throw new TaskManagementError(`A tarefa já está em ${TASK_STATUS_LABELS[status]}`);
    if (!canTransitionTaskStatus(task.status, status)) {
      throw new TaskManagementError(`Transição de status inválida: de ${TASK_STATUS_LABELS[task.status]} para ${TASK_STATUS_LABELS[status]}`);
    }
    // A closed event only lets its leftover open tasks be cancelled, so they stop counting as open.
    const event = await this.readers.events.findById(task.eventId);
    if (event && TERMINAL_EVENT_STATUSES.includes(event.status) && status !== "CANCELADA") {
      throw new TaskManagementError("Em eventos concluídos ou cancelados, as tarefas em aberto só podem ser canceladas");
    }

    const updated = await this.tasks.update(id, { status, completedAt: status === "CONCLUIDA" ? new Date() : null });
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
