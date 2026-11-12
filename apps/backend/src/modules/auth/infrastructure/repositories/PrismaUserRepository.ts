import type { PrismaClient } from "../../../../generated/client.js";
import type { AuthUser, UserRepository } from "../../domain/auth.types.js";
import type { ManagedUser, UserListFilter, UserManagementRepository, UserPasswordRepository } from "../../domain/user-management.types.js";

export class PrismaUserRepository implements UserRepository, UserManagementRepository, UserPasswordRepository {
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

  async setTemporaryPassword(id: string, passwordHash: string, expiresAt: Date) {
    await this.replaceCredentials(id, { passwordHash, mustChangePassword: true, tempPasswordExpiresAt: expiresAt });
  }

  async changePassword(id: string, passwordHash: string) {
    await this.replaceCredentials(id, { passwordHash, mustChangePassword: false, tempPasswordExpiresAt: null });
  }

  // Senha e sessões mudam juntas: se a revogação falhasse sozinha, uma sessão antiga sobreviveria à nova senha.
  private async replaceCredentials(id: string, data: { passwordHash: string; mustChangePassword: boolean; tempPasswordExpiresAt: Date | null }) {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data }),
      this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
    ]);
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

  findRoleById(id: string) {
    return this.prisma.role.findFirst({ where: { id, deletedAt: null }, select: { id: true, isProtected: true } });
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

  update(id: string, input: { name?: string; email?: string }) {
    return this.prisma.user.update({ where: { id }, data: input, include: { roles: { select: { role: { select: { id: true, name: true, isProtected: true } } } } } }) as Promise<ManagedUser>;
  }

  setActive(id: string, isActive: boolean) {
    return this.prisma.user.update({ where: { id }, data: { isActive }, include: { roles: { select: { role: { select: { id: true, name: true, isProtected: true } } } } } }) as Promise<ManagedUser>;
  }

  softDelete(id: string) {
    return this.prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false }, include: { roles: { select: { role: { select: { id: true, name: true, isProtected: true } } } } } }) as Promise<ManagedUser>;
  }
}