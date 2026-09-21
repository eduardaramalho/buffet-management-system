import type { PrismaClient } from "../../../../generated/client.js";
import type { AuthUser, UserRepository } from "../../domain/auth.types.js";
import type { ManagedUser, UserListFilter, UserManagementRepository } from "../../domain/user-management.types.js";

export class PrismaUserRepository implements UserRepository, UserManagementRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } }
    }) as Promise<AuthUser | null>;
  }

  findById(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } }
    }) as Promise<AuthUser | null>;
  }

  async updatePassword(id: string, passwordHash: string) {
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  list(filter: UserListFilter) {
    const where = {
      deletedAt: null,
      ...(filter.search ? { OR: [{ name: { contains: filter.search } }, { email: { contains: filter.search } }] } : {}),
      ...(filter.status ? { isActive: filter.status === "active" } : {}),
      ...(filter.role ? { roles: { some: { role: { name: filter.role } } } } : {})
    };
    return this.prisma.user.findMany({ where, include: { roles: { select: { role: { select: { id: true, name: true, isProtected: true } } } } }, orderBy: { name: "asc" } }) as Promise<ManagedUser[]>;
  }

  findManagedById(id: string) {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null }, include: { roles: { select: { role: { select: { id: true, name: true, isProtected: true } } } } } }) as Promise<ManagedUser | null>;
  }

  async create(input: { name: string; email: string; passwordHash: string; roleId: string }) {
    return this.prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash: input.passwordHash, roles: { create: { roleId: input.roleId } } },
      include: { roles: { select: { role: { select: { id: true, name: true, isProtected: true } } } } }
    }) as Promise<ManagedUser>;
  }

  update(id: string, input: { name?: string; email?: string; passwordHash?: string }) {
    return this.prisma.user.update({ where: { id }, data: input, include: { roles: { select: { role: { select: { id: true, name: true, isProtected: true } } } } } }) as Promise<ManagedUser>;
  }

  setActive(id: string, isActive: boolean) {
    return this.prisma.user.update({ where: { id }, data: { isActive }, include: { roles: { select: { role: { select: { id: true, name: true, isProtected: true } } } } } }) as Promise<ManagedUser>;
  }

  softDelete(id: string) {
    return this.prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false }, include: { roles: { select: { role: { select: { id: true, name: true, isProtected: true } } } } } }) as Promise<ManagedUser>;
  }
}