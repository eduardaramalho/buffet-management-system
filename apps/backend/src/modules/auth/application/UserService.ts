import type { PasswordHasher } from "../domain/auth.types.js";
import type { AuditService } from "./AuditService.js";
import type { UserListFilter, UserManagementRepository } from "../domain/user-management.types.js";

export class UserManagementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserManagementError";
  }
}

export class UserService {
  constructor(
    private readonly users: UserManagementRepository,
    private readonly hasher: PasswordHasher,
    private readonly audit: AuditService
  ) {}

  list(filter: UserListFilter) {
    return this.users.list(filter).then((users) => users.map((user) => this.toResponse(user)));
  }

  async get(id: string) {
    const user = await this.users.findManagedById(id);
    if (!user) throw new Error("Usuário não encontrado");
    return this.toResponse(user);
  }

  async create(input: { name: string; email: string; password: string; roleId: string }, actorId: string) {
    const user = await this.users.create({ ...input, email: input.email.toLowerCase().trim(), passwordHash: await this.hasher.hash(input.password) });
    await this.audit.record({ userId: actorId, action: "USER_CREATED", entity: "User", entityId: user.id, changes: { name: user.name, email: user.email, roleId: input.roleId } });
    return this.toResponse(user);
  }

  /** Dados cadastrais apenas. A senha muda só pelo reset do administrador ou pela troca do próprio usuário (ADR 0012). */
  async update(id: string, input: { name?: string; email?: string }, actorId: string) {
    await this.ensureUserCanBeEdited(id);
    const user = await this.users.update(id, { name: input.name, email: input.email?.toLowerCase().trim() });
    await this.audit.record({ userId: actorId, action: "USER_UPDATED", entity: "User", entityId: id, changes: { name: input.name, email: input.email } });
    return this.toResponse(user);
  }

  async setActive(id: string, isActive: boolean, actorId: string) {
    await this.ensureUserCanBeEdited(id);
    const user = await this.users.setActive(id, isActive);
    await this.audit.record({ userId: actorId, action: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED", entity: "User", entityId: id, changes: { isActive } });
    return this.toResponse(user);
  }

  async remove(id: string, actorId: string) {
    await this.ensureUserCanBeEdited(id);
    const user = await this.users.softDelete(id);
    await this.audit.record({ userId: actorId, action: "USER_DELETED", entity: "User", entityId: id });
    return this.toResponse(user);
  }

  private toResponse(user: Awaited<ReturnType<UserManagementRepository["findManagedById"]>> extends infer Value
    ? Exclude<Value, null>
    : never) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      deletedAt: user.deletedAt,
      roles: user.roles
    };
  }

  private async ensureUserCanBeEdited(id: string) {
    const user = await this.users.findManagedById(id);
    if (!user) throw new UserManagementError("Usuário não encontrado");
    const isAdministrator = user.roles.some(({ role }) => role.isProtected);
    if (isAdministrator) throw new UserManagementError("Usuários administradores não podem ser editados pela interface");
  }
}