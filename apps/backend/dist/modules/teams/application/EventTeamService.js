const TERMINAL_EVENT_STATUSES = ["CONCLUIDO", "CANCELADO"];
export class EventTeamManagementError extends Error {
    constructor(message) {
        super(message);
        this.name = "EventTeamManagementError";
    }
}
export class EventTeamService {
    eventTeams;
    audit;
    constructor(eventTeams, audit) {
        this.eventTeams = eventTeams;
        this.audit = audit;
    }
    async assignTeamToEvent(eventId, teamId, actorId) {
        const event = await this.eventTeams.findEventById(eventId);
        if (!event || event.deletedAt)
            throw new EventTeamManagementError("Evento não encontrado");
        if (TERMINAL_EVENT_STATUSES.includes(event.status)) {
            throw new EventTeamManagementError("Não é possível atribuir equipe a evento concluído ou cancelado");
        }
        const team = await this.eventTeams.findTeamById(teamId);
        if (!team || team.deletedAt)
            throw new EventTeamManagementError("Equipe não encontrada");
        if (team.status !== "ATIVA")
            throw new EventTeamManagementError("Equipe inativa não pode ser atribuída");
        const candidate = toInterval(event);
        const conflictingEvent = (await this.eventTeams.listEventsByTeam(teamId))
            .filter((existing) => existing.id !== eventId && !existing.deletedAt)
            .find((existing) => overlaps(candidate, toInterval(existing)));
        if (conflictingEvent) {
            throw new EventTeamManagementError(`conflito de agenda: a equipe já está atribuída ao evento ${conflictingEvent.id}`);
        }
        const assignment = await this.eventTeams.assign(eventId, teamId, actorId);
        await this.audit.record({
            userId: actorId,
            action: "TEAM_ASSIGNED_TO_EVENT",
            entity: "Event",
            entityId: eventId,
            changes: { teamId, assignedAt: assignment.assignedAt },
        });
        return assignment;
    }
    async unassignTeamFromEvent(eventId, teamId, actorId) {
        await this.eventTeams.unassign(eventId, teamId);
        await this.audit.record({
            userId: actorId,
            action: "TEAM_UNASSIGNED_FROM_EVENT",
            entity: "Event",
            entityId: eventId,
            changes: { teamId },
        });
    }
    listTeamsByEvent(eventId) {
        return this.eventTeams.listTeamsByEvent(eventId);
    }
    listEventsByTeam(teamId) {
        return this.eventTeams.listAssignmentsByTeam(teamId);
    }
}
function toInterval(event) {
    if (event.endDate) {
        return { start: event.eventDate.getTime(), end: event.endDate.getTime() };
    }
    const start = new Date(event.eventDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start: start.getTime(), end: end.getTime() };
}
function overlaps(left, right) {
    return left.start < right.end && right.start < left.end;
}
