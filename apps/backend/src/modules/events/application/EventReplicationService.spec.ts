import { describe, expect, it, jest } from "@jest/globals";

import { EventReplicationConflictError, EventReplicationError, EventReplicationService } from "./EventReplicationService.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import type { EventRecord, ServiceRecord } from "../domain/event.types.js";
import type {
  CreateReplicaInput,
  CreateReplicatedTaskInput,
  EventReplicationDependencies,
  ReplicateEventInput,
  ReplicationSourceTask,
  TeamAvailability,
} from "../domain/eventReplication.types.js";

const NOW = new Date("2026-10-23T12:00:00.000Z");
const SOURCE_DATE = new Date("2026-06-20T18:00:00.000Z");
const NEW_DATE = new Date("2026-12-12T18:00:00.000Z");
const TX = { kind: "tx" };

const catalogService = (overrides: Partial<ServiceRecord> = {}): ServiceRecord => ({
  id: "service-bar",
  name: "Bar",
  isCustom: false,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  deletedAt: null,
  ...overrides,
});

const makeSource = (overrides: Partial<EventRecord> = {}): EventRecord => ({
  id: "source-1",
  name: "Casamento de Alice",
  eventDate: SOURCE_DATE,
  endDate: new Date("2026-06-21T02:00:00.000Z"),
  location: "Salão Principal",
  serviceType: "CASAMENTO",
  guestsCount: 180,
  observations: "Cardápio sem glúten",
  status: "CONCLUIDO",
  createdById: "actor-0",
  createdAt: new Date("2026-05-01T00:00:00.000Z"),
  updatedAt: new Date("2026-05-01T00:00:00.000Z"),
  deletedAt: null,
  services: [
    { serviceId: "service-bar", customLabel: null, service: catalogService() },
    { serviceId: "service-outro", customLabel: "Fotógrafo", service: catalogService({ id: "service-outro", name: "Outro", isCustom: true }) },
  ],
  clientId: "client-1",
  client: { id: "client-1", name: "Ana Souza", email: null, phone: null, deletedAt: null },
  ...overrides,
});

const sourceTasks: ReplicationSourceTask[] = [
  { id: "task-manual-1", title: "Confirmar fornecedor de flores", description: "Ligar para a floricultura", dueDate: new Date("2026-06-13T09:30:00.000Z"), status: "CONCLUIDA", assignedTeamId: "team-deco", sourceRuleId: null },
  { id: "task-manual-2", title: "Reunião com noivos", description: null, dueDate: null, status: "PENDENTE", assignedTeamId: null, sourceRuleId: null },
  { id: "task-manual-3", title: "Degustação extra", description: null, dueDate: new Date("2026-06-01T15:00:00.000Z"), status: "CANCELADA", assignedTeamId: null, sourceRuleId: null },
  { id: "task-rule-1", title: "Montar o bar", description: null, dueDate: new Date("2026-06-19T10:00:00.000Z"), status: "CONCLUIDA", assignedTeamId: "team-bar", sourceRuleId: "rule-1" },
];

const teams: Record<string, { id: string; name: string; specialty: string }> = {
  "team-deco": { id: "team-deco", name: "Decoração A", specialty: "DECORACAO" },
  "team-bar": { id: "team-bar", name: "Bar 1", specialty: "BAR" },
};

type Harness = {
  service: EventReplicationService;
  deps: EventReplicationDependencies;
  createReplica: jest.Mock<(input: CreateReplicaInput, tx: unknown) => Promise<EventRecord>>;
  createTask: jest.Mock<(input: CreateReplicatedTaskInput, tx: unknown) => Promise<{ id: string }>>;
  assign: jest.Mock<(eventId: string, teamId: string, actorId: string, tx: unknown) => Promise<unknown>>;
  audit: jest.Mock<(input: { action: string; entityId?: string; changes?: Record<string, unknown> }) => Promise<void>>;
  assertCanCreate: jest.Mock<(input: unknown) => Promise<void>>;
  runInTransaction: jest.Mock<(work: (tx: unknown) => Promise<unknown>) => Promise<unknown>>;
};

const buildHarness = (options: {
  source?: EventRecord | null;
  tasks?: ReplicationSourceTask[];
  availability?: Record<string, TeamAvailability>;
  catalog?: Record<string, ServiceRecord | null>;
  failOnTask?: boolean;
} = {}): Harness => {
  const source = options.source === undefined ? makeSource() : options.source;
  const createReplica = jest.fn(async (input: CreateReplicaInput, _tx: unknown) => makeSource({
    id: "replica-1",
    name: input.name,
    eventDate: input.eventDate,
    endDate: input.endDate,
    status: "PLANEJAMENTO",
    location: input.location,
    guestsCount: input.guestsCount,
    clientId: input.clientId,
  }));
  let taskCounter = 0;
  const createTask = jest.fn(async (_input: CreateReplicatedTaskInput, _tx: unknown) => {
    if (options.failOnTask) throw new Error("falha de banco");
    taskCounter += 1;
    return { id: `new-task-${taskCounter}` };
  });
  const assign = jest.fn(async (_eventId: string, _teamId: string, _actorId: string, _tx: unknown) => ({}));
  const audit = jest.fn(async (_input: { action: string; entityId?: string; changes?: Record<string, unknown> }) => undefined);
  const assertCanCreate = jest.fn(async (_input: unknown) => undefined);
  const runInTransaction = jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work(TX));
  const catalog = options.catalog ?? {
    "service-bar": catalogService(),
    "service-outro": catalogService({ id: "service-outro", name: "Outro", isCustom: true }),
  };

  const deps: EventReplicationDependencies = {
    events: { findById: jest.fn(async (id: string) => (source && id === source.id ? source : null)), createReplica },
    creationPolicy: { assertCanCreate },
    catalog: { findById: jest.fn(async (id: string) => catalog[id] ?? null) },
    tasks: { listByEvent: jest.fn(async () => options.tasks ?? sourceTasks), create: createTask },
    teams: {
      listTeamsByEvent: jest.fn(async () => [{ teamId: "team-deco" }, { teamId: "team-bar" }]),
      findTeam: jest.fn(async (teamId: string) => teams[teamId] ?? null),
      checkAvailability: jest.fn(async (teamId: string) => options.availability?.[teamId] ?? { available: true as const }),
      assign,
    },
    transactions: { run: runInTransaction as never },
    audit: { record: audit as never },
    now: () => NOW,
  };

  return { service: new EventReplicationService(deps), deps, createReplica, createTask, assign, audit, assertCanCreate, runInTransaction };
};

const validInput = (overrides: Partial<ReplicateEventInput> = {}): ReplicateEventInput => ({
  name: "Casamento de Bruna",
  eventDate: NEW_DATE,
  endDate: null,
  location: "Salão Principal",
  serviceType: "CASAMENTO",
  guestsCount: 180,
  observations: "Cardápio sem glúten",
  clientId: "client-1",
  services: [{ serviceId: "service-bar" }, { serviceId: "service-outro", customLabel: "Fotógrafo" }],
  tasks: [{ sourceTaskId: "task-manual-1" }, { sourceTaskId: "task-manual-2" }],
  teamIds: ["team-deco", "team-bar"],
  ...overrides,
});

const auditCall = (harness: Harness, action: string) => harness.audit.mock.calls.map(([input]) => input).find((input) => input.action === action);

describe("EventReplicationService.preview", () => {
  it("rejects a missing or soft-deleted source event with NotFoundError", async () => {
    const { service } = buildHarness({ source: null });

    await expect(service.preview("source-1", { eventDate: NEW_DATE, endDate: null })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("drafts the copyable configuration and never the name or the date", async () => {
    const { service } = buildHarness();

    const preview = await service.preview("source-1", { eventDate: NEW_DATE, endDate: null });

    expect(preview.source).toEqual({ id: "source-1", name: "Casamento de Alice", status: "CONCLUIDO", eventDate: SOURCE_DATE, endDate: new Date("2026-06-21T02:00:00.000Z") });
    expect(preview.draft).toEqual({
      location: "Salão Principal",
      serviceType: "CASAMENTO",
      guestsCount: 180,
      observations: "Cardápio sem glúten",
      clientId: "client-1",
      services: [
        { serviceId: "service-bar", name: "Bar", isCustom: false, customLabel: null },
        { serviceId: "service-outro", name: "Outro", isCustom: true, customLabel: "Fotógrafo" },
      ],
    });
    expect(preview.draft).not.toHaveProperty("name");
    expect(preview.draft).not.toHaveProperty("eventDate");
    expect(preview.warnings).toEqual([]);
  });

  it("accepts any non-deleted source status, including cancelled events (decision P1)", async () => {
    const { service } = buildHarness({ source: makeSource({ status: "CANCELADO" }) });

    await expect(service.preview("source-1", { eventDate: NEW_DATE, endDate: null })).resolves.toEqual(expect.objectContaining({ source: expect.objectContaining({ status: "CANCELADO" }) }));
  });

  it("lists only manual tasks, recalculates deadlines and preselects every non-cancelled one (decision P4)", async () => {
    const { service } = buildHarness();

    const { tasks } = await service.preview("source-1", { eventDate: NEW_DATE, endDate: null });

    expect(tasks.map((task) => task.sourceTaskId)).toEqual(["task-manual-1", "task-manual-2", "task-manual-3"]);
    expect(tasks[0]).toEqual({
      sourceTaskId: "task-manual-1",
      title: "Confirmar fornecedor de flores",
      description: "Ligar para a floricultura",
      sourceStatus: "CONCLUIDA",
      originalDueDate: new Date("2026-06-13T09:30:00.000Z"),
      dueDate: new Date("2026-12-05T09:30:00.000Z"),
      dueDateInPast: false,
      assignedTeamId: "team-deco",
      selected: true,
    });
    expect(tasks[1]).toEqual(expect.objectContaining({ dueDate: null, dueDateInPast: false, selected: true }));
    expect(tasks[2]).toEqual(expect.objectContaining({ sourceStatus: "CANCELADA", selected: false }));
  });

  it("flags a recalculated deadline that falls in the past instead of hiding it (decision P4)", async () => {
    const { service } = buildHarness();
    const nearDate = new Date("2026-10-26T18:00:00.000Z"); // 3 days ahead: a "7 days before" deadline is already gone

    const { tasks } = await service.preview("source-1", { eventDate: nearDate, endDate: null });

    expect(tasks[0]).toEqual(expect.objectContaining({ dueDate: new Date("2026-10-19T09:30:00.000Z"), dueDateInPast: true }));
  });

  it("reports team availability for the new schedule, with the conflicting event (decision P2)", async () => {
    const { service, deps } = buildHarness({
      availability: { "team-bar": { available: false, reason: "SCHEDULE_CONFLICT", conflictingEvent: { id: "event-9", name: "Formatura X" } } },
    });
    const schedule = { eventDate: NEW_DATE, endDate: new Date("2026-12-13T02:00:00.000Z") };

    const { teams: previewTeams } = await service.preview("source-1", schedule);

    expect(deps.teams.checkAvailability).toHaveBeenCalledWith("team-bar", schedule);
    expect(previewTeams).toEqual([
      { teamId: "team-deco", name: "Decoração A", specialty: "DECORACAO", available: true, reason: null, conflictingEvent: null },
      { teamId: "team-bar", name: "Bar 1", specialty: "BAR", available: false, reason: "SCHEDULE_CONFLICT", conflictingEvent: { id: "event-9", name: "Formatura X" } },
    ]);
  });

  it("warns about a removed client and removed catalog services and leaves them out of the draft", async () => {
    const source = makeSource({
      client: { id: "client-1", name: "Ana Souza", email: null, phone: null, deletedAt: new Date("2026-08-01T00:00:00.000Z") },
      services: [{ serviceId: "service-bar", customLabel: null, service: catalogService({ deletedAt: new Date("2026-08-01T00:00:00.000Z") }) }],
    });
    const { service } = buildHarness({ source });

    const preview = await service.preview("source-1", { eventDate: NEW_DATE, endDate: null });

    expect(preview.draft.clientId).toBeNull();
    expect(preview.draft.services).toEqual([]);
    expect(preview.warnings).toEqual([{ code: "CLIENT_UNAVAILABLE" }, { code: "SERVICE_UNAVAILABLE", serviceId: "service-bar", name: "Bar" }]);
  });

  it("shows a team that no longer exists as unavailable instead of failing the preview", async () => {
    const { service, deps } = buildHarness({ availability: { "team-bar": { available: false, reason: "NOT_FOUND" } } });
    (deps.teams.findTeam as jest.Mock<(teamId: string) => Promise<unknown>>).mockImplementation(async (teamId: string) => (teamId === "team-bar" ? null : teams[teamId]));

    const { teams: previewTeams } = await service.preview("source-1", { eventDate: NEW_DATE, endDate: null });

    expect(previewTeams[1]).toEqual({ teamId: "team-bar", name: "Equipe removida", specialty: "", available: false, reason: "NOT_FOUND", conflictingEvent: null });
  });

  it("treats a legacy event without client as a client warning", async () => {
    const { service } = buildHarness({ source: makeSource({ clientId: null, client: null }) });

    const preview = await service.preview("source-1", { eventDate: NEW_DATE, endDate: null });

    expect(preview.draft.clientId).toBeNull();
    expect(preview.warnings).toContainEqual({ code: "CLIENT_UNAVAILABLE" });
  });
});

describe("EventReplicationService.replicate", () => {
  it("rejects a missing source event with NotFoundError before writing anything", async () => {
    const harness = buildHarness({ source: null });

    await expect(harness.service.replicate("source-1", validInput(), "actor-1")).rejects.toBeInstanceOf(NotFoundError);
    expect(harness.runInTransaction).not.toHaveBeenCalled();
  });

  it("applies the regular creation rules to the new event data", async () => {
    const harness = buildHarness();
    harness.assertCanCreate.mockRejectedValueOnce(new Error("A data do evento não pode estar no passado"));

    await expect(harness.service.replicate("source-1", validInput(), "actor-1")).rejects.toThrow("passado");
    expect(harness.assertCanCreate).toHaveBeenCalledWith(expect.objectContaining({ name: "Casamento de Bruna", eventDate: NEW_DATE, clientId: "client-1", createdById: "actor-1" }));
    expect(harness.runInTransaction).not.toHaveBeenCalled();
  });

  it("creates the replica in PLANEJAMENTO with the edited data, the services and the link to its source", async () => {
    const harness = buildHarness();

    const replica = await harness.service.replicate("source-1", validInput({ location: "Salão Jardim", guestsCount: 150, clientId: "client-2" }), "actor-1");

    expect(replica.id).toBe("replica-1");
    expect(harness.createReplica).toHaveBeenCalledWith({
      name: "Casamento de Bruna",
      eventDate: NEW_DATE,
      endDate: null,
      location: "Salão Jardim",
      serviceType: "CASAMENTO",
      guestsCount: 150,
      observations: "Cardápio sem glúten",
      clientId: "client-2",
      createdById: "actor-1",
      sourceEventId: "source-1",
      services: [{ serviceId: "service-bar", customLabel: null }, { serviceId: "service-outro", customLabel: "Fotógrafo" }],
    }, TX);
  });

  it("validates the services: unknown, removed, repeated and the 'Outro' label rule", async () => {
    const removed = buildHarness({ catalog: { "service-bar": catalogService({ deletedAt: new Date() }) } });
    await expect(removed.service.replicate("source-1", validInput({ services: [{ serviceId: "service-bar" }] }), "actor-1")).rejects.toThrow("Serviço não encontrado");

    const unknown = buildHarness();
    await expect(unknown.service.replicate("source-1", validInput({ services: [{ serviceId: "missing" }] }), "actor-1")).rejects.toThrow("Serviço não encontrado");

    const repeated = buildHarness();
    await expect(repeated.service.replicate("source-1", validInput({ services: [{ serviceId: "service-bar" }, { serviceId: "service-bar" }] }), "actor-1")).rejects.toThrow("Serviço repetido");

    const missingLabel = buildHarness();
    await expect(missingLabel.service.replicate("source-1", validInput({ services: [{ serviceId: "service-outro" }] }), "actor-1")).rejects.toBeInstanceOf(EventReplicationError);
    expect(missingLabel.runInTransaction).not.toHaveBeenCalled();
  });

  it("copies the selected manual tasks as PENDENTE with recalculated deadlines and lineage, never the rule tasks", async () => {
    const harness = buildHarness();

    await harness.service.replicate("source-1", validInput(), "actor-1");

    expect(harness.createTask).toHaveBeenCalledTimes(2);
    expect(harness.createTask).toHaveBeenNthCalledWith(1, {
      eventId: "replica-1",
      title: "Confirmar fornecedor de flores",
      description: "Ligar para a floricultura",
      dueDate: new Date("2026-12-05T09:30:00.000Z"),
      assignedTeamId: "team-deco",
      assignedAt: NOW,
      sourceRuleId: null,
      sourceTaskId: "task-manual-1",
    }, TX);
    expect(harness.createTask).toHaveBeenNthCalledWith(2, expect.objectContaining({ sourceTaskId: "task-manual-2", dueDate: null, assignedTeamId: null, assignedAt: null }), TX);
    expect(harness.createTask.mock.calls.map(([input]) => input)).not.toContainEqual(expect.objectContaining({ sourceTaskId: "task-rule-1" }));
  });

  it("uses the values edited in the review step, including clearing the deadline", async () => {
    const harness = buildHarness();
    const editedDueDate = new Date("2026-12-01T10:00:00.000Z");

    await harness.service.replicate("source-1", validInput({
      tasks: [
        { sourceTaskId: "task-manual-1", title: "Confirmar flores (novo fornecedor)", description: null, dueDate: editedDueDate },
        { sourceTaskId: "task-manual-3", dueDate: null },
      ],
    }), "actor-1");

    expect(harness.createTask).toHaveBeenNthCalledWith(1, expect.objectContaining({ title: "Confirmar flores (novo fornecedor)", description: null, dueDate: editedDueDate }), TX);
    expect(harness.createTask).toHaveBeenNthCalledWith(2, expect.objectContaining({ title: "Degustação extra", dueDate: null }), TX);
  });

  it("copies a task without team when its team is not copied (RN17, decision P4)", async () => {
    const harness = buildHarness();

    await harness.service.replicate("source-1", validInput({ teamIds: ["team-bar"] }), "actor-1");

    expect(harness.createTask).toHaveBeenNthCalledWith(1, expect.objectContaining({ sourceTaskId: "task-manual-1", assignedTeamId: null, assignedAt: null }), TX);
  });

  it("rejects tasks that are not manual tasks of the source event, or repeated", async () => {
    const ruleTask = buildHarness();
    await expect(ruleTask.service.replicate("source-1", validInput({ tasks: [{ sourceTaskId: "task-rule-1" }] }), "actor-1")).rejects.toThrow("A tarefa não é uma tarefa manual do evento de origem");

    const foreignTask = buildHarness();
    await expect(foreignTask.service.replicate("source-1", validInput({ tasks: [{ sourceTaskId: "task-of-another-event" }] }), "actor-1")).rejects.toThrow("A tarefa não é uma tarefa manual do evento de origem");

    const repeated = buildHarness();
    await expect(repeated.service.replicate("source-1", validInput({ tasks: [{ sourceTaskId: "task-manual-1" }, { sourceTaskId: "task-manual-1" }] }), "actor-1")).rejects.toThrow("Tarefa repetida");
    expect(repeated.runInTransaction).not.toHaveBeenCalled();
  });

  it("allocates the selected teams of the source event inside the same transaction", async () => {
    const harness = buildHarness();

    await harness.service.replicate("source-1", validInput(), "actor-1");

    expect(harness.deps.teams.checkAvailability).toHaveBeenCalledWith("team-deco", { eventDate: NEW_DATE, endDate: null });
    expect(harness.assign).toHaveBeenCalledWith("replica-1", "team-deco", "actor-1", TX);
    expect(harness.assign).toHaveBeenCalledWith("replica-1", "team-bar", "actor-1", TX);
  });

  it("rejects teams that were not allocated to the source event, or repeated", async () => {
    const foreign = buildHarness();
    await expect(foreign.service.replicate("source-1", validInput({ teamIds: ["team-other"] }), "actor-1")).rejects.toThrow("A equipe não está alocada ao evento de origem");

    const repeated = buildHarness();
    await expect(repeated.service.replicate("source-1", validInput({ teamIds: ["team-bar", "team-bar"] }), "actor-1")).rejects.toThrow("Equipe repetida");
  });

  it("refuses the whole operation with every unavailable team when any team conflicts (decision P2)", async () => {
    const harness = buildHarness({
      availability: {
        "team-deco": { available: false, reason: "INACTIVE" },
        "team-bar": { available: false, reason: "SCHEDULE_CONFLICT", conflictingEvent: { id: "event-9", name: "Formatura X" } },
      },
    });

    const error = await harness.service.replicate("source-1", validInput(), "actor-1").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(EventReplicationConflictError);
    expect((error as EventReplicationConflictError).conflicts).toEqual([
      { teamId: "team-deco", reason: "INACTIVE", conflictingEvent: null },
      { teamId: "team-bar", reason: "SCHEDULE_CONFLICT", conflictingEvent: { id: "event-9", name: "Formatura X" } },
    ]);
    expect(harness.runInTransaction).not.toHaveBeenCalled();
    expect(harness.audit).not.toHaveBeenCalled();
  });

  it("does not audit anything when a write inside the transaction fails (atomicity)", async () => {
    const harness = buildHarness({ failOnTask: true });

    await expect(harness.service.replicate("source-1", validInput(), "actor-1")).rejects.toThrow("falha de banco");
    expect(harness.audit).not.toHaveBeenCalled();
  });

  it("records EVENT_REPLICATED on the replica with the full lineage", async () => {
    const harness = buildHarness();

    await harness.service.replicate("source-1", validInput({ location: "Salão Jardim", teamIds: ["team-deco"] }), "actor-1");

    expect(auditCall(harness, "EVENT_REPLICATED")).toEqual({
      userId: "actor-1",
      action: "EVENT_REPLICATED",
      entity: "Event",
      entityId: "replica-1",
      changes: {
        name: "Casamento de Bruna",
        sourceEventId: "source-1",
        sourceEventName: "Casamento de Alice",
        changedFromSource: ["location"],
        copiedTasks: [{ sourceTaskId: "task-manual-1", taskId: "new-task-1" }, { sourceTaskId: "task-manual-2", taskId: "new-task-2" }],
        discardedTaskIds: ["task-manual-3"],
        copiedTeamIds: ["team-deco"],
        discardedTeamIds: ["team-bar"],
      },
    });
  });

  it("detects edited client, guests, type, observations and services in changedFromSource", async () => {
    const harness = buildHarness();

    await harness.service.replicate("source-1", validInput({
      clientId: "client-2",
      guestsCount: 90,
      serviceType: "ANIVERSARIO",
      observations: null,
      services: [{ serviceId: "service-bar" }],
    }), "actor-1");

    expect(auditCall(harness, "EVENT_REPLICATED")?.changes?.changedFromSource).toEqual(["serviceType", "guestsCount", "observations", "clientId", "services"]);
  });

  it("records EVENT_USED_AS_TEMPLATE on the source so its history shows the replica (RF21)", async () => {
    const harness = buildHarness();

    await harness.service.replicate("source-1", validInput(), "actor-1");

    expect(auditCall(harness, "EVENT_USED_AS_TEMPLATE")).toEqual({
      userId: "actor-1",
      action: "EVENT_USED_AS_TEMPLATE",
      entity: "Event",
      entityId: "source-1",
      changes: { name: "Casamento de Alice", replicaEventId: "replica-1", replicaEventName: "Casamento de Bruna" },
    });
  });

  it("records TASK_CREATED and TEAM_ASSIGNED_TO_EVENT with where each copy came from", async () => {
    const harness = buildHarness();

    await harness.service.replicate("source-1", validInput(), "actor-1");

    const actions = harness.audit.mock.calls.map(([input]) => input);
    expect(actions).toContainEqual(expect.objectContaining({
      action: "TASK_CREATED",
      entity: "Task",
      entityId: "new-task-1",
      changes: { eventId: "replica-1", title: "Confirmar fornecedor de flores", replicatedFromTaskId: "task-manual-1" },
    }));
    expect(actions).toContainEqual(expect.objectContaining({
      action: "TEAM_ASSIGNED_TO_EVENT",
      entity: "Event",
      entityId: "replica-1",
      changes: { teamId: "team-bar", replicatedFromEventId: "source-1" },
    }));
  });

  it("replicates with no tasks and no teams when the user unchecks everything", async () => {
    const harness = buildHarness();

    await harness.service.replicate("source-1", validInput({ tasks: [], teamIds: [], services: [] }), "actor-1");

    expect(harness.createReplica).toHaveBeenCalledWith(expect.objectContaining({ services: [] }), TX);
    expect(harness.createTask).not.toHaveBeenCalled();
    expect(harness.assign).not.toHaveBeenCalled();
    expect(auditCall(harness, "EVENT_REPLICATED")?.changes).toEqual(expect.objectContaining({
      discardedTaskIds: ["task-manual-1", "task-manual-2", "task-manual-3"],
      discardedTeamIds: ["team-deco", "team-bar"],
    }));
  });
});
