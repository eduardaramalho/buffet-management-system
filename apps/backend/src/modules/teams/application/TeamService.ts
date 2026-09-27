import type {
  AuditService,
  CollaboratorRepository,
  CreateTeamInput,
  TeamRepository,
  TeamStatus,
  UpdateTeamInput,
} from "../domain/team.types.js";

export class TeamManagementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamManagementError";
  }
}

export class TeamService {
  constructor(
    private readonly teams: TeamRepository,
    private readonly audit: AuditService,
    private readonly collaborators?: CollaboratorRepository,
  ) {}

  async create(input: CreateTeamInput) {
    const name = input.name.trim();
    if (!name) throw new TeamManagementError("O nome da equipe é obrigatório");

    const team = await this.teams.create({ ...input, name });
    await this.audit.record({
      userId: input.createdById,
      action: "TEAM_CREATED",
      entity: "Team",
      entityId: team.id,
      changes: { name: team.name, specialty: team.specialty },
    });
    return team;
  }

  list(filter: Parameters<TeamRepository["list"]>[0] = {}) {
    return this.teams.list(filter);
  }

  async get(id: string) {
    const team = await this.teams.findById(id);
    if (!team) throw new TeamManagementError("Equipe não encontrada");
    return team;
  }

  async update(id: string, input: UpdateTeamInput, actorId: string) {
    await this.get(id);
    if (input.name !== undefined && !input.name.trim()) {
      throw new TeamManagementError("O nome da equipe é obrigatório");
    }

    const updated = await this.teams.update(id, {
      ...input,
      name: input.name?.trim(),
    });
    await this.audit.record({
      userId: actorId,
      action: "TEAM_UPDATED",
      entity: "Team",
      entityId: id,
      changes: { after: updated },
    });
    return updated;
  }

  async remove(id: string, actorId: string) {
    await this.get(id);
    const deleted = await this.teams.softDelete(id);
    await this.audit.record({
      userId: actorId,
      action: "TEAM_DELETED",
      entity: "Team",
      entityId: id,
    });
    return deleted;
  }

  async setActive(id: string, active: boolean, actorId: string) {
    await this.get(id);
    const status: TeamStatus = active ? "ATIVA" : "INATIVA";
    const updated = await this.teams.setStatus(id, status);
    await this.audit.record({
      userId: actorId,
      action: "TEAM_UPDATED",
      entity: "Team",
      entityId: id,
      changes: { status },
    });
    return updated;
  }

  async addMember(teamId: string, collaboratorId: string, isLeader: boolean, actorId: string) {
    const team = await this.get(teamId);
    if (team.status !== "ATIVA") throw new TeamManagementError("Equipe inativa não pode receber novos membros");
    if (!this.collaborators) throw new TeamManagementError("Colaboradores não configurados");

    const collaborator = await this.collaborators.findById(collaboratorId);
    if (!collaborator || collaborator.deletedAt || collaborator.status !== "ATIVO") {
      throw new TeamManagementError("Colaborador não encontrado ou inativo");
    }
    if (team.members.some((member) => member.collaboratorId === collaboratorId)) {
      throw new TeamManagementError("Colaborador já pertence à equipe");
    }
    if (isLeader && team.members.some((member) => member.isLeader)) {
      throw new TeamManagementError("A equipe já possui um líder");
    }

    const updated = await this.teams.addMember(teamId, collaboratorId, isLeader);
    await this.audit.record({
      userId: actorId,
      action: "TEAM_MEMBER_ADDED",
      entity: "Team",
      entityId: teamId,
      changes: { collaboratorId, isLeader },
    });
    return updated;
  }

  async removeMember(teamId: string, collaboratorId: string, actorId: string) {
    await this.get(teamId);
    await this.teams.removeMember(teamId, collaboratorId);
    await this.audit.record({
      userId: actorId,
      action: "TEAM_MEMBER_REMOVED",
      entity: "Team",
      entityId: teamId,
      changes: { collaboratorId },
    });
  }
}
