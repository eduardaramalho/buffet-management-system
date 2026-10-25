import { describe, expect, it, jest } from "@jest/globals";

import { RuleEngineExecutionService, RuleEngineExecutionError } from "./RuleEngineExecutionService.js";
import { EventTeamManagementError } from "../../teams/application/EventTeamService.js";
import type { EventTeamService } from "../../teams/application/EventTeamService.js";
import type { TeamRepository } from "../../teams/domain/team.types.js";
import type { EventRecord, EventRepository } from "../../events/domain/event.types.js";
import type { RuleEngineService } from "../../rules/application/RuleEngineService.js";
import type { MatchedRule } from "../../rules/domain/rule.types.js";
import type { TransactionRunner } from "../../../shared/domain/transaction.types.js";
import type {
  AuditService,
  CreateTaskInput,
  RuleApplicationRepository,
  RuleTaskTemplateRepository,
  TaskRecord,
  TaskRepository,
} from "../domain/task.types.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const makeEvent = (overrides: Partial<EventRecord> = {}): EventRecord => ({
  id: "event-1",
  name: "Casamento Ana e Bruno",
  eventDate: new Date("2026-12-01T18:00:00.000Z"),
  endDate: null,
  location: "Salão Jardim",
  serviceType: "CASAMENTO",
  guestsCount: 150,
  observations: null,
  status: "CONFIRMADO",
  createdById: "actor-1",
  createdAt: new Date("2026-09-28T00:00:00.000Z"),
  updatedAt: new Date("2026-09-28T00:00:00.000Z"),
  deletedAt: null,
  services: [],
  clientId: null,
  client: null,
  ...overrides,
});

const makeMatch = (overrides: Partial<MatchedRule> = {}): MatchedRule => ({
  rule: {
    id: "rule-1",
    name: "Casamento grande precisa de bar",
    description: null,
    isActive: true,
    conditionServiceTypeIn: null,
    conditionMinGuests: null,
    conditionMaxGuests: null,
    conditionRequiredServiceIds: null,
    createdById: "actor-1",
    createdAt: new Date("2026-09-28T00:00:00.000Z"),
    updatedAt: new Date("2026-09-28T00:00:00.000Z"),
    deletedAt: null,
    resourceRequirements: [{ id: "req-1", specialty: "BAR", minQuantity: 1 }],
    taskTemplates: [],
  },
  resourceRequirements: [{ id: "req-1", specialty: "BAR", minQuantity: 1 }],
  ...overrides,
});

// Minimal fake transactional plumbing: a tx token groups staged writes; FakeTransactionRunner only
// applies them to the backing in-memory fakes once the wrapped work resolves, mirroring
// prisma.$transaction rolling back everything when the callback throws (no real database needed).
type FakeTx = { commits: Array<() => void> };

const makeFakeTransactionRunner = (): TransactionRunner => ({
  run: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => {
    const tx: FakeTx = { commits: [] };
    const result = await work(tx);
    tx.commits.forEach((commit) => commit());
    return result;
  }),
}) as unknown as TransactionRunner;

// Stateful fake: real idempotency/forced-reprocessing behaviour cannot be verified with
// canned jest.fn() return values alone, it needs an in-memory store that persists across calls.
const makeRuleApplicationFake = (): RuleApplicationRepository => {
  const store = new Map<string, { id: string; eventId: string; ruleId: string; appliedAt: Date }>();
  const key = (eventId: string, ruleId: string) => `${eventId}:${ruleId}`;
  let nextId = 1;
  return {
    findByEventAndRule: jest.fn(async (eventId: string, ruleId: string) => store.get(key(eventId, ruleId)) ?? null),
    create: jest.fn(async (eventId: string, ruleId: string, tx?: unknown) => {
      const record = { id: `ra-${nextId++}`, eventId, ruleId, appliedAt: new Date() };
      const commit = () => store.set(key(eventId, ruleId), record);
      if (tx) (tx as FakeTx).commits.push(commit); else commit();
      return record;
    }),
    remove: jest.fn(async (eventId: string, ruleId: string) => {
      store.delete(key(eventId, ruleId));
    }),
  };
};

const makeTaskRepositoryFake = (): TaskRepository & { created: TaskRecord[] } => {
  const created: TaskRecord[] = [];
  let nextId = 1;
  return {
    created,
    create: jest.fn(async (input: CreateTaskInput, tx?: unknown) => {
      const task: TaskRecord = {
        id: `task-${nextId++}`,
        status: "PENDENTE",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...input,
      };
      const commit = () => created.push(task);
      if (tx) (tx as FakeTx).commits.push(commit); else commit();
      return task;
    }),
    findById: jest.fn(async (id: string) => created.find((task) => task.id === id) ?? null),
    list: jest.fn(async () => created),
    listAllByEventId: jest.fn(async (eventId: string) => created.filter((task) => task.eventId === eventId)),
    update: jest.fn(async (id: string, input: { status: TaskRecord["status"] }) => {
      const task = created.find((t) => t.id === id);
      if (!task) throw new Error("task not found");
      Object.assign(task, input);
      return task;
    }),
  };
};

const makeEventTeamServiceFake = (options: { shouldConflict?: (teamId: string) => boolean } = {}) => {
  const assignments: { eventId: string; teamId: string }[] = [];
  return {
    listTeamsByEvent: jest.fn(async (eventId: string) => assignments.filter((assignment) => assignment.eventId === eventId)),
    assignTeamToEvent: jest.fn(async (eventId: string, teamId: string, actorId: string, tx?: unknown) => {
      if (options.shouldConflict?.(teamId)) {
        throw new EventTeamManagementError("conflito de agenda: a equipe já está atribuída a outro evento");
      }
      const commit = () => assignments.push({ eventId, teamId });
      if (tx) (tx as FakeTx).commits.push(commit); else commit();
      return { eventId, teamId, assignedAt: new Date(), assignedById: actorId };
    }),
  };
};

const makeExecutionHarness = (templates: Array<{ id: string; ruleId: string; title: string; description: string | null; daysBeforeEvent: number | null }>, teamsList = [{ id: "team-1", specialty: "BAR", status: "ATIVA" }]) => {
  const event = makeEvent();
  const match = makeMatch();
  const ruleEngine = { evaluate: jest.fn(async () => [match]) } as unknown as RuleEngineService;
  const events = { findById: jest.fn(async () => event) } as unknown as EventRepository;
  const teams = { list: jest.fn(async () => teamsList) } as unknown as TeamRepository;
  const eventTeamService = makeEventTeamServiceFake();
  const tasks = makeTaskRepositoryFake();
  const ruleApplications = makeRuleApplicationFake();
  const ruleTaskTemplates = { listByRuleId: jest.fn(async () => templates) } as unknown as RuleTaskTemplateRepository;
  const audit = { record: jest.fn(async () => undefined) } as unknown as AuditService;
  const service = new RuleEngineExecutionService(
    ruleEngine,
    events,
    teams,
    eventTeamService as unknown as EventTeamService,
    tasks,
    ruleApplications,
    ruleTaskTemplates,
    audit,
    makeFakeTransactionRunner(),
  );
  return { service, tasks, audit, eventTeamService, templates };
};

describe("RuleEngineExecutionService", () => {
  it("applies a matched rule for the first time: assigns an available team and generates the template task", async () => {
    const event = makeEvent();
    const match = makeMatch();
    const ruleEngine = { evaluate: jest.fn(async () => [match]) } as unknown as RuleEngineService;
    const events = { findById: jest.fn(async () => event) } as unknown as EventRepository;
    const teams = { list: jest.fn(async () => [{ id: "team-1", specialty: "BAR", status: "ATIVA" }]) } as unknown as TeamRepository;
    const eventTeamService = makeEventTeamServiceFake();
    const tasks = makeTaskRepositoryFake();
    const ruleApplications = makeRuleApplicationFake();
    const ruleTaskTemplates = {
      listByRuleId: jest.fn(async () => [{ id: "tpl-1", ruleId: "rule-1", title: "Confirmar decoração", description: null, daysBeforeEvent: 7 }]),
    } as unknown as RuleTaskTemplateRepository;
    const audit = { record: jest.fn(async () => undefined) } as unknown as AuditService;

    const service = new RuleEngineExecutionService(
      ruleEngine,
      events,
      teams,
      eventTeamService as unknown as EventTeamService,
      tasks,
      ruleApplications,
      ruleTaskTemplates,
      audit,
      makeFakeTransactionRunner(),
    );

    const result = await service.applyRules("event-1", "actor-1");

    expect(eventTeamService.assignTeamToEvent).toHaveBeenCalledWith("event-1", "team-1", "actor-1", expect.anything());
    expect(tasks.create).toHaveBeenCalledWith(expect.objectContaining({
      eventId: "event-1",
      title: "Confirmar decoração",
      sourceRuleId: "rule-1",
      assignedTeamId: null,
      dueDate: new Date(event.eventDate.getTime() - 7 * MS_PER_DAY),
    }), expect.anything());
    expect(ruleApplications.create).toHaveBeenCalledWith("event-1", "rule-1", expect.anything());
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "TEAM_AUTO_ASSIGNED", entity: "Event" }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "TASK_GENERATED", entity: "Task" }));
    expect(result).toEqual({ tasksCreated: 1, tasksSkipped: 0, teamsAutoAssigned: 1, alertsGenerated: 0 });
  });

  it("applying the same rule twice on the same event does not duplicate tasks or team assignments (idempotency)", async () => {
    const event = makeEvent();
    const match = makeMatch();
    const ruleEngine = { evaluate: jest.fn(async () => [match]) } as unknown as RuleEngineService;
    const events = { findById: jest.fn(async () => event) } as unknown as EventRepository;
    const teams = { list: jest.fn(async () => [{ id: "team-1", specialty: "BAR", status: "ATIVA" }]) } as unknown as TeamRepository;
    const eventTeamService = makeEventTeamServiceFake();
    const tasks = makeTaskRepositoryFake();
    const ruleApplications = makeRuleApplicationFake();
    const ruleTaskTemplates = {
      listByRuleId: jest.fn(async () => [{ id: "tpl-1", ruleId: "rule-1", title: "Confirmar decoração", description: null, daysBeforeEvent: 7 }]),
    } as unknown as RuleTaskTemplateRepository;
    const audit = { record: jest.fn(async () => undefined) } as unknown as AuditService;
    const service = new RuleEngineExecutionService(
      ruleEngine,
      events,
      teams,
      eventTeamService as unknown as EventTeamService,
      tasks,
      ruleApplications,
      ruleTaskTemplates,
      audit,
      makeFakeTransactionRunner(),
    );

    const first = await service.applyRules("event-1", "actor-1");
    const second = await service.applyRules("event-1", "actor-1");

    expect(first).toEqual({ tasksCreated: 1, tasksSkipped: 0, teamsAutoAssigned: 1, alertsGenerated: 0 });
    expect(second).toEqual({ tasksCreated: 0, tasksSkipped: 0, teamsAutoAssigned: 0, alertsGenerated: 0 });
    expect(tasks.create).toHaveBeenCalledTimes(1);
    expect(eventTeamService.assignTeamToEvent).toHaveBeenCalledTimes(1);
    expect(ruleApplications.create).toHaveBeenCalledTimes(1);
  });

  it("creates an alert task without assignedTeamId when no team of the required specialty is available", async () => {
    const event = makeEvent();
    const match = makeMatch();
    const ruleEngine = { evaluate: jest.fn(async () => [match]) } as unknown as RuleEngineService;
    const events = { findById: jest.fn(async () => event) } as unknown as EventRepository;
    const teams = { list: jest.fn(async () => []) } as unknown as TeamRepository;
    const eventTeamService = makeEventTeamServiceFake();
    const tasks = makeTaskRepositoryFake();
    const ruleApplications = makeRuleApplicationFake();
    const ruleTaskTemplates = { listByRuleId: jest.fn(async () => []) } as unknown as RuleTaskTemplateRepository;
    const audit = { record: jest.fn(async () => undefined) } as unknown as AuditService;
    const service = new RuleEngineExecutionService(
      ruleEngine,
      events,
      teams,
      eventTeamService as unknown as EventTeamService,
      tasks,
      ruleApplications,
      ruleTaskTemplates,
      audit,
      makeFakeTransactionRunner(),
    );

    const result = await service.applyRules("event-1", "actor-1");

    expect(eventTeamService.assignTeamToEvent).not.toHaveBeenCalled();
    expect(tasks.create).toHaveBeenCalledWith(expect.objectContaining({ eventId: "event-1", assignedTeamId: null, sourceRuleId: "rule-1" }), expect.anything());
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "TASK_GENERATED" }));
    expect(result).toEqual({ tasksCreated: 1, tasksSkipped: 0, teamsAutoAssigned: 0, alertsGenerated: 1 });
  });

  it("skips a team with a scheduling conflict and tries the next candidate instead of throwing", async () => {
    const event = makeEvent();
    const match = makeMatch();
    const ruleEngine = { evaluate: jest.fn(async () => [match]) } as unknown as RuleEngineService;
    const events = { findById: jest.fn(async () => event) } as unknown as EventRepository;
    const teams = {
      list: jest.fn(async () => [
        { id: "team-1", specialty: "BAR", status: "ATIVA" },
        { id: "team-2", specialty: "BAR", status: "ATIVA" },
      ]),
    } as unknown as TeamRepository;
    const eventTeamService = makeEventTeamServiceFake({ shouldConflict: (teamId) => teamId === "team-1" });
    const tasks = makeTaskRepositoryFake();
    const ruleApplications = makeRuleApplicationFake();
    const ruleTaskTemplates = { listByRuleId: jest.fn(async () => []) } as unknown as RuleTaskTemplateRepository;
    const audit = { record: jest.fn(async () => undefined) } as unknown as AuditService;
    const service = new RuleEngineExecutionService(
      ruleEngine,
      events,
      teams,
      eventTeamService as unknown as EventTeamService,
      tasks,
      ruleApplications,
      ruleTaskTemplates,
      audit,
      makeFakeTransactionRunner(),
    );

    const result = await service.applyRules("event-1", "actor-1");

    expect(eventTeamService.assignTeamToEvent).toHaveBeenCalledWith("event-1", "team-1", "actor-1", expect.anything());
    expect(eventTeamService.assignTeamToEvent).toHaveBeenCalledWith("event-1", "team-2", "actor-1", expect.anything());
    expect(result).toEqual({ tasksCreated: 0, tasksSkipped: 0, teamsAutoAssigned: 1, alertsGenerated: 0 });
  });

  it("forced reprocessing keeps existing template tasks and reports them as skipped", async () => {
    const event = makeEvent();
    const match = makeMatch();
    const ruleEngine = { evaluate: jest.fn(async () => [match]) } as unknown as RuleEngineService;
    const events = { findById: jest.fn(async () => event) } as unknown as EventRepository;
    const teams = { list: jest.fn(async () => [{ id: "team-1", specialty: "BAR", status: "ATIVA" }]) } as unknown as TeamRepository;
    const eventTeamService = makeEventTeamServiceFake();
    const tasks = makeTaskRepositoryFake();
    const ruleApplications = makeRuleApplicationFake();
    const ruleTaskTemplates = {
      listByRuleId: jest.fn(async () => [{ id: "tpl-1", ruleId: "rule-1", title: "Confirmar decoração", description: null, daysBeforeEvent: 7 }]),
    } as unknown as RuleTaskTemplateRepository;
    const audit = { record: jest.fn(async () => undefined) } as unknown as AuditService;
    const service = new RuleEngineExecutionService(
      ruleEngine,
      events,
      teams,
      eventTeamService as unknown as EventTeamService,
      tasks,
      ruleApplications,
      ruleTaskTemplates,
      audit,
      makeFakeTransactionRunner(),
    );

    await service.applyRules("event-1", "actor-1");
    const second = await service.applyRules("event-1", "actor-1", { forceRuleId: "rule-1" });

    expect(ruleApplications.remove).toHaveBeenCalledWith("event-1", "rule-1");
    expect(second).toEqual({ tasksCreated: 0, tasksSkipped: 1, teamsAutoAssigned: 0, alertsGenerated: 0 });
    expect(tasks.create).toHaveBeenCalledTimes(1);
    expect(ruleApplications.create).toHaveBeenCalledTimes(2);
  });

  it("forced reprocessing creates only a template added after the first application", async () => {
    const harness = makeExecutionHarness([{ id: "tpl-1", ruleId: "rule-1", title: "Primeira", description: null, daysBeforeEvent: null }]);
    await harness.service.applyRules("event-1", "actor-1");
    harness.templates.push({ id: "tpl-2", ruleId: "rule-1", title: "Nova", description: null, daysBeforeEvent: null });

    const result = await harness.service.applyRules("event-1", "actor-1", { forceRuleId: "rule-1" });

    expect(result).toEqual({ tasksCreated: 1, tasksSkipped: 1, teamsAutoAssigned: 0, alertsGenerated: 0 });
    expect(harness.tasks.created.map((task) => task.title)).toEqual(["Primeira", "Nova"]);
  });

  it("does not recreate a cancelled template task", async () => {
    const harness = makeExecutionHarness([{ id: "tpl-1", ruleId: "rule-1", title: "Cancelar depois", description: null, daysBeforeEvent: null }]);
    await harness.service.applyRules("event-1", "actor-1");
    harness.tasks.created[0].status = "CANCELADA";

    const result = await harness.service.applyRules("event-1", "actor-1", { forceRuleId: "rule-1" });

    expect(result.tasksCreated).toBe(0);
    expect(result.tasksSkipped).toBe(1);
    expect(harness.tasks.created).toHaveLength(1);
  });

  it("does not recreate a soft-deleted template task", async () => {
    const harness = makeExecutionHarness([{ id: "tpl-1", ruleId: "rule-1", title: "Excluir depois", description: null, daysBeforeEvent: null }]);
    await harness.service.applyRules("event-1", "actor-1");
    harness.tasks.created[0].deletedAt = new Date();

    const result = await harness.service.applyRules("event-1", "actor-1", { forceRuleId: "rule-1" });

    expect(result.tasksCreated).toBe(0);
    expect(result.tasksSkipped).toBe(1);
    expect(harness.tasks.created).toHaveLength(1);
  });

  it("handles two template titles independently", async () => {
    const harness = makeExecutionHarness([
      { id: "tpl-1", ruleId: "rule-1", title: "Primeira", description: null, daysBeforeEvent: null },
      { id: "tpl-2", ruleId: "rule-1", title: "Segunda", description: null, daysBeforeEvent: null },
    ]);
    await harness.service.applyRules("event-1", "actor-1");

    const result = await harness.service.applyRules("event-1", "actor-1", { forceRuleId: "rule-1" });

    expect(result.tasksCreated).toBe(0);
    expect(result.tasksSkipped).toBe(2);
    expect(harness.tasks.created).toHaveLength(2);
  });

  it("does not duplicate a shortage alert during successive forced reprocessing", async () => {
    const harness = makeExecutionHarness([], []);
    await harness.service.applyRules("event-1", "actor-1");

    const result = await harness.service.applyRules("event-1", "actor-1", { forceRuleId: "rule-1" });

    expect(result).toEqual({ tasksCreated: 0, tasksSkipped: 1, teamsAutoAssigned: 0, alertsGenerated: 0 });
    expect(harness.tasks.created).toHaveLength(1);
    expect(harness.audit.record).toHaveBeenCalledTimes(1);
  });

  it("does not leave a partial write when the final RuleApplication write fails mid-loop (atomicity)", async () => {
    const event = makeEvent();
    const match = makeMatch();
    const ruleEngine = { evaluate: jest.fn(async () => [match]) } as unknown as RuleEngineService;
    const events = { findById: jest.fn(async () => event) } as unknown as EventRepository;
    const teams = { list: jest.fn(async () => [{ id: "team-1", specialty: "BAR", status: "ATIVA" }]) } as unknown as TeamRepository;
    const eventTeamService = makeEventTeamServiceFake();
    const tasks = makeTaskRepositoryFake();
    const ruleTaskTemplates = {
      listByRuleId: jest.fn(async () => [{ id: "tpl-1", ruleId: "rule-1", title: "Confirmar decoração", description: null, daysBeforeEvent: 7 }]),
    } as unknown as RuleTaskTemplateRepository;
    const audit = { record: jest.fn(async () => undefined) } as unknown as AuditService;
    // Simulates a crash right before the idempotency marker is written: team assignment and task
    // creation (the two earlier writes of this same rule application) must not survive either.
    const ruleApplications: RuleApplicationRepository = {
      findByEventAndRule: jest.fn(async () => null),
      create: jest.fn(async () => { throw new Error("falha simulada de escrita no banco"); }),
      remove: jest.fn(async () => undefined),
    };
    const service = new RuleEngineExecutionService(
      ruleEngine,
      events,
      teams,
      eventTeamService as unknown as EventTeamService,
      tasks,
      ruleApplications,
      ruleTaskTemplates,
      audit,
      makeFakeTransactionRunner(),
    );

    await expect(service.applyRules("event-1", "actor-1")).rejects.toThrow("falha simulada de escrita no banco");

    expect(tasks.created).toHaveLength(0);
    expect((await eventTeamService.listTeamsByEvent("event-1"))).toHaveLength(0);
  });

  it("throws when the event does not exist", async () => {
    const events = { findById: jest.fn(async () => null) } as unknown as EventRepository;
    const ruleEngine = { evaluate: jest.fn() } as unknown as RuleEngineService;
    const teams = { list: jest.fn() } as unknown as TeamRepository;
    const eventTeamService = { listTeamsByEvent: jest.fn(), assignTeamToEvent: jest.fn() } as unknown as EventTeamService;
    const tasks = { create: jest.fn(), findById: jest.fn(), list: jest.fn() } as unknown as TaskRepository;
    const ruleApplications = { findByEventAndRule: jest.fn(), create: jest.fn(), remove: jest.fn() } as unknown as RuleApplicationRepository;
    const ruleTaskTemplates = { listByRuleId: jest.fn() } as unknown as RuleTaskTemplateRepository;
    const audit = { record: jest.fn() } as unknown as AuditService;
    const transactions = { run: jest.fn() } as unknown as TransactionRunner;
    const service = new RuleEngineExecutionService(ruleEngine, events, teams, eventTeamService, tasks, ruleApplications, ruleTaskTemplates, audit, transactions);

    await expect(service.applyRules("missing", "actor-1")).rejects.toThrow(RuleEngineExecutionError);
    await expect(service.applyRules("missing", "actor-1")).rejects.toThrow("Evento não encontrado");
  });

  describe("automatic task assignment to the allocated team (RFC 3.1, ADR 0010)", () => {
    type TeamRow = { id: string; specialty: string; status: string };
    const template = (id: string, title: string, specialty: string | null) => ({ id, ruleId: "rule-1", title, description: null, daysBeforeEvent: 3, specialty });

    const build = (options: {
      requirements: Array<{ specialty: "BAR" | "SALAO" | "COZINHA"; minQuantity: number }>;
      templates: ReturnType<typeof template>[];
      teams: TeamRow[];
      preAllocated?: string[];
      existingTasks?: Array<Partial<TaskRecord>>;
    }) => {
      const requirements = options.requirements.map((item, index) => ({ id: `req-${index}`, ...item }));
      const match = makeMatch({ resourceRequirements: requirements, rule: { ...makeMatch().rule, resourceRequirements: requirements } });
      const ruleEngine = { evaluate: jest.fn(async () => [match]) } as unknown as RuleEngineService;
      const events = { findById: jest.fn(async () => makeEvent()) } as unknown as EventRepository;
      const teams = { list: jest.fn(async (filter: { specialty?: string }) => options.teams.filter((team) => !filter?.specialty || team.specialty === filter.specialty)) } as unknown as TeamRepository;
      const eventTeamService = makeEventTeamServiceFake();
      for (const teamId of options.preAllocated ?? []) void eventTeamService.assignTeamToEvent("event-1", teamId, "actor-0");
      const tasks = makeTaskRepositoryFake();
      for (const [index, task] of (options.existingTasks ?? []).entries()) {
        tasks.created.push({ id: `old-${index}`, eventId: "event-1", title: `Antiga ${index}`, description: null, dueDate: null, status: "PENDENTE", assignedTeamId: null, sourceRuleId: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null, ...task } as TaskRecord);
      }
      const audit = { record: jest.fn(async (_input: { action: string; entityId?: string; userId?: string; changes?: Record<string, unknown> }) => undefined) };
      const service = new RuleEngineExecutionService(
        ruleEngine, events, teams, eventTeamService as unknown as EventTeamService, tasks, makeRuleApplicationFake(),
        { listByRuleId: jest.fn(async () => options.templates) } as unknown as RuleTaskTemplateRepository,
        audit as unknown as AuditService, makeFakeTransactionRunner(),
      );
      const generated = (title: string) => tasks.created.find((task) => task.title === title);
      return { service, tasks, audit, generated };
    };

    it("assigns the task to the team of its specialty allocated by the same rule, with assignedAt and audit", async () => {
      const { service, generated, audit } = build({
        requirements: [{ specialty: "BAR", minQuantity: 1 }],
        templates: [template("tpl-1", "Montar o bar", "BAR")],
        teams: [{ id: "team-bar", specialty: "BAR", status: "ATIVA" }],
      });

      await service.applyRules("event-1", "actor-1");

      const task = generated("Montar o bar");
      expect(task?.assignedTeamId).toBe("team-bar");
      expect(task?.assignedAt).toBeInstanceOf(Date);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "TASK_GENERATED", entityId: task?.id, changes: expect.objectContaining({ assignedTeamId: "team-bar" }) }));
      expect(audit.record).toHaveBeenCalledWith({ userId: "actor-1", action: "TASK_TEAM_ASSIGNED", entity: "Task", entityId: task?.id, changes: { before: null, after: "team-bar", automatic: true } });
    });

    it("keeps a template without specialty unassigned, as before", async () => {
      const { service, generated, audit } = build({
        requirements: [{ specialty: "BAR", minQuantity: 1 }],
        templates: [template("tpl-1", "Lembrete geral", null)],
        teams: [{ id: "team-bar", specialty: "BAR", status: "ATIVA" }],
      });

      await service.applyRules("event-1", "actor-1");

      expect(generated("Lembrete geral")).toEqual(expect.objectContaining({ assignedTeamId: null, assignedAt: null }));
      expect(audit.record.mock.calls.map(([input]) => input.action)).not.toContain("TASK_TEAM_ASSIGNED");
    });

    it("balances tasks across the allocated teams of the specialty; a tie goes to the team allocated first", async () => {
      const { service, generated } = build({
        requirements: [{ specialty: "SALAO", minQuantity: 2 }],
        templates: [template("tpl-1", "Montar mesas", "SALAO"), template("tpl-2", "Arrumar cadeiras", "SALAO"), template("tpl-3", "Servir boas-vindas", "SALAO")],
        teams: [{ id: "salao-a", specialty: "SALAO", status: "ATIVA" }, { id: "salao-b", specialty: "SALAO", status: "ATIVA" }],
      });

      await service.applyRules("event-1", "actor-1");

      expect([generated("Montar mesas"), generated("Arrumar cadeiras"), generated("Servir boas-vindas")].map((task) => task?.assignedTeamId)).toEqual(["salao-a", "salao-b", "salao-a"]);
    });

    it("counts only the open tasks the teams already have in the event", async () => {
      const { service, generated } = build({
        requirements: [{ specialty: "SALAO", minQuantity: 2 }],
        templates: [template("tpl-1", "Montar mesas", "SALAO")],
        teams: [{ id: "salao-a", specialty: "SALAO", status: "ATIVA" }, { id: "salao-b", specialty: "SALAO", status: "ATIVA" }],
        preAllocated: ["salao-a", "salao-b"],
        existingTasks: [
          { assignedTeamId: "salao-a", status: "PENDENTE" },
          { assignedTeamId: "salao-a", status: "EM_ANDAMENTO" },
          { assignedTeamId: "salao-b", status: "CONCLUIDA" },
          { assignedTeamId: "salao-b", status: "CANCELADA" },
          { assignedTeamId: "salao-b", status: "PENDENTE", deletedAt: new Date() },
        ],
      });

      await service.applyRules("event-1", "actor-1");

      expect(generated("Montar mesas")?.assignedTeamId).toBe("salao-b");
    });

    it("uses a team allocated by hand before the confirmation", async () => {
      const { service, generated } = build({
        requirements: [{ specialty: "COZINHA", minQuantity: 1 }],
        templates: [template("tpl-1", "Preparar cardápio", "COZINHA")],
        teams: [{ id: "cozinha-1", specialty: "COZINHA", status: "ATIVA" }],
        preAllocated: ["cozinha-1"],
      });

      await service.applyRules("event-1", "actor-1");

      expect(generated("Preparar cardápio")?.assignedTeamId).toBe("cozinha-1");
    });

    it("leaves the task unassigned when no team of the specialty is available, next to the shortage alert (RN15)", async () => {
      const { service, generated, tasks } = build({
        requirements: [{ specialty: "BAR", minQuantity: 1 }],
        templates: [template("tpl-1", "Montar o bar", "BAR")],
        teams: [],
      });

      await service.applyRules("event-1", "actor-1");

      expect(generated("Montar o bar")?.assignedTeamId).toBeNull();
      expect(tasks.created.some((task) => task.title.startsWith("Faltam 1 equipe(s) de BAR"))).toBe(true);
    });

    it("never assigns to an inactive team, even if it is allocated to the event (RN17)", async () => {
      const { service, generated } = build({
        requirements: [{ specialty: "BAR", minQuantity: 1 }],
        templates: [template("tpl-1", "Montar o bar", "BAR")],
        teams: [{ id: "bar-inativa", specialty: "BAR", status: "INATIVA" }],
        preAllocated: ["bar-inativa"],
      });

      await service.applyRules("event-1", "actor-1");

      expect(generated("Montar o bar")?.assignedTeamId).toBeNull();
    });
  });
});
