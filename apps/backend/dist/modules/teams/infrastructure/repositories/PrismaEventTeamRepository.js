export class PrismaEventTeamRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findEventById(id) {
        return this.prisma.event.findFirst({
            where: { id, deletedAt: null },
            select: { id: true, eventDate: true, endDate: true, status: true, deletedAt: true },
        });
    }
    findTeamById(id) {
        return this.prisma.team.findFirst({
            where: { id, deletedAt: null },
            select: { id: true, status: true, deletedAt: true },
        });
    }
    listEventsByTeam(teamId) {
        return this.prisma.event.findMany({
            where: { deletedAt: null, teams: { some: { teamId } } },
            select: { id: true, eventDate: true, endDate: true, status: true, deletedAt: true },
            orderBy: { eventDate: "asc" },
        });
    }
    assign(eventId, teamId, assignedById) {
        return this.prisma.eventTeam.create({
            data: { eventId, teamId, assignedById },
        });
    }
    async unassign(eventId, teamId) {
        await this.prisma.eventTeam.delete({ where: { eventId_teamId: { eventId, teamId } } });
    }
    listTeamsByEvent(eventId) {
        return this.prisma.eventTeam.findMany({
            where: { eventId },
            orderBy: { assignedAt: "asc" },
        });
    }
    listAssignmentsByTeam(teamId) {
        return this.prisma.eventTeam.findMany({
            where: { teamId, event: { deletedAt: null } },
            orderBy: { assignedAt: "asc" },
        });
    }
}
