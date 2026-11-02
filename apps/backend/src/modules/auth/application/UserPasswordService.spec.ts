import { describe, expect, it, jest } from '@jest/globals';

import { UserPasswordConflictError, UserPasswordService } from './UserPasswordService.js';
import { UserManagementError } from './UserService.js';
import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
import type { ManagedUser, UserPasswordRepository } from '../domain/user-management.types.js';
import { TEMPORARY_PASSWORD_TTL_MS } from '../domain/password.policy.js';

const NOW = new Date('2026-10-27T12:00:00.000Z');
const TEMPORARY_PASSWORD = 'Abcd2345efgh';

const makeUser = (overrides: Partial<ManagedUser> = {}): ManagedUser => ({
  id: 'user-2',
  name: 'Bruno',
  email: 'bruno@buffet.com',
  isActive: true,
  deletedAt: null,
  roles: [{ role: { id: 'role-1', name: 'colaborador', isProtected: false } }],
  ...overrides,
});

const makeService = (user: ManagedUser | null = makeUser()) => {
  const users: UserPasswordRepository = {
    findManagedById: jest.fn(async () => user),
    setTemporaryPassword: jest.fn(async () => undefined),
  };
  const hasher = { hash: jest.fn(async (value: string) => `hashed:${value}`), compare: jest.fn(async () => true) };
  const generator = { generate: jest.fn(() => TEMPORARY_PASSWORD) };
  const audit = { record: jest.fn(async () => undefined) };
  const service = new UserPasswordService(users, hasher, generator, audit as never, () => NOW);
  return { service, users, hasher, generator, audit };
};

describe('UserPasswordService.resetByAdmin', () => {
  it('stores a hashed temporary password valid for 24h and returns it once', async () => {
    const { service, users, hasher } = makeService();
    const expiresAt = new Date(NOW.getTime() + TEMPORARY_PASSWORD_TTL_MS);

    const result = await service.resetByAdmin('user-2', 'admin-1');

    expect(hasher.hash).toHaveBeenCalledWith(TEMPORARY_PASSWORD);
    expect(users.setTemporaryPassword).toHaveBeenCalledWith('user-2', `hashed:${TEMPORARY_PASSWORD}`, expiresAt);
    expect(result).toEqual({ temporaryPassword: TEMPORARY_PASSWORD, expiresAt });
  });

  it('audits the reset without the temporary password', async () => {
    const { service, audit } = makeService();

    await service.resetByAdmin('user-2', 'admin-1');

    expect(audit.record).toHaveBeenCalledWith({
      userId: 'admin-1',
      action: 'USER_PASSWORD_RESET',
      entity: 'User',
      entityId: 'user-2',
      changes: { expiresAt: new Date(NOW.getTime() + TEMPORARY_PASSWORD_TTL_MS).toISOString() },
    });
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(TEMPORARY_PASSWORD);
  });

  it('returns 404 for unknown or soft-deleted users', async () => {
    const { service, users } = makeService(null);

    await expect(service.resetByAdmin('missing', 'admin-1')).rejects.toBeInstanceOf(NotFoundError);
    expect(users.setTemporaryPassword).not.toHaveBeenCalled();
  });

  it('never resets the password of a protected administrator', async () => {
    const { service, users, audit } = makeService(makeUser({ roles: [{ role: { id: 'role-admin', name: 'admin', isProtected: true } }] }));

    await expect(service.resetByAdmin('user-2', 'admin-1')).rejects.toBeInstanceOf(UserManagementError);
    expect(users.setTemporaryPassword).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('refuses inactive users with a conflict', async () => {
    const { service, users } = makeService(makeUser({ isActive: false }));

    await expect(service.resetByAdmin('user-2', 'admin-1')).rejects.toBeInstanceOf(UserPasswordConflictError);
    expect(users.setTemporaryPassword).not.toHaveBeenCalled();
  });
});
