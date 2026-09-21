const teamInclude = {
    members: { include: { collaborator: true } },
    events: true,
};
export class PrismaTeamRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    create(input) {
        return this.prisma.team.create({ data: input, include: teamInclude });
    }
    findById(id) {
        return this.prisma.team.findFirst({ where: { id, deletedAt: null }, include: teamInclude });
    }
    list(filter) {
        return this.prisma.team.findMany({
            where: {
                deletedAt: null,
                ...(filter.status ? { status: filter.status } : {}),
                ...(filter.specialty ? { specialty: filter.specialty } : {}),
                ...(filter.search ? { name: { contains: filter.search } } : {}),
            },
            orderBy: { name: "asc" },
            include: teamInclude,
        });
    }
    update(id, input) {
        return this.prisma.team.update({ where: { id }, data: input, include: teamInclude });
    }
    softDelete(id) {
        return this.prisma.team.update({ where: { id }, data: { deletedAt: new Date() }, include: teamInclude });
    }
    setStatus(id, status) {
        return this.prisma.team.update({ where: { id }, data: { status }, include: teamInclude });
    }
    async addMember(teamId, collaboratorId, isLeader) {
        await this.prisma.teamMember.create({ data: { teamId, collaboratorId, isLeader } });
        return this.prisma.team.findFirstOrThrow({ where: { id: teamId, deletedAt: null }, include: teamInclude });
    }
    async removeMember(teamId, collaboratorId) {
        await this.prisma.teamMember.delete({ where: { teamId_collaboratorId: { teamId, collaboratorId } } });
    }
    findCollaboratorById(id) {
        return this.prisma.collaborator.findFirst({ where: { id, deletedAt: null } });
    }
}
