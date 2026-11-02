import { createHash } from "node:crypto";
import type { AuthUser, PasswordHasher, RefreshTokenRepository, TokenProvider, UserRepository } from "../domain/auth.types.js";
import { AUTH_ERROR_CODES } from "../domain/password.policy.js";
import type { AuditService } from "./AuditService.js";

export class AuthError extends Error {
  constructor(message = "Credenciais inválidas", readonly code?: string) {
    super(message);
    this.name = "AuthError";
  }
}

const TEMP_PASSWORD_EXPIRED_MESSAGE = "Sua senha temporária expirou. Procure o administrador do sistema.";

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenProvider,
    private readonly refreshTokenTtlMs: number,
    private readonly audit: AuditService,
    private readonly now: () => Date = () => new Date()
  ) {}

  async login(email: string, password: string, ip?: string) {
    const user = await this.users.findByEmail(email.toLowerCase().trim());
    if (!user || !user.isActive || user.deletedAt || !(await this.hasher.compare(password, user.passwordHash))) {
      throw new AuthError();
    }
    // Só depois de a senha conferir: quem errou a senha recebe o erro genérico, sem saber que existe uma temporária.
    this.ensureTemporaryPasswordIsValid(user);

    return this.issueTokens(user, ip);
  }

  async refresh(refreshToken: string, ip?: string) {
    const stored = await this.refreshTokens.findByHash(this.hash(refreshToken));
    if (!stored || stored.revokedAt || stored.expiresAt <= this.now()) throw new AuthError("Refresh token inválido");

    const user = await this.users.findById(stored.userId);
    if (!user || !user.isActive || user.deletedAt) throw new AuthError("Usuário indisponível");

    await this.refreshTokens.revoke(stored.id);
    // Sem esta checagem, quem entrou com a senha temporária e nunca a trocou renovaria a sessão indefinidamente.
    this.ensureTemporaryPasswordIsValid(user);
    return this.issueTokens(user, ip);
  }

  async logout(refreshToken: string) {
    const stored = await this.refreshTokens.findByHash(this.hash(refreshToken));
    if (stored && !stored.revokedAt) await this.refreshTokens.revoke(stored.id);
  }

  /** Troca da própria senha; também conclui a troca obrigatória depois de uma redefinição administrativa (ADR 0012). */
  async changePassword(userId: string, currentPassword: string, newPassword: string, ip?: string) {
    const user = await this.users.findById(userId);
    if (!user || !user.isActive || user.deletedAt) throw new AuthError("Usuário indisponível");
    if (!(await this.hasher.compare(currentPassword, user.passwordHash))) throw new AuthError("Senha atual incorreta");
    this.ensureTemporaryPasswordIsValid(user);

    await this.users.changePassword(user.id, await this.hasher.hash(newPassword));
    await this.audit.record({ userId: user.id, action: "USER_PASSWORD_CHANGED", entity: "User", entityId: user.id });

    return this.issueTokens({ ...user, mustChangePassword: false }, ip);
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user || !user.isActive || user.deletedAt) throw new AuthError("Usuário indisponível");
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      mustChangePassword: user.mustChangePassword,
      roles: user.roles.map(({ role }) => ({ name: role.name, permissions: role.permissions.map(({ permission }) => permission.key) }))
    };
  }

  async hasPermission(userId: string, permissionKey: string) {
    const user = await this.users.findById(userId);
    return Boolean(user?.isActive && !user.deletedAt && user.roles.some(({ role }) =>
      role.permissions.some(({ permission }) => permission.key === permissionKey)
    ));
  }

  private ensureTemporaryPasswordIsValid(user: AuthUser) {
    const expiresAt = user.tempPasswordExpiresAt;
    if (user.mustChangePassword && expiresAt && expiresAt <= this.now()) {
      throw new AuthError(TEMP_PASSWORD_EXPIRED_MESSAGE, AUTH_ERROR_CODES.TEMP_PASSWORD_EXPIRED);
    }
  }

  private async issueTokens(user: Pick<AuthUser, "id" | "email" | "name" | "mustChangePassword">, ip?: string) {
    const refreshToken = this.tokens.createRefreshToken();
    await this.refreshTokens.create({
      userId: user.id,
      tokenHash: this.hash(refreshToken),
      expiresAt: new Date(this.now().getTime() + this.refreshTokenTtlMs),
      createdByIp: ip
    });

    const { id, name, email, mustChangePassword } = user;
    return {
      user: { id, name, email, mustChangePassword },
      accessToken: this.tokens.createAccessToken({ sub: id, email, mustChangePassword }),
      refreshToken
    };
  }

  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }
}
