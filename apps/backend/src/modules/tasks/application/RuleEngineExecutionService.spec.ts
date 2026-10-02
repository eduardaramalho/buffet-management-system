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
    expect(result).toEqual({ tasksCreated: 1, teamsAutoAssigned: 1, alertsGenerated: 0 });
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

    expect(first).toEqual({ tasksCreated: 1, teamsAutoAssigned: 1, alertsGenerated: 0 });
    expect(second).toEqual({ tasksCreated: 0, teamsAutoAssigned: 0, alertsGenerated: 0 });
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
    expect(result).toEqual({ tasksCreated: 1, teamsAutoAssigned: 0, alertsGenerated: 1 });
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
    expect(result).toEqual({ tasksCreated: 0, teamsAutoAssigned: 1, alertsGenerated: 0 });
  });

  it("forced reprocessing clears the existing RuleApplication and reapplies the rule", async () => {
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
    expect(second).toEqual({ tasksCreated: 1, teamsAutoAssigned: 0, alertsGenerated: 0 });
    expect(tasks.create).toHaveBeenCalledTimes(2);
    expect(ruleApplications.create).toHaveBeenCalledTimes(2);
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
});
