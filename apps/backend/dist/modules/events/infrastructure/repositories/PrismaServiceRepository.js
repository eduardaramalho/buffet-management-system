export class PrismaServiceRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findById(id) {
        return this.prisma.service.findFirst({ where: { id, deletedAt: null } });
    }
    list() {
        return this.prisma.service.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
    }
    create(input) {
        return this.prisma.service.create({ data: input });
    }
    update(id, input) {
        return this.prisma.service.update({ where: { id }, data: input });
    }
    softDelete(id) {
        return this.prisma.service.update({ where: { id }, data: { deletedAt: new Date() } });
    }
}
