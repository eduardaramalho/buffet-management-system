import type { PrismaClient } from '../../../../generated/client.js';
import type { ManagedRole, RoleInput, RolePermission, RoleRepository, RoleUpdateInput } from '../../domain/role-management.types.js';

const roleInclude = {
  permissions: {
    include: { permission: true },
  },
};

const mapRole = (value: any): ManagedRole => ({
  id: value.id,
  name: value.name,
  description: value.description,
  isProtected: value.isProtected,
  deletedAt: value.deletedAt,
  permissions: value.permissions.map((item: any): RolePermission => ({
    id: item.permission?.id ?? item.id,
    key: item.permission?.key ?? item.key,
    description: item.permission?.description ?? item.description ?? null,
  })),
});

export class PrismaRoleRepository implements RoleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list() {
    const roles = await this.prisma.role.findMany({ where: { deletedAt: null }, include: roleInclude, orderBy: { name: 'asc' } });
    return roles.map(mapRole);
  }

  async findById(id: string) {
    const role = await this.prisma.role.findFirst({ where: { id, deletedAt: null }, include: roleInclude });
    return role ? mapRole(role) : null;
  }

  async create(input: RoleInput) {
    const role = await this.prisma.role.create({ data: input, include: roleInclude });
    return mapRole(role);
  }

  async update(id: string, input: RoleUpdateInput) {
    const role = await this.prisma.role.update({ where: { id }, data: input, include: roleInclude });
    return mapRole(role);
  }

  async softDelete(id: string) {
    const role = await this.prisma.role.update({ where: { id }, data: { deletedAt: new Date() }, include: roleInclude });
    return mapRole(role);
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } }) as Promise<RolePermission[]>;
  }

  async assignPermission(roleId: string, permissionId: string) {
    await this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: {},
      create: { roleId, permissionId },
    });
  }

  async revokePermission(roleId: string, permissionId: string) {
    await this.prisma.rolePermission.deleteMany({ where: { roleId, permissionId } });
  }

  countActiveUsers(roleId: string) {
    return this.prisma.userRole.count({ where: { roleId, user: { isActive: true, deletedAt: null } } });
  }
}