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
  roles: UserRole[];
};

export type StoredRefreshToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type StoredPasswordResetToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export interface UserRepository {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string): Promise<AuthUser | null>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
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
  createAccessToken(payload: { sub: string; email: string }): string;
  createRefreshToken(): string;
  verifyAccessToken(token: string): { sub: string; email: string };
}

export interface PasswordResetTokenRepository {
  create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<StoredPasswordResetToken>;
  findByHash(tokenHash: string): Promise<StoredPasswordResetToken | null>;
  markUsed(id: string): Promise<void>;
}

export interface EmailProvider {
  sendPasswordReset(input: { to: string; name: string; token: string }): Promise<void>;
}