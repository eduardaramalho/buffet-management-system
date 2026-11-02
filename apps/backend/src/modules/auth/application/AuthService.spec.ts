import { describe, expect, it, jest } from '@jest/globals';

import { AuthError, AuthService } from './AuthService.js';
import type { AuthUser, PasswordHasher, RefreshTokenRepository, TokenProvider, UserRepository } from '../domain/auth.types.js';
import { AUTH_ERROR_CODES } from '../domain/password.policy.js';

const NOW = new Date('2026-10-27T12:00:00.000Z');
const ONE_HOUR_MS = 60 * 60 * 1000;

const makeUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 'user-1',
  name: 'Alice',
  email: 'alice@buffet.com',
  passwordHash: 'hashed-password',
  isActive: true,
  deletedAt: null,
  mustChangePassword: false,
  tempPasswordExpiresAt: null,
  roles: [],
  ...overrides,
});

const createUsersRepo = (user: AuthUser | null = makeUser()): UserRepository => ({
  findByEmail: jest.fn(async () => user),
  findById: jest.fn(async () => user),
  changePassword: jest.fn(async () => undefined),
});

const createRefreshRepo = (): RefreshTokenRepository => ({
  create: jest.fn(async ({ userId, tokenHash, expiresAt }) => ({ id: `refresh-${userId}`, userId, tokenHash, expiresAt, revokedAt: null })),
  findByHash: jest.fn(async () => null),
  revoke: jest.fn(async () => undefined),
});

const createHasher = (matches = true): PasswordHasher => ({
  hash: jest.fn(async (value: string) => `hashed:${value}`),
  compare: jest.fn(async () => matches),
});

const createTokens = (): TokenProvider => ({
  createAccessToken: jest.fn(() => 'access-token'),
  createRefreshToken: jest.fn(() => 'refresh-token'),
  verifyAccessToken: jest.fn(() => ({ sub: 'user-1', email: 'alice@buffet.com', mustChangePassword: false })),
});

const makeService = (deps: {
  users?: UserRepository;
  refreshTokens?: RefreshTokenRepository;
  hasher?: PasswordHasher;
  tokens?: TokenProvider;
  audit?: { record: jest.Mock };
} = {}) => {
  const users = deps.users ?? createUsersRepo();
  const refreshTokens = deps.refreshTokens ?? createRefreshRepo();
  const hasher = deps.hasher ?? createHasher();
  const tokens = deps.tokens ?? createTokens();
  const audit = deps.audit ?? { record: jest.fn(async () => undefined) };
  const service = new AuthService(users, refreshTokens, hasher, tokens, 60_000, audit as never, () => NOW);
  return { service, users, refreshTokens, hasher, tokens, audit };
};

const validStoredRefresh = (userId = 'user-1') => ({
  id: 'refresh-1',
  userId,
  tokenHash: 'hash',
  expiresAt: new Date(NOW.getTime() + ONE_HOUR_MS),
  revokedAt: null,
});

describe('AuthService', () => {
  describe('login', () => {
    it('logs in a valid and active user and issues a new refresh token', async () => {
      const { service, users, refreshTokens, tokens } = makeService();

      const result = await service.login('Alice@Buffet.com ', 'secret123', '127.0.0.1');

      expect(result).toEqual({
        user: { id: 'user-1', name: 'Alice', email: 'alice@buffet.com', mustChangePassword: false },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(users.findByEmail).toHaveBeenCalledWith('alice@buffet.com');
      expect(tokens.createAccessToken).toHaveBeenCalledWith({ sub: 'user-1', email: 'alice@buffet.com', mustChangePassword: false });
      expect(refreshTokens.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', createdByIp: '127.0.0.1' }));
    });

    it('throws AuthError when the password does not match', async () => {
      const { service } = makeService({ hasher: createHasher(false) });

      await expect(service.login('alice@buffet.com', 'wrong-password')).rejects.toEqual(new AuthError());
    });

    it('rejects inactive, deleted, and unknown users', async () => {
      for (const user of [makeUser({ isActive: false }), makeUser({ deletedAt: new Date() }), null]) {
        const { service } = makeService({ users: createUsersRepo(user) });
        await expect(service.login('alice@buffet.com', 'secret123')).rejects.toBeInstanceOf(AuthError);
      }
    });

    it('accepts a valid temporary password and flags the session for a mandatory change', async () => {
      const user = makeUser({ mustChangePassword: true, tempPasswordExpiresAt: new Date(NOW.getTime() + ONE_HOUR_MS) });
      const { service, tokens } = makeService({ users: createUsersRepo(user) });

      const result = await service.login('alice@buffet.com', 'Temp2345abcd');

      expect(result.user.mustChangePassword).toBe(true);
      expect(tokens.createAccessToken).toHaveBeenCalledWith({ sub: 'user-1', email: 'alice@buffet.com', mustChangePassword: true });
    });

    it('rejects an expired temporary password with a specific code', async () => {
      const user = makeUser({ mustChangePassword: true, tempPasswordExpiresAt: new Date(NOW.getTime() - 1) });
      const { service, refreshTokens } = makeService({ users: createUsersRepo(user) });

      const failure = service.login('alice@buffet.com', 'Temp2345abcd');

      await expect(failure).rejects.toBeInstanceOf(AuthError);
      await expect(failure).rejects.toMatchObject({ code: AUTH_ERROR_CODES.TEMP_PASSWORD_EXPIRED });
      expect(refreshTokens.create).not.toHaveBeenCalled();
    });

    it('checks the password before the expiration so a wrong password keeps the generic error', async () => {
      const user = makeUser({ mustChangePassword: true, tempPasswordExpiresAt: new Date(NOW.getTime() - 1) });
      const { service } = makeService({ users: createUsersRepo(user), hasher: createHasher(false) });

      await expect(service.login('alice@buffet.com', 'wrong')).rejects.toEqual(new AuthError());
    });
  });

  describe('refresh', () => {
    it('rotates a valid refresh token and revokes the previous one', async () => {
      const refreshTokens = createRefreshRepo();
      refreshTokens.findByHash = jest.fn(async () => validStoredRefresh());
      const { service } = makeService({ refreshTokens });

      await service.refresh('old-refresh', '127.0.0.1');

      expect(refreshTokens.revoke).toHaveBeenCalledWith('refresh-1');
      expect(refreshTokens.create).toHaveBeenCalledTimes(1);
    });

    it('reissues the claim from the database so a pending change survives the rotation', async () => {
      const refreshTokens = createRefreshRepo();
      refreshTokens.findByHash = jest.fn(async () => validStoredRefresh());
      const user = makeUser({ mustChangePassword: true, tempPasswordExpiresAt: new Date(NOW.getTime() + ONE_HOUR_MS) });
      const { service, tokens } = makeService({ refreshTokens, users: createUsersRepo(user) });

      const result = await service.refresh('old-refresh');

      expect(result.user.mustChangePassword).toBe(true);
      expect(tokens.createAccessToken).toHaveBeenCalledWith(expect.objectContaining({ mustChangePassword: true }));
    });

    it('ends the session when the temporary password expired without being changed', async () => {
      const refreshTokens = createRefreshRepo();
      refreshTokens.findByHash = jest.fn(async () => validStoredRefresh());
      const user = makeUser({ mustChangePassword: true, tempPasswordExpiresAt: new Date(NOW.getTime() - 1) });
      const { service } = makeService({ refreshTokens, users: createUsersRepo(user) });

      await expect(service.refresh('old-refresh')).rejects.toMatchObject({ code: AUTH_ERROR_CODES.TEMP_PASSWORD_EXPIRED });
      expect(refreshTokens.revoke).toHaveBeenCalledWith('refresh-1');
      expect(refreshTokens.create).not.toHaveBeenCalled();
    });

    it('rejects invalid, revoked, and expired refresh tokens', async () => {
      for (const stored of [
        null,
        { ...validStoredRefresh(), revokedAt: new Date() },
        { ...validStoredRefresh(), expiresAt: new Date(NOW.getTime() - 1) },
      ]) {
        const refreshTokens = createRefreshRepo();
        refreshTokens.findByHash = jest.fn(async () => stored);
        const { service } = makeService({ refreshTokens });

        await expect(service.refresh('refresh')).rejects.toBeInstanceOf(AuthError);
      }
    });

    it('rejects a refresh for a user that became unavailable', async () => {
      const refreshTokens = createRefreshRepo();
      refreshTokens.findByHash = jest.fn(async () => validStoredRefresh());
      const { service } = makeService({ refreshTokens, users: createUsersRepo(makeUser({ isActive: false })) });

      await expect(service.refresh('refresh')).rejects.toEqual(new AuthError('Usuário indisponível'));
    });
  });

  describe('logout', () => {
    it('does not revoke an unknown or already revoked token', async () => {
      const refreshTokens = createRefreshRepo();
      refreshTokens.findByHash = jest.fn(async () => ({ ...validStoredRefresh(), revokedAt: new Date() }));
      const { service } = makeService({ refreshTokens });

      await service.logout('refresh');
      refreshTokens.findByHash = jest.fn(async () => null);
      await service.logout('unknown');

      expect(refreshTokens.revoke).not.toHaveBeenCalled();
    });

    it('revokes an active refresh token', async () => {
      const refreshTokens = createRefreshRepo();
      refreshTokens.findByHash = jest.fn(async () => validStoredRefresh());
      const { service } = makeService({ refreshTokens });

      await service.logout('refresh');

      expect(refreshTokens.revoke).toHaveBeenCalledWith('refresh-1');
    });
  });

  describe('changePassword', () => {
    it('stores the new hash, clears the pending flag, audits and returns a fresh session', async () => {
      const user = makeUser({ mustChangePassword: true, tempPasswordExpiresAt: new Date(NOW.getTime() + ONE_HOUR_MS) });
      const { service, users, hasher, tokens, audit } = makeService({ users: createUsersRepo(user) });

      const result = await service.changePassword('user-1', 'Temp2345abcd', 'NovaSenha123', '127.0.0.1');

      expect(hasher.compare).toHaveBeenCalledWith('Temp2345abcd', 'hashed-password');
      expect(users.changePassword).toHaveBeenCalledWith('user-1', 'hashed:NovaSenha123');
      expect(audit.record).toHaveBeenCalledWith({ userId: 'user-1', action: 'USER_PASSWORD_CHANGED', entity: 'User', entityId: 'user-1' });
      expect(tokens.createAccessToken).toHaveBeenCalledWith({ sub: 'user-1', email: 'alice@buffet.com', mustChangePassword: false });
      expect(result).toEqual({
        user: { id: 'user-1', name: 'Alice', email: 'alice@buffet.com', mustChangePassword: false },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('never sends the passwords to the audit trail', async () => {
      const { service, audit } = makeService();

      await service.changePassword('user-1', 'SenhaAtual1', 'NovaSenha123');

      expect(JSON.stringify(audit.record.mock.calls)).not.toMatch(/SenhaAtual1|NovaSenha123/);
    });

    it('rejects a wrong current password without changing anything', async () => {
      const { service, users, audit } = makeService({ hasher: createHasher(false) });

      await expect(service.changePassword('user-1', 'errada', 'NovaSenha123')).rejects.toEqual(new AuthError('Senha atual incorreta'));
      expect(users.changePassword).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('rejects the change when the temporary password already expired', async () => {
      const user = makeUser({ mustChangePassword: true, tempPasswordExpiresAt: new Date(NOW.getTime() - 1) });
      const { service, users } = makeService({ users: createUsersRepo(user) });

      await expect(service.changePassword('user-1', 'Temp2345abcd', 'NovaSenha123')).rejects.toMatchObject({ code: AUTH_ERROR_CODES.TEMP_PASSWORD_EXPIRED });
      expect(users.changePassword).not.toHaveBeenCalled();
    });

    it('rejects unavailable users', async () => {
      for (const user of [null, makeUser({ isActive: false })]) {
        const { service } = makeService({ users: createUsersRepo(user) });
        await expect(service.changePassword('user-1', 'a', 'NovaSenha123')).rejects.toEqual(new AuthError('Usuário indisponível'));
      }
    });
  });

  describe('profile and permissions', () => {
    it('returns the user profile, including the pending change flag, and evaluates permissions', async () => {
      const user = makeUser({ mustChangePassword: true, roles: [{ role: { name: 'manager', permissions: [{ permission: { key: 'users:list' } }] } }] });
      const { service } = makeService({ users: createUsersRepo(user) });

      await expect(service.me(user.id)).resolves.toEqual({
        id: user.id,
        name: user.name,
        email: user.email,
        mustChangePassword: true,
        roles: [{ name: 'manager', permissions: ['users:list'] }],
      });
      await expect(service.hasPermission(user.id, 'users:list')).resolves.toBe(true);
      await expect(service.hasPermission(user.id, 'users:create')).resolves.toBe(false);
    });

    it('rejects unavailable users from profile access and denies inactive permissions', async () => {
      const { service } = makeService({ users: createUsersRepo(makeUser({ isActive: false })) });

      await expect(service.me('user-1')).rejects.toEqual(new AuthError('Usuário indisponível'));
      await expect(service.hasPermission('user-1', 'users:list')).resolves.toBe(false);
    });
  });
});
