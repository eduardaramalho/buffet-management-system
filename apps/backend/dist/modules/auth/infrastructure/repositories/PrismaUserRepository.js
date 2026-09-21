export class PrismaUserRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findByEmail(email) {
        return this.prisma.user.findFirst({
            where: { email, deletedAt: null },
            include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } }
        });
    }
    findById(id) {
        return this.prisma.user.findFirst({
            where: { id, deletedAt: null },
            include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } }
        });
    }
    async updatePassword(id, passwordHash) {
        await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    }
    list(filter) {
        const where = {
            deletedAt: null,
            ...(filter.search ? { OR: [{ name: { contains: filter.search } }, { email: { contains: filter.search } }] } : {}),
            ...(filter.status ? { isActive: filter.status === "active" } : {}),
            ...(filter.role ? { roles: { some: { role: { name: filter.role } } } } : {})
        };
        return this.prisma.user.findMany({ where, include: { roles: { select: { role: { select: { id: true, name: true, isProtected: true } } } } }, orderBy: { name: "asc" } });
    }
    findManagedById(id) {
        return this.prisma.user.findFirst({ where: { id, deletedAt: null }, include: { roles: { select: { role: { select: { id: true, name: true, isProtected: true } } } } } });
    }
    async create(input) {
        return this.prisma.user.create({
            data: { name: input.name, email: input.email, passwordHash: input.passwordHash, roles: { create: { roleId: input.roleId } } },
            include: { roles: { select: { role: { select: { id: true, name: true, isProtected: true } } } } }
        });
    }
    update(id, input) {
        return this.prisma.user.update({ where: { id }, data: input, include: { roles: { select: { role: { select: { id: true, name: true, isProtected: true } } } } } });
    }
    setActive(id, isActive) {
        return this.prisma.user.update({ where: { id }, data: { isActive }, include: { roles: { select: { role: { select: { id: true, name: true, isProtected: true } } } } } });
    }
    softDelete(id) {
        return this.prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false }, include: { roles: { select: { role: { select: { id: true, name: true, isProtected: true } } } } } });
    }
}
