export const taskStatuses = ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export type TaskRecord = {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  status: TaskStatus;
  assignedTeamId: string | null;
  sourceRuleId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type CreateTaskInput = {
  eventId: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  assignedTeamId: string | null;
  sourceRuleId: string | null;
};

export type TaskListFilter = {
  eventId?: string;
  status?: TaskStatus;
};

export type UpdateTaskStatusInput = {
  status: TaskStatus;
};

export interface TaskRepository {
  create(input: CreateTaskInput): Promise<TaskRecord>;
  findById(id: string): Promise<TaskRecord | null>;
  list(filter: TaskListFilter): Promise<TaskRecord[]>;
  update(id: string, input: UpdateTaskStatusInput): Promise<TaskRecord>;
}

export type RuleApplicationRecord = {
  id: string;
  eventId: string;
  ruleId: string;
  appliedAt: Date;
};

// Idempotency guard: find/create/remove by (eventId, ruleId) instead of by its own id, since
// callers only ever reason about "has this rule already been applied to this event".
export interface RuleApplicationRepository {
  findByEventAndRule(eventId: string, ruleId: string): Promise<RuleApplicationRecord | null>;
  create(eventId: string, ruleId: string): Promise<RuleApplicationRecord>;
  remove(eventId: string, ruleId: string): Promise<void>;
}

// Read-only projection of RuleTaskTemplate: Part 1's RuleRepository/RuleEngineService does not
// expose templates, so this module reads the table directly instead of touching Part 1's code.
export type RuleTaskTemplateRecord = {
  id: string;
  ruleId: string;
  title: string;
  description: string | null;
  daysBeforeEvent: number | null;
};

export interface RuleTaskTemplateRepository {
  listByRuleId(ruleId: string): Promise<RuleTaskTemplateRecord[]>;
}

export type ExecutionResult = {
  tasksCreated: number;
  teamsAutoAssigned: number;
  alertsGenerated: number;
};

export type ApplyRulesOptions = {
  forceRuleId?: string;
};

export interface AuditService {
  record(input: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    changes?: Record<string, unknown>;
    reason?: string;
  }): Promise<void>;
}
