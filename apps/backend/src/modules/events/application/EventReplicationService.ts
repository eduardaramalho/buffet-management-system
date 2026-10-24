import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import type { EventRecord } from "../domain/event.types.js";
import { normalizeServiceLabel } from "../domain/eventServiceLabel.js";
import type {
  CreateReplicaInput,
  EventReplicationDependencies,
  ReplicateEventInput,
  ReplicationPreview,
  ReplicationPreviewTeam,
  ReplicationSchedule,
  ReplicationSourceTask,
  ReplicationTeamConflict,
  ReplicationWarning,
} from "../domain/eventReplication.types.js";
import { isBefore, shiftDueDate } from "../domain/replicationSchedule.js";

export class EventReplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventReplicationError";
  }
}

// Carries every unavailable team at once (decision P2), so the client can show all of them
// instead of making the user fix one conflict per attempt. Mapped to HTTP 409.
export class EventReplicationConflictError extends Error {
  constructor(readonly conflicts: ReplicationTeamConflict[]) {
    super("Há equipes indisponíveis para a nova data");
    this.name = "EventReplicationConflictError";
  }
}

const SOURCE_NOT_FOUND = "Evento de origem não encontrado";

type CopiedFieldsSnapshot = Pick<EventRecord, "location" | "serviceType" | "guestsCount" | "observations" | "clientId"> & { services: string };

/**
 * RF25 (ADR 0008): reuse an earlier event as the base of a new one.
 * - preview: read-only draft for the new schedule (recalculated deadlines, team availability, warnings).
 * - replicate: validates everything up front, writes event + services + teams + manual tasks in a single
 *   transaction and audits the full lineage only after the commit.
 * Rule-generated tasks are never copied: the engine regenerates them when the replica is confirmed (RN12).
 */
export class EventReplicationService {
  private readonly now: () => Date;

  constructor(private readonly deps: EventReplicationDependencies) {
    this.now = deps.now ?? (() => new Date());
  }

  async preview(sourceEventId: string, schedule: ReplicationSchedule): Promise<ReplicationPreview> {
    const source = await this.findSource(sourceEventId);
    const now = this.now();
    const warnings: ReplicationWarning[] = [];

    const clientAvailable = Boolean(source.clientId && source.client && !source.client.deletedAt);
    if (!clientAvailable) warnings.push({ code: "CLIENT_UNAVAILABLE" });

    const services = source.services.flatMap((contracted) => {
      if (contracted.service.deletedAt) {
        warnings.push({ code: "SERVICE_UNAVAILABLE", serviceId: contracted.serviceId, name: contracted.service.name });
        return [];
      }
      return [{ serviceId: contracted.serviceId, name: contracted.service.name, isCustom: contracted.service.isCustom, customLabel: contracted.customLabel }];
    });

    const tasks = (await this.listManualTasks(source.id)).map((task) => {
      const dueDate = shiftDueDate(task.dueDate, source.eventDate, schedule.eventDate);
      return {
        sourceTaskId: task.id,
        title: task.title,
        description: task.description,
        sourceStatus: task.status,
        originalDueDate: task.dueDate,
        dueDate,
        dueDateInPast: isBefore(dueDate, now),
        assignedTeamId: task.assignedTeamId,
        // Decision P4: cancelled tasks are offered but unchecked by default.
        selected: task.status !== "CANCELADA",
      };
    });

    const teams = await Promise.all((await this.deps.teams.listTeamsByEvent(source.id)).map(({ teamId }) => this.previewTeam(teamId, schedule)));

    return {
      source: { id: source.id, name: source.name, status: source.status, eventDate: source.eventDate, endDate: source.endDate },
      draft: {
        location: source.location,
        serviceType: source.serviceType,
        guestsCount: source.guestsCount,
        observations: source.observations,
        clientId: clientAvailable ? source.clientId : null,
        services,
      },
      warnings,
      tasks,
      teams,
    };
  }

  async replicate(sourceEventId: string, input: ReplicateEventInput, actorId: string): Promise<EventRecord> {
    const source = await this.findSource(sourceEventId);
    const { services: requestedServices, tasks: requestedTasks, teamIds, ...eventData } = input;

    await this.deps.creationPolicy.assertCanCreate({ ...eventData, createdById: actorId });
    const services = await this.resolveServices(requestedServices);

    const manualTasks = await this.listManualTasks(source.id);
    const manualTasksById = new Map(manualTasks.map((task) => [task.id, task]));
    assertNoDuplicates(requestedTasks.map((task) => task.sourceTaskId), "Tarefa repetida");
    const selectedTasks = requestedTasks.map((requested) => {
      const sourceTask = manualTasksById.get(requested.sourceTaskId);
      if (!sourceTask) throw new EventReplicationError("A tarefa não é uma tarefa manual do evento de origem");
      return { requested, sourceTask };
    });

    const sourceTeamIds = (await this.deps.teams.listTeamsByEvent(source.id)).map(({ teamId }) => teamId);
    assertNoDuplicates(teamIds, "Equipe repetida");
    if (teamIds.some((teamId) => !sourceTeamIds.includes(teamId))) {
      throw new EventReplicationError("A equipe não está alocada ao evento de origem");
    }
    await this.assertTeamsAvailable(teamIds, { eventDate: input.eventDate, endDate: input.endDate });

    const replicaInput: CreateReplicaInput = { ...eventData, createdById: actorId, sourceEventId: source.id, services };
    const assignedAt = this.now();
    const { replica, copiedTasks } = await this.deps.transactions.run(async (tx) => {
      const created = await this.deps.events.createReplica(replicaInput, tx);
      for (const teamId of teamIds) await this.deps.teams.assign(created.id, teamId, actorId, tx);

      const copies: { sourceTaskId: string; taskId: string; title: string }[] = [];
      for (const { requested, sourceTask } of selectedTasks) {
        // RN17: a task may only point to a team allocated to its event, so it loses a team left behind.
        const keepsTeam = sourceTask.assignedTeamId !== null && teamIds.includes(sourceTask.assignedTeamId);
        const title = requested.title ?? sourceTask.title;
        const task = await this.deps.tasks.create({
          eventId: created.id,
          title,
          description: requested.description !== undefined ? requested.description : sourceTask.description,
          dueDate: requested.dueDate !== undefined ? requested.dueDate : shiftDueDate(sourceTask.dueDate, source.eventDate, input.eventDate),
          assignedTeamId: keepsTeam ? sourceTask.assignedTeamId : null,
          assignedAt: keepsTeam ? assignedAt : null,
          sourceRuleId: null,
          sourceTaskId: sourceTask.id,
        }, tx);
        copies.push({ sourceTaskId: sourceTask.id, taskId: task.id, title });
      }
      return { replica: created, copiedTasks: copies };
    });

    await this.recordLineage({ actorId, source, replica, replicaInput, copiedTasks, manualTasks, teamIds, sourceTeamIds });
    return replica;
  }

  private async findSource(sourceEventId: string) {
    const source = await this.deps.events.findById(sourceEventId);
    if (!source) throw new NotFoundError(SOURCE_NOT_FOUND);
    return source;
  }

  private async listManualTasks(eventId: string): Promise<ReplicationSourceTask[]> {
    return (await this.deps.tasks.listByEvent(eventId)).filter((task) => task.sourceRuleId === null);
  }

  private async previewTeam(teamId: string, schedule: ReplicationSchedule): Promise<ReplicationPreviewTeam> {
    const [team, availability] = await Promise.all([this.deps.teams.findTeam(teamId), this.deps.teams.checkAvailability(teamId, schedule)]);
    return {
      teamId,
      name: team?.name ?? "Equipe removida",
      specialty: team?.specialty ?? "",
      available: availability.available,
      reason: availability.available ? null : availability.reason,
      conflictingEvent: availability.available ? null : availability.conflictingEvent ?? null,
    };
  }

  private async resolveServices(requested: ReplicateEventInput["services"]) {
    assertNoDuplicates(requested.map((service) => service.serviceId), "Serviço repetido");
    const resolved: CreateReplicaInput["services"] = [];
    for (const { serviceId, customLabel } of requested) {
      const service = await this.deps.catalog.findById(serviceId);
      if (!service || service.deletedAt) throw new EventReplicationError("Serviço não encontrado");
      const label = normalizeServiceLabel(service, customLabel);
      if (!label.ok) throw new EventReplicationError(label.message);
      resolved.push({ serviceId, customLabel: label.customLabel });
    }
    return resolved;
  }

  private async assertTeamsAvailable(teamIds: string[], schedule: ReplicationSchedule) {
    const conflicts: ReplicationTeamConflict[] = [];
    for (const teamId of teamIds) {
      const availability = await this.deps.teams.checkAvailability(teamId, schedule);
      if (!availability.available) {
        conflicts.push({ teamId, reason: availability.reason, conflictingEvent: availability.conflictingEvent ?? null });
      }
    }
    if (conflicts.length > 0) throw new EventReplicationConflictError(conflicts);
  }

  // Audited after the commit on purpose: a rolled-back replication must leave no trace in the history.
  private async recordLineage(context: {
    actorId: string;
    source: EventRecord;
    replica: EventRecord;
    replicaInput: CreateReplicaInput;
    copiedTasks: { sourceTaskId: string; taskId: string; title: string }[];
    manualTasks: ReplicationSourceTask[];
    teamIds: string[];
    sourceTeamIds: string[];
  }) {
    const { actorId, source, replica, replicaInput, copiedTasks, manualTasks, teamIds, sourceTeamIds } = context;
    const copiedTaskIds = new Set(copiedTasks.map((task) => task.sourceTaskId));

    await this.deps.audit.record({
      userId: actorId,
      action: "EVENT_REPLICATED",
      entity: "Event",
      entityId: replica.id,
      changes: {
        name: replica.name,
        sourceEventId: source.id,
        sourceEventName: source.name,
        changedFromSource: changedFields(snapshotOf(source), snapshotOfInput(replicaInput)),
        copiedTasks: copiedTasks.map(({ sourceTaskId, taskId }) => ({ sourceTaskId, taskId })),
        discardedTaskIds: manualTasks.filter((task) => !copiedTaskIds.has(task.id)).map((task) => task.id),
        copiedTeamIds: teamIds,
        discardedTeamIds: sourceTeamIds.filter((teamId) => !teamIds.includes(teamId)),
      },
    });
    await this.deps.audit.record({
      userId: actorId,
      action: "EVENT_USED_AS_TEMPLATE",
      entity: "Event",
      entityId: source.id,
      changes: { name: source.name, replicaEventId: replica.id, replicaEventName: replica.name },
    });
    for (const teamId of teamIds) {
      await this.deps.audit.record({
        userId: actorId,
        action: "TEAM_ASSIGNED_TO_EVENT",
        entity: "Event",
        entityId: replica.id,
        changes: { teamId, replicatedFromEventId: source.id },
      });
    }
    for (const task of copiedTasks) {
      await this.deps.audit.record({
        userId: actorId,
        action: "TASK_CREATED",
        entity: "Task",
        entityId: task.taskId,
        changes: { eventId: replica.id, title: task.title, replicatedFromTaskId: task.sourceTaskId },
      });
    }
  }
}

function assertNoDuplicates(ids: string[], message: string) {
  if (new Set(ids).size !== ids.length) throw new EventReplicationError(message);
}

const servicesKey = (services: { serviceId: string; customLabel: string | null }[]) =>
  services.map((service) => `${service.serviceId}:${service.customLabel ?? ""}`).sort((left, right) => left.localeCompare(right)).join("|");

const snapshotOf = (event: EventRecord): CopiedFieldsSnapshot => ({
  location: event.location,
  serviceType: event.serviceType,
  guestsCount: event.guestsCount,
  observations: event.observations,
  clientId: event.clientId,
  services: servicesKey(event.services),
});

const snapshotOfInput = (input: CreateReplicaInput): CopiedFieldsSnapshot => ({
  location: input.location,
  serviceType: input.serviceType,
  guestsCount: input.guestsCount,
  observations: input.observations,
  clientId: input.clientId,
  services: servicesKey(input.services),
});

// Fixed order keeps the audit payload deterministic and easy to read in the history.
const COPIED_FIELDS: (keyof CopiedFieldsSnapshot)[] = ["location", "serviceType", "guestsCount", "observations", "clientId", "services"];

function changedFields(source: CopiedFieldsSnapshot, replica: CopiedFieldsSnapshot) {
  return COPIED_FIELDS.filter((field) => source[field] !== replica[field]);
}
