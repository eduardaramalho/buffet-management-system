import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import type { PasswordHasher } from "../domain/auth.types.js";
import { TEMPORARY_PASSWORD_TTL_MS } from "../domain/password.policy.js";
import type { TemporaryPasswordGenerator, UserPasswordRepository } from "../domain/user-management.types.js";
import type { AuditService } from "./AuditService.js";
import { UserManagementError } from "./UserService.js";

/** Redefinir a senha de um usuário inativo não faz sentido: ele não consegue entrar até ser reativado. */
export class UserPasswordConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserPasswordConflictError";
  }
}

/**
 * Recuperação de senha por redefinição administrativa (ADR 0012). Separado do UserService porque
 * tem dependências próprias (gerador de senha, relógio) e uma única responsabilidade.
 */
export class UserPasswordService {
  constructor(
    private readonly users: UserPasswordRepository,
    private readonly hasher: PasswordHasher,
    private readonly generator: TemporaryPasswordGenerator,
    private readonly audit: AuditService,
    private readonly now: () => Date = () => new Date()
  ) {}

  async resetByAdmin(targetUserId: string, actorId: string) {
    const user = await this.users.findManagedById(targetUserId);
    if (!user) throw new NotFoundError("Usuário não encontrado");
    // Mesma proteção do UserService: administradores não são alterados pela interface.
    if (user.roles.some(({ role }) => role.isProtected)) {
      throw new UserManagementError("A senha de usuários administradores não pode ser redefinida pela interface");
    }
    if (!user.isActive) throw new UserPasswordConflictError("Reative o usuário antes de redefinir a senha");

    const temporaryPassword = this.generator.generate();
    const expiresAt = new Date(this.now().getTime() + TEMPORARY_PASSWORD_TTL_MS);
    await this.users.setTemporaryPassword(user.id, await this.hasher.hash(temporaryPassword), expiresAt);
    // A senha temporária nunca vai para a auditoria nem para o log: só é devolvida uma vez a quem redefiniu.
    await this.audit.record({
      userId: actorId,
      action: "USER_PASSWORD_RESET",
      entity: "User",
      entityId: user.id,
      changes: { expiresAt: expiresAt.toISOString() }
    });

    return { temporaryPassword, expiresAt };
  }
}
