import type { TransactionClient } from "../../../../shared/domain/transaction.types.js";
import type { CreateTaskInput, TaskListFilter, TaskRecord } from "../../../tasks/domain/task.types.js";
import type { ScheduleWindow, TeamAvailability } from "../../../teams/domain/team.types.js";
import type { ReplicationTaskStore, ReplicationTeamGateway } from "../../domain/eventReplication.types.js";

// Adapters from the Tasks and Teams modules to the RF25 replication ports. Typed against the minimum
// each module exposes, so Events depends on contracts, not on their application services.

type TaskStoreSource = {
  list(filter: TaskListFilter): Promise<TaskRecord[]>;
  create(input: CreateTaskInput, tx?: TransactionClient): Promise<TaskRecord>;
};

export function createReplicationTaskStore(tasks: TaskStoreSource): ReplicationTaskStore {
  return {
    listByEvent: (eventId) => tasks.list({ eventId }),
    create: (input, tx) => tasks.create(input, tx),
  };
}

type TeamGatewaySources = {
  teams: { findById(id: string): Promise<{ id: string; name: string; specialty: string } | null> };
  eventTeams: {
    listTeamsByEvent(eventId: string): Promise<{ teamId: string }[]>;
    checkAvailability(teamId: string, schedule: ScheduleWindow): Promise<TeamAvailability>;
  };
  assignments: { assign(eventId: string, teamId: string, assignedById: string, tx?: TransactionClient): Promise<unknown> };
};

export function createReplicationTeamGateway({ teams, eventTeams, assignments }: TeamGatewaySources): ReplicationTeamGateway {
  return {
    listTeamsByEvent: (eventId) => eventTeams.listTeamsByEvent(eventId),
    findTeam: (teamId) => teams.findById(teamId),
    checkAvailability: (teamId, schedule) => eventTeams.checkAvailability(teamId, schedule),
    // Writes through the repository with the transaction: EventTeamService.assignTeamToEvent reads the
    // event outside the transaction and would not see the replica that is still being created.
    assign: (eventId, teamId, actorId, tx) => assignments.assign(eventId, teamId, actorId, tx),
  };
}
