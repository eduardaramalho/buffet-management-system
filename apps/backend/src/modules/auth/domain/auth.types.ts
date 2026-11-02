export type UserRole = {
  role: {
    name: string;
    permissions: Array<{ permission: { key: string } }>;
  };
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  deletedAt: Date | null;
  mustChangePassword: boolean;
  tempPasswordExpiresAt: Date | null;
  roles: UserRole[];
};

/** Dados que vão para o access token: a flag permite bloquear rotas sem consultar o banco (ADR 0012). */
export type AccessTokenPayload = { sub: string; email: string; mustChangePassword: boolean };

export type StoredRefreshToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export interface UserRepository {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string): Promise<AuthUser | null>;
  /** Grava a nova senha, encerra a troca pendente e revoga as sessões abertas, tudo na mesma transação. */
  changePassword(id: string, passwordHash: string): Promise<void>;
}

export interface RefreshTokenRepository {
  create(input: { userId: string; tokenHash: string; expiresAt: Date; createdByIp?: string }): Promise<StoredRefreshToken>;
  findByHash(tokenHash: string): Promise<StoredRefreshToken | null>;
  revoke(id: string): Promise<void>;
}

export interface PasswordHasher {
  hash(value: string): Promise<string>;
  compare(value: string, hashedValue: string): Promise<boolean>;
}

export interface TokenProvider {
  createAccessToken(payload: AccessTokenPayload): string;
  createRefreshToken(): string;
  verifyAccessToken(token: string): AccessTokenPayload;
}
