import type {
  AuditService,
  EventTeamRepository,
  ScheduleWindow,
  TeamAvailability,
} from "../domain/team.types.js";
import type { TransactionClient } from "../../../shared/domain/transaction.types.js";

const TERMINAL_EVENT_STATUSES = ["CONCLUIDO", "CANCELADO"] as const;

type EventInterval = { start: number; end: number };

export class EventTeamManagementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventTeamManagementError";
  }
}

export class EventTeamService {
  constructor(
    private readonly eventTeams: EventTeamRepository,
    private readonly audit: AuditService,
  ) {}

  async assignTeamToEvent(eventId: string, teamId: string, actorId: string, tx?: TransactionClient) {
    const event = await this.eventTeams.findEventById(eventId);
    if (!event || event.deletedAt) throw new EventTeamManagementError("Evento não encontrado");
    if (TERMINAL_EVENT_STATUSES.includes(event.status as (typeof TERMINAL_EVENT_STATUSES)[number])) {
      throw new EventTeamManagementError("Não é possível atribuir equipe a evento concluído ou cancelado");
    }

    const availability = await this.checkAvailability(teamId, event, eventId);
    if (!availability.available) {
      if (availability.reason === "NOT_FOUND") throw new EventTeamManagementError("Equipe não encontrada");
      if (availability.reason === "INACTIVE") throw new EventTeamManagementError("Equipe inativa não pode ser atribuída");
      throw new EventTeamManagementError(`conflito de agenda: a equipe já está atribuída ao evento ${availability.conflictingEvent?.id}`);
    }

    // Only forward tx when given: keeps the call shape identical to before for callers outside
    // of a transaction (e.g. the EventTeamController), instead of always passing a 4th argument.
    const assignment = tx
      ? await this.eventTeams.assign(eventId, teamId, actorId, tx)
      : await this.eventTeams.assign(eventId, teamId, actorId);
    await this.audit.record({
      userId: actorId,
      action: "TEAM_ASSIGNED_TO_EVENT",
      entity: "Event",
      entityId: eventId,
      changes: { teamId, assignedAt: assignment.assignedAt },
    });
    return assignment;
  }

  // Single source of truth for RN08 (inactive team) and RN09 (schedule overlap). Works on a schedule
  // window instead of a stored event so it also answers for an event that does not exist yet
  // (RF25 replication preview and validation). ignoreEventId skips the event being scheduled itself.
  async checkAvailability(teamId: string, schedule: ScheduleWindow, ignoreEventId?: string): Promise<TeamAvailability> {
    const team = await this.eventTeams.findTeamById(teamId);
    if (!team || team.deletedAt) return { available: false, reason: "NOT_FOUND" };
    if (team.status !== "ATIVA") return { available: false, reason: "INACTIVE" };

    const candidate = toInterval(schedule);
    const conflictingEvent = (await this.eventTeams.listEventsByTeam(teamId))
      .filter((existing) => existing.id !== ignoreEventId && !existing.deletedAt)
      .find((existing) => overlaps(candidate, toInterval(existing)));
    if (conflictingEvent) {
      return { available: false, reason: "SCHEDULE_CONFLICT", conflictingEvent: { id: conflictingEvent.id, name: conflictingEvent.name } };
    }
    return { available: true };
  }

  async unassignTeamFromEvent(eventId: string, teamId: string, actorId: string) {
    await this.eventTeams.unassign(eventId, teamId);
    await this.audit.record({
      userId: actorId,
      action: "TEAM_UNASSIGNED_FROM_EVENT",
      entity: "Event",
      entityId: eventId,
      changes: { teamId },
    });
  }

  listTeamsByEvent(eventId: string) {
    return this.eventTeams.listTeamsByEvent(eventId);
  }

  listEventsByTeam(teamId: string) {
    return this.eventTeams.listAssignmentsByTeam(teamId);
  }
}

function toInterval(event: ScheduleWindow): EventInterval {
  if (event.endDate) {
    return { start: event.eventDate.getTime(), end: event.endDate.getTime() };
  }

  const start = new Date(event.eventDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

function overlaps(left: EventInterval, right: EventInterval) {
  return left.start < right.end && right.start < left.end;
}
