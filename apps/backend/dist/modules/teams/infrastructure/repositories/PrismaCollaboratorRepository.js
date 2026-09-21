export class PrismaCollaboratorRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findById(id) {
        return this.prisma.collaborator.findFirst({ where: { id, deletedAt: null } });
    }
    list(filter) {
        return this.prisma.collaborator.findMany({
            where: { deletedAt: null, ...(filter.search ? { name: { contains: filter.search } } : {}) },
            orderBy: { name: "asc" },
        });
    }
    create(input) {
        return this.prisma.collaborator.create({ data: input });
    }
    update(id, input) {
        return this.prisma.collaborator.update({ where: { id }, data: input });
    }
    setStatus(id, status) {
        return this.prisma.collaborator.update({ where: { id }, data: { status } });
    }
}
