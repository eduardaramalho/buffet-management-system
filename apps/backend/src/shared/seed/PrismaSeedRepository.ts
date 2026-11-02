import type { PrismaClient } from "../../generated/client.js";
import type { NewSeedUser, SeedRepository } from "./seed.types.js";

export class PrismaSeedRepository implements SeedRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertRole(name: string, isProtected: boolean) {
    const role = await this.prisma.role.upsert({
      where: { name },
      update: { isProtected },
      create: { name, isProtected },
      select: { id: true }
    });
    return role.id;
  }

  async upsertPermission(key: string) {
    const permission = await this.prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
      select: { id: true }
    });
    return permission.id;
  }

  async linkRolePermission(roleId: string, permissionId: string) {
    await this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: {},
      create: { roleId, permissionId }
    });
  }

  async revokeRolePermissionsExcept(roleId: string, permissionIds: string[]) {
    await this.prisma.rolePermission.deleteMany({ where: { roleId, permissionId: { notIn: permissionIds } } });
  }

  async hasActiveGenericService() {
    const service = await this.prisma.service.findFirst({ where: { isCustom: true, deletedAt: null }, select: { id: true } });
    return service !== null;
  }

  async createGenericService(name: string) {
    await this.prisma.service.create({ data: { name, isCustom: true } });
  }

  // Email is unique even for soft-deleted users, so a deleted admin is still found and never recreated.
  async findUserIdByEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    return user?.id ?? null;
  }

  async createUser(user: NewSeedUser) {
    const created = await this.prisma.user.create({ data: user, select: { id: true } });
    return created.id;
  }

  async linkUserRole(userId: string, roleId: string) {
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId }
    });
  }
}
