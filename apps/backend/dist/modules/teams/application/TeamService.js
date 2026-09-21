export class TeamManagementError extends Error {
    constructor(message) {
        super(message);
        this.name = "TeamManagementError";
    }
}
export class TeamService {
    teams;
    audit;
    collaborators;
    constructor(teams, audit, collaborators) {
        this.teams = teams;
        this.audit = audit;
        this.collaborators = collaborators;
    }
    async create(input) {
        const name = input.name.trim();
        if (!name)
            throw new TeamManagementError("O nome da equipe é obrigatório");
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
    list(filter = {}) {
        return this.teams.list(filter);
    }
    async get(id) {
        const team = await this.teams.findById(id);
        if (!team)
            throw new TeamManagementError("Equipe não encontrada");
        return team;
    }
    async update(id, input, actorId) {
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
    async remove(id, actorId) {
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
    async setActive(id, active, actorId) {
        await this.get(id);
        const status = active ? "ATIVA" : "INATIVA";
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
    async addMember(teamId, collaboratorId, isLeader, actorId) {
        const team = await this.get(teamId);
        if (!this.collaborators)
            throw new TeamManagementError("Colaboradores não configurados");
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
    async removeMember(teamId, collaboratorId, actorId) {
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
