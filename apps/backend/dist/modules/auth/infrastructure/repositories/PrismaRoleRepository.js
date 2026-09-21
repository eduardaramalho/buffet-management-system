const roleInclude = {
    permissions: {
        include: { permission: true },
    },
};
const mapRole = (value) => ({
    id: value.id,
    name: value.name,
    description: value.description,
    deletedAt: value.deletedAt,
    permissions: value.permissions.map((item) => ({
        id: item.permission?.id ?? item.id,
        key: item.permission?.key ?? item.key,
        description: item.permission?.description ?? item.description ?? null,
    })),
});
export class PrismaRoleRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list() {
        const roles = await this.prisma.role.findMany({ where: { deletedAt: null }, include: roleInclude, orderBy: { name: 'asc' } });
        return roles.map(mapRole);
    }
    async findById(id) {
        const role = await this.prisma.role.findFirst({ where: { id, deletedAt: null }, include: roleInclude });
        return role ? mapRole(role) : null;
    }
    async create(input) {
        const role = await this.prisma.role.create({ data: input, include: roleInclude });
        return mapRole(role);
    }
    async update(id, input) {
        const role = await this.prisma.role.update({ where: { id }, data: input, include: roleInclude });
        return mapRole(role);
    }
    async softDelete(id) {
        const role = await this.prisma.role.update({ where: { id }, data: { deletedAt: new Date() }, include: roleInclude });
        return mapRole(role);
    }
    listPermissions() {
        return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
    }
    async assignPermission(roleId, permissionId) {
        await this.prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId, permissionId } },
            update: {},
            create: { roleId, permissionId },
        });
    }
    async revokePermission(roleId, permissionId) {
        await this.prisma.rolePermission.deleteMany({ where: { roleId, permissionId } });
    }
    countActiveUsers(roleId) {
        return this.prisma.userRole.count({ where: { roleId, user: { isActive: true, deletedAt: null } } });
    }
}
