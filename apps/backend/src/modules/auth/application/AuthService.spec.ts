import { describe, expect, it, jest } from '@jest/globals';

import { AuthError, AuthService } from './AuthService.js';
import type { AuthUser, PasswordResetTokenRepository, RefreshTokenRepository, UserRepository } from '../domain/auth.types.js';

type RoleInfo = {
  role: {
    name: string;
    permissions: Array<{ permission: { key: string } }>;
  };
};

const makeUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 'user-1',
  name: 'Alice',
  email: 'alice@buffet.com',
  passwordHash: 'hashed-password',
  isActive: true,
  deletedAt: null,
  roles: [],
  ...overrides,
});

describe('AuthService', () => {
  const createRefreshRepo = (): RefreshTokenRepository => ({
    create: jest.fn(async ({ userId, tokenHash, expiresAt, createdByIp }) => ({
      id: `refresh-${userId}-${Date.now()}`,
      userId,
      tokenHash,
      expiresAt,
      revokedAt: null,
      createdByIp,
    } as Awaited<ReturnType<RefreshTokenRepository['create']>>)),
    findByHash: jest.fn(async () => null),
    revoke: jest.fn(async () => undefined),
  });

  const createPasswordResetRepo = (): PasswordResetTokenRepository => ({
    create: jest.fn(async ({ userId, tokenHash, expiresAt }) => ({
      id: `reset-${userId}`,
      userId,
      tokenHash,
      expiresAt,
      usedAt: null,
    })),
    findByHash: jest.fn(async () => null),
    markUsed: jest.fn(async () => undefined),
  });

  it('logs in a valid and active user and issues a new refresh token', async () => {
    const user = makeUser();
    const users: UserRepository = {
      findByEmail: jest.fn(async () => user),
      findById: jest.fn(async () => user),
      updatePassword: jest.fn(async () => undefined),
    };
    const refreshTokens = createRefreshRepo();
    const passwordResetTokens = createPasswordResetRepo();
    const service = new AuthService(
      users,
      refreshTokens,
      {
        hash: jest.fn(async () => 'hashed-password'),
        compare: jest.fn(async () => true),
      },
      {
        createAccessToken: jest.fn(() => 'access-token'),
        createRefreshToken: jest.fn(() => 'refresh-token'),
        verifyAccessToken: jest.fn(() => ({ sub: user.id, email: user.email })),
      },
      60_000,
      passwordResetTokens,
      { sendPasswordReset: jest.fn(async () => undefined) },
      60_000,
    );

    const result = await service.login('alice@buffet.com', 'secret123', '127.0.0.1');

    expect(result).toMatchObject({
      user: { id: user.id, name: user.name, email: user.email },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(users.findByEmail).toHaveBeenCalledWith('alice@buffet.com');
    expect(refreshTokens.create).toHaveBeenCalledTimes(1);
  });

  it('throws AuthError when the password does not match', async () => {
    const user = makeUser();
    const service = new AuthService(
      {
        findByEmail: jest.fn(async () => user),
        findById: jest.fn(async () => user),
        updatePassword: jest.fn(async () => undefined),
      },
      createRefreshRepo(),
      {
        hash: jest.fn(async () => 'hashed-password'),
        compare: jest.fn(async () => false),
      },
      {
        createAccessToken: jest.fn(() => 'access-token'),
        createRefreshToken: jest.fn(() => 'refresh-token'),
        verifyAccessToken: jest.fn(() => ({ sub: user.id, email: user.email })),
      },
      60_000,
      createPasswordResetRepo(),
      { sendPasswordReset: jest.fn(async () => undefined) },
      60_000,
    );

    await expect(service.login('alice@buffet.com', 'wrong-password')).rejects.toBeInstanceOf(AuthError);
  });

  it('sends a reset token to the user and stores its hash', async () => {
    const user = makeUser();
    const emailProvider = { sendPasswordReset: jest.fn(async () => undefined) };
    const passwordResetTokens = createPasswordResetRepo();
    const service = new AuthService(
      {
        findByEmail: jest.fn(async () => user),
        findById: jest.fn(async () => user),
        updatePassword: jest.fn(async () => undefined),
      },
      createRefreshRepo(),
      {
        hash: jest.fn(async () => 'hashed-password'),
        compare: jest.fn(async () => true),
      },
      {
        createAccessToken: jest.fn(() => 'access-token'),
        createRefreshToken: jest.fn(() => 'refresh-token'),
        verifyAccessToken: jest.fn(() => ({ sub: user.id, email: user.email })),
      },
      60_000,
      passwordResetTokens,
      emailProvider,
      60_000,
    );

    await service.forgotPassword('Alice@Buffet.com');

    expect(emailProvider.sendPasswordReset).toHaveBeenCalledTimes(1);
    expect(passwordResetTokens.create).toHaveBeenCalledTimes(1);
    expect((emailProvider.sendPasswordReset as jest.Mock).mock.calls[0][0]).toMatchObject({
      to: 'alice@buffet.com',
      name: 'Alice',
    });
  });

  it('resets the password when the token is valid', async () => {
    const user = makeUser();
    const storedToken = {
      id: 'reset-1',
      userId: user.id,
      tokenHash: 'valid-hash',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    };
    const passwordResetTokens = createPasswordResetRepo();
    passwordResetTokens.findByHash = jest.fn(async () => storedToken);

    const service = new AuthService(
      {
        findByEmail: jest.fn(async () => user),
        findById: jest.fn(async () => user),
        updatePassword: jest.fn(async () => undefined),
      },
      createRefreshRepo(),
      {
        hash: jest.fn(async () => 'new-hash'),
        compare: jest.fn(async () => true),
      },
      {
        createAccessToken: jest.fn(() => 'access-token'),
        createRefreshToken: jest.fn(() => 'refresh-token'),
        verifyAccessToken: jest.fn(() => ({ sub: user.id, email: user.email })),
      },
      60_000,
      passwordResetTokens,
      { sendPasswordReset: jest.fn(async () => undefined) },
      60_000,
    );

    await service.resetPassword('token-123', 'newPassword123');

    expect(passwordResetTokens.markUsed).toHaveBeenCalledWith('reset-1');
  });

  it('rejects inactive, deleted, and unknown users during login', async () => {
    for (const user of [makeUser({ isActive: false }), makeUser({ deletedAt: new Date() }), null]) {
      const service = new AuthService(
        { findByEmail: jest.fn(async () => user), findById: jest.fn(async () => user), updatePassword: jest.fn(async () => undefined) },
        createRefreshRepo(),
        { hash: jest.fn(async () => 'hash'), compare: jest.fn(async () => true) },
        { createAccessToken: jest.fn(() => 'access'), createRefreshToken: jest.fn(() => 'refresh'), verifyAccessToken: jest.fn(() => ({ sub: 'u1', email: 'a@b.com' })) },
        60_000,
        createPasswordResetRepo(),
        { sendPasswordReset: jest.fn(async () => undefined) },
        60_000,
      );

      await expect(service.login('alice@buffet.com', 'secret123')).rejects.toBeInstanceOf(AuthError);
    }
  });

  it('rotates a valid refresh token and revokes the previous one', async () => {
    const user = makeUser();
    const refreshTokens = createRefreshRepo();
    refreshTokens.findByHash = jest.fn(async () => ({ id: 'refresh-1', userId: user.id, tokenHash: 'hash', expiresAt: new Date(Date.now() + 60_000), revokedAt: null }));
    const service = new AuthService(
      { findByEmail: jest.fn(async () => user), findById: jest.fn(async () => user), updatePassword: jest.fn(async () => undefined) },
      refreshTokens,
      { hash: jest.fn(async () => 'hash'), compare: jest.fn(async () => true) },
      { createAccessToken: jest.fn(() => 'access'), createRefreshToken: jest.fn(() => 'refresh'), verifyAccessToken: jest.fn(() => ({ sub: user.id, email: user.email })) },
      60_000,
      createPasswordResetRepo(),
      { sendPasswordReset: jest.fn(async () => undefined) },
      60_000,
    );

    await service.refresh('old-refresh', '127.0.0.1');

    expect(refreshTokens.revoke).toHaveBeenCalledWith('refresh-1');
    expect(refreshTokens.create).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid, revoked, and expired refresh tokens', async () => {
    for (const stored of [
      null,
      { id: 'r1', userId: 'u1', tokenHash: 'hash', expiresAt: new Date(Date.now() + 60_000), revokedAt: new Date() },
      { id: 'r1', userId: 'u1', tokenHash: 'hash', expiresAt: new Date(Date.now() - 60_000), revokedAt: null },
    ]) {
      const refreshTokens = createRefreshRepo();
      refreshTokens.findByHash = jest.fn(async () => stored);
      const service = new AuthService(
        { findByEmail: jest.fn(async () => null), findById: jest.fn(async () => makeUser()), updatePassword: jest.fn(async () => undefined) },
        refreshTokens,
        { hash: jest.fn(async () => 'hash'), compare: jest.fn(async () => true) },
        { createAccessToken: jest.fn(() => 'access'), createRefreshToken: jest.fn(() => 'refresh'), verifyAccessToken: jest.fn(() => ({ sub: 'u1', email: 'a@b.com' })) },
        60_000,
        createPasswordResetRepo(),
        { sendPasswordReset: jest.fn(async () => undefined) },
        60_000,
      );

      await expect(service.refresh('refresh')).rejects.toBeInstanceOf(AuthError);
    }
  });

  it('does not revoke an unknown or already revoked token on logout', async () => {
    const refreshTokens = createRefreshRepo();
    refreshTokens.findByHash = jest.fn(async () => ({ id: 'r1', userId: 'u1', tokenHash: 'hash', expiresAt: new Date(), revokedAt: new Date() }));
    const service = new AuthService(
      { findByEmail: jest.fn(async () => null), findById: jest.fn(async () => null), updatePassword: jest.fn(async () => undefined) },
      refreshTokens,
      { hash: jest.fn(async () => 'hash'), compare: jest.fn(async () => false) },
      { createAccessToken: jest.fn(() => 'access'), createRefreshToken: jest.fn(() => 'refresh'), verifyAccessToken: jest.fn(() => ({ sub: 'u1', email: 'a@b.com' })) },
      60_000,
      createPasswordResetRepo(),
      { sendPasswordReset: jest.fn(async () => undefined) },
      60_000,
    );

    await service.logout('refresh');
    refreshTokens.findByHash = jest.fn(async () => null);
    await service.logout('unknown');

    expect(refreshTokens.revoke).not.toHaveBeenCalled();
  });

  it('silently ignores unknown or unavailable users during password recovery', async () => {
    for (const user of [null, makeUser({ isActive: false }), makeUser({ deletedAt: new Date() })]) {
      const emailProvider = { sendPasswordReset: jest.fn(async () => undefined) };
      const service = new AuthService(
        { findByEmail: jest.fn(async () => user), findById: jest.fn(async () => user), updatePassword: jest.fn(async () => undefined) },
        createRefreshRepo(),
        { hash: jest.fn(async () => 'hash'), compare: jest.fn(async () => true) },
        { createAccessToken: jest.fn(() => 'access'), createRefreshToken: jest.fn(() => 'refresh'), verifyAccessToken: jest.fn(() => ({ sub: 'u1', email: 'a@b.com' })) },
        60_000,
        createPasswordResetRepo(),
        emailProvider,
        60_000,
      );

      await service.forgotPassword('unknown@buffet.com');
      expect(emailProvider.sendPasswordReset).not.toHaveBeenCalled();
    }
  });

  it('rejects used or expired password reset tokens', async () => {
    for (const stored of [
      null,
      { id: 'r1', userId: 'u1', tokenHash: 'hash', expiresAt: new Date(Date.now() + 60_000), usedAt: new Date() },
      { id: 'r1', userId: 'u1', tokenHash: 'hash', expiresAt: new Date(Date.now() - 60_000), usedAt: null },
    ]) {
      const resetTokens = createPasswordResetRepo();
      resetTokens.findByHash = jest.fn(async () => stored);
      const service = new AuthService(
        { findByEmail: jest.fn(async () => null), findById: jest.fn(async () => null), updatePassword: jest.fn(async () => undefined) },
        createRefreshRepo(),
        { hash: jest.fn(async () => 'hash'), compare: jest.fn(async () => true) },
        { createAccessToken: jest.fn(() => 'access'), createRefreshToken: jest.fn(() => 'refresh'), verifyAccessToken: jest.fn(() => ({ sub: 'u1', email: 'a@b.com' })) },
        60_000,
        resetTokens,
        { sendPasswordReset: jest.fn(async () => undefined) },
        60_000,
      );

      await expect(service.resetPassword('invalid', 'newPassword123')).rejects.toBeInstanceOf(AuthError);
    }
  });

  it('returns the user profile and evaluates permissions', async () => {
    const user = makeUser({ roles: [{ role: { name: 'manager', permissions: [{ permission: { key: 'users:list' } }] } }] });
    const users: UserRepository = {
      findByEmail: jest.fn(async () => user),
      findById: jest.fn(async () => user),
      updatePassword: jest.fn(async () => undefined),
    };
    const service = new AuthService(users, createRefreshRepo(), { hash: jest.fn(async () => 'hash'), compare: jest.fn(async () => true) }, { createAccessToken: jest.fn(() => 'access'), createRefreshToken: jest.fn(() => 'refresh'), verifyAccessToken: jest.fn(() => ({ sub: user.id, email: user.email })) }, 60_000, createPasswordResetRepo(), { sendPasswordReset: jest.fn(async () => undefined) }, 60_000);

    await expect(service.me(user.id)).resolves.toEqual({ id: user.id, name: user.name, email: user.email, roles: [{ name: 'manager', permissions: ['users:list'] }] });
    await expect(service.hasPermission(user.id, 'users:list')).resolves.toBe(true);
    await expect(service.hasPermission(user.id, 'users:create')).resolves.toBe(false);
  });

  it('rejects unavailable users from profile access and denies inactive permissions', async () => {
    const user = makeUser({ isActive: false });
    const users: UserRepository = { findByEmail: jest.fn(async () => null), findById: jest.fn(async () => user), updatePassword: jest.fn(async () => undefined) };
    const service = new AuthService(users, createRefreshRepo(), { hash: jest.fn(async () => 'hash'), compare: jest.fn(async () => true) }, { createAccessToken: jest.fn(() => 'access'), createRefreshToken: jest.fn(() => 'refresh'), verifyAccessToken: jest.fn(() => ({ sub: user.id, email: user.email })) }, 60_000, createPasswordResetRepo(), { sendPasswordReset: jest.fn(async () => undefined) }, 60_000);

    await expect(service.me(user.id)).rejects.toEqual(new AuthError('Usuário indisponível'));
    await expect(service.hasPermission(user.id, 'users:list')).resolves.toBe(false);
  });
});
