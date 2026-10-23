import type { TransactionClient } from "../../../shared/domain/transaction.types.js";

export const teamSpecialties = ["COZINHA", "SALAO", "BAR", "DECORACAO", "LIMPEZA", "CERIMONIAL", "OUTRO"] as const;
export type TeamSpecialty = (typeof teamSpecialties)[number];

export const teamStatuses = ["ATIVA", "INATIVA"] as const;
export type TeamStatus = (typeof teamStatuses)[number];

export const collaboratorStatuses = ["ATIVO", "INATIVO"] as const;
export type CollaboratorStatus = (typeof collaboratorStatuses)[number];

export type CollaboratorRecord = {
  id: string;
  name: string;
  phone: string | null;
  position: string;
  status: CollaboratorStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type CreateCollaboratorInput = {
  name: string;
  phone: string | null;
  position: string;
};

export type UpdateCollaboratorInput = Partial<CreateCollaboratorInput>;

export type CollaboratorListFilter = { search?: string };

export type TeamMemberRecord = {
  collaboratorId: string;
  isLeader: boolean;
  collaborator: CollaboratorRecord;
};

export type TeamRecord = {
  id: string;
  name: string;
  specialty: TeamSpecialty;
  status: TeamStatus;
  observations: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  members: TeamMemberRecord[];
  events: EventTeamRecord[];
};

export type EventTeamRecord = {
  eventId: string;
  assignedAt: Date;
  assignedById: string;
};

export type CreateTeamInput = {
  name: string;
  specialty: TeamSpecialty;
  observations: string | null;
  createdById: string;
};

export type UpdateTeamInput = Partial<Pick<CreateTeamInput, "name" | "specialty" | "observations">>;

export type TeamListFilter = {
  search?: string;
  specialty?: TeamSpecialty;
  status?: TeamStatus;
};

export interface TeamRepository {
  create(input: CreateTeamInput): Promise<TeamRecord>;
  findById(id: string): Promise<TeamRecord | null>;
  list(filter: TeamListFilter): Promise<TeamRecord[]>;
  update(id: string, input: UpdateTeamInput): Promise<TeamRecord>;
  softDelete(id: string): Promise<TeamRecord>;
  setStatus(id: string, status: TeamStatus): Promise<TeamRecord>;
  addMember(teamId: string, collaboratorId: string, isLeader: boolean): Promise<TeamRecord>;
  removeMember(teamId: string, collaboratorId: string): Promise<void>;
}

export interface CollaboratorRepository {
  findById(id: string): Promise<CollaboratorRecord | null>;
  list(filter: CollaboratorListFilter): Promise<CollaboratorRecord[]>;
  create(input: CreateCollaboratorInput): Promise<CollaboratorRecord>;
  update(id: string, input: UpdateCollaboratorInput): Promise<CollaboratorRecord>;
  setStatus(id: string, status: CollaboratorStatus): Promise<CollaboratorRecord>;
}

export type EventSchedulingRecord = {
  id: string;
  name: string;
  eventDate: Date;
  endDate: Date | null;
  status: "PLANEJAMENTO" | "CONFIRMADO" | "EM_ANDAMENTO" | "CONCLUIDO" | "CANCELADO";
  deletedAt: Date | null;
};

export type TeamAssignmentRecord = {
  id: string;
  status: TeamStatus;
  deletedAt: Date | null;
};

export type EventTeamAssignment = {
  eventId: string;
  teamId: string;
  assignedAt: Date;
  assignedById: string;
};

export type ScheduleWindow = { eventDate: Date; endDate: Date | null };

export type TeamAvailability =
  | { available: true }
  | { available: false; reason: "NOT_FOUND" | "INACTIVE" | "SCHEDULE_CONFLICT"; conflictingEvent?: { id: string; name: string } };

export interface EventTeamRepository {
  findEventById(id: string): Promise<EventSchedulingRecord | null>;
  findTeamById(id: string): Promise<TeamAssignmentRecord | null>;
  listEventsByTeam(teamId: string): Promise<EventSchedulingRecord[]>;
  // tx (optional): when provided, the insert participates in the caller's Prisma transaction
  // instead of auto-committing on its own (see RuleEngineExecutionService.applyRules).
  assign(eventId: string, teamId: string, assignedById: string, tx?: TransactionClient): Promise<EventTeamAssignment>;
  unassign(eventId: string, teamId: string): Promise<void>;
  listTeamsByEvent(eventId: string): Promise<EventTeamAssignment[]>;
  listAssignmentsByTeam(teamId: string): Promise<EventTeamAssignment[]>;
}

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
