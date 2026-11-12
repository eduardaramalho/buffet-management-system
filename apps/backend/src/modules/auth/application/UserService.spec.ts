import { describe, expect, it, jest } from '@jest/globals';

import { UserService, UserManagementError } from './UserService.js';
import { NotFoundError } from '../../../shared/errors/NotFoundError.js';
import type { UserManagementRepository } from '../domain/user-management.types.js';

const OPERATOR_ROLE = { id: 'role-1', isProtected: false };

describe('UserService', () => {
  const makeUser = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-1',
    name: 'Alice',
    email: 'alice@buffet.com',
    isActive: true,
    deletedAt: null,
    roles: [{ role: { id: 'role-1', name: 'operador', isProtected: false } }],
    ...overrides,
  });

  it('lists sanitized users without exposing password hashes', async () => {
    const users: UserManagementRepository = {
      list: jest.fn(async () => [makeUser()]),
      findRoleById: jest.fn(async () => OPERATOR_ROLE),
      findManagedById: jest.fn(async () => null),
      create: jest.fn(async () => makeUser()),
      update: jest.fn(async () => makeUser()),
      setActive: jest.fn(async () => makeUser()),
      softDelete: jest.fn(async () => makeUser()),
    };

    const service = new UserService(users, { hash: jest.fn(async () => 'hashed'), compare: jest.fn(async () => true) }, { record: jest.fn(async () => undefined) });

    const result = await service.list({ search: 'alice' });

    expect(result).toEqual([
      {
        id: 'user-1',
        name: 'Alice',
        email: 'alice@buffet.com',
        isActive: true,
        deletedAt: null,
        roles: [{ role: { id: 'role-1', name: 'operador', isProtected: false } }],
      },
    ]);
  });

  it('creates a user with a hashed password and records audit', async () => {
    const repo: UserManagementRepository = {
      list: jest.fn(async () => []),
      findRoleById: jest.fn(async () => OPERATOR_ROLE),
      findManagedById: jest.fn(async () => makeUser()),
      create: jest.fn(async (input) => makeUser({ name: input.name, email: input.email })),
      update: jest.fn(async () => makeUser()),
      setActive: jest.fn(async () => makeUser()),
      softDelete: jest.fn(async () => makeUser()),
    };
    const audit = { record: jest.fn(async () => undefined) };
    const hasher = { hash: jest.fn(async () => 'hashed-password'), compare: jest.fn(async () => true) };
    const service = new UserService(repo, hasher, audit);

    const result = await service.create({ name: 'Alice', email: 'Alice@Buffet.com', password: 'secret123', roleId: 'role-1' }, 'actor-1');

    expect(hasher.hash).toHaveBeenCalledWith('secret123');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'alice@buffet.com', passwordHash: 'hashed-password' }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ userId: 'actor-1', action: 'USER_CREATED', entity: 'User' }));
    expect(result.email).toBe('alice@buffet.com');
  });

  // ADR 0012: a senha só muda pela redefinição do administrador ou pela troca feita pelo próprio usuário.
  it('never changes the password on update, even if one is sent, and audits the action', async () => {
    const repo: UserManagementRepository = {
      list: jest.fn(async () => []),
      findRoleById: jest.fn(async () => OPERATOR_ROLE),
      findManagedById: jest.fn(async () => makeUser()),
      create: jest.fn(async () => makeUser()),
      update: jest.fn(async () => makeUser()),
      setActive: jest.fn(async () => makeUser()),
      softDelete: jest.fn(async () => makeUser()),
    };
    const audit = { record: jest.fn(async () => undefined) };
    const hasher = { hash: jest.fn(async () => 'new-hash'), compare: jest.fn(async () => true) };
    const service = new UserService(repo, hasher, audit);

    await service.update('user-1', { name: 'Alicia', password: 'new-pass' } as Parameters<UserService['update']>[1], 'actor-1');

    expect(hasher.hash).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith('user-1', { name: 'Alicia', email: undefined });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_UPDATED' }));
  });

  it('gets a user and throws when the user does not exist', async () => {
    const user = makeUser();
    const users: UserManagementRepository = {
      list: jest.fn(async () => []),
      findRoleById: jest.fn(async () => OPERATOR_ROLE),
      findManagedById: jest.fn()
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(null),
      create: jest.fn(async () => user),
      update: jest.fn(async () => user),
      setActive: jest.fn(async () => user),
      softDelete: jest.fn(async () => user),
    };
    const service = new UserService(users, { hash: jest.fn(async () => 'hash'), compare: jest.fn(async () => true) }, { record: jest.fn(async () => undefined) });

    await expect(service.get('user-1')).resolves.toEqual(user);
    await expect(service.get('missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('updates name and email without touching the password', async () => {
    const user = makeUser();
    const users: UserManagementRepository = {
      list: jest.fn(async () => []),
      findRoleById: jest.fn(async () => OPERATOR_ROLE),
      findManagedById: jest.fn(async () => user),
      create: jest.fn(async () => user),
      update: jest.fn(async () => user),
      setActive: jest.fn(async () => user),
      softDelete: jest.fn(async () => user),
    };
    const hasher = { hash: jest.fn(async () => 'hash'), compare: jest.fn(async () => true) };
    const service = new UserService(users, hasher, { record: jest.fn(async () => undefined) });

    await service.update('user-1', { email: ' Alice@Buffet.com ' }, 'actor-1');

    expect(hasher.hash).not.toHaveBeenCalled();
    expect(users.update).toHaveBeenCalledWith('user-1', { name: undefined, email: 'alice@buffet.com' });
  });

  it('activates, deactivates, and soft deletes users with audit records', async () => {
    const user = makeUser();
    const users: UserManagementRepository = {
      list: jest.fn(async () => []),
      findRoleById: jest.fn(async () => OPERATOR_ROLE),
      findManagedById: jest.fn(async () => user),
      create: jest.fn(async () => user),
      update: jest.fn(async () => user),
      setActive: jest.fn(async () => user),
      softDelete: jest.fn(async () => ({ ...user, deletedAt: new Date() })),
    };
    const audit = { record: jest.fn(async () => undefined) };
    const service = new UserService(users, { hash: jest.fn(async () => 'hash'), compare: jest.fn(async () => true) }, audit);

    await service.setActive('user-1', true, 'actor-1');
    await service.setActive('user-1', false, 'actor-1');
    await service.remove('user-1', 'actor-1');

    expect(users.setActive).toHaveBeenNthCalledWith(1, 'user-1', true);
    expect(users.setActive).toHaveBeenNthCalledWith(2, 'user-1', false);
    expect(users.softDelete).toHaveBeenCalledWith('user-1');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_ACTIVATED' }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_DEACTIVATED' }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_DELETED' }));
  });

  it('rejects updates to administrator users', async () => {
    const admin = makeUser({ roles: [{ role: { id: 'role-admin', name: 'qualquer nome', isProtected: true } }] });
    const users: UserManagementRepository = {
      list: jest.fn(async () => []),
      findRoleById: jest.fn(async () => OPERATOR_ROLE), findManagedById: jest.fn(async () => admin), create: jest.fn(async () => admin),
      update: jest.fn(async () => admin), setActive: jest.fn(async () => admin), softDelete: jest.fn(async () => admin)
    };
    const service = new UserService(users, { hash: jest.fn(async () => 'hash'), compare: jest.fn(async () => true) }, { record: jest.fn(async () => undefined) });

    await expect(service.update('user-1', { name: 'Novo nome' }, 'actor-1')).rejects.toBeInstanceOf(UserManagementError);
    expect(users.update).not.toHaveBeenCalled();
  });

  it('rejects deactivation of administrator users', async () => {
    const admin = makeUser({ roles: [{ role: { id: 'role-admin', name: 'qualquer nome', isProtected: true } }] });
    const users: UserManagementRepository = {
      list: jest.fn(async () => []),
      findRoleById: jest.fn(async () => OPERATOR_ROLE), findManagedById: jest.fn(async () => admin), create: jest.fn(async () => admin),
      update: jest.fn(async () => admin), setActive: jest.fn(async () => admin), softDelete: jest.fn(async () => admin)
    };
    const service = new UserService(users, { hash: jest.fn(async () => 'hash'), compare: jest.fn(async () => true) }, { record: jest.fn(async () => undefined) });

    await expect(service.setActive('user-1', false, 'actor-1')).rejects.toThrow('Usuários administradores não podem ser editados pela interface');
    expect(users.setActive).not.toHaveBeenCalled();
  });

  it('rejects soft deletion of protected users', async () => {
    const admin = makeUser({ roles: [{ role: { id: 'role-admin', name: 'qualquer nome', isProtected: true } }] });
    const users: UserManagementRepository = {
      list: jest.fn(async () => []),
      findRoleById: jest.fn(async () => OPERATOR_ROLE), findManagedById: jest.fn(async () => admin), create: jest.fn(async () => admin),
      update: jest.fn(async () => admin), setActive: jest.fn(async () => admin), softDelete: jest.fn(async () => admin)
    };
    const service = new UserService(users, { hash: jest.fn(async () => 'hash'), compare: jest.fn(async () => true) }, { record: jest.fn(async () => undefined) });

    await expect(service.remove('user-1', 'actor-1')).rejects.toThrow('Usuários administradores não podem ser editados pela interface');
    expect(users.softDelete).not.toHaveBeenCalled();
  });

  it('updates and deactivates non-administrator users', async () => {
    const user = makeUser();
    const users: UserManagementRepository = {
      list: jest.fn(async () => []),
      findRoleById: jest.fn(async () => OPERATOR_ROLE), findManagedById: jest.fn(async () => user), create: jest.fn(async () => user),
      update: jest.fn(async () => user), setActive: jest.fn(async () => ({ ...user, isActive: false })), softDelete: jest.fn(async () => user)
    };
    const service = new UserService(users, { hash: jest.fn(async () => 'hash'), compare: jest.fn(async () => true) }, { record: jest.fn(async () => undefined) });

    await expect(service.update('user-1', { name: 'Alicia' }, 'actor-1')).resolves.toBeDefined();
    await expect(service.setActive('user-1', false, 'actor-1')).resolves.toBeDefined();
    expect(users.update).toHaveBeenCalled();
    expect(users.setActive).toHaveBeenCalledWith('user-1', false);
  });

  describe('ADR 0018: admin protegido, conta própria e 404', () => {
    const ADMIN_ROLE = { id: 'role-admin', isProtected: true };
    const makeRepo = (user: ReturnType<typeof makeUser> | null = makeUser(), role: { id: string; isProtected: boolean } | null = OPERATOR_ROLE) => {
      const repo: UserManagementRepository = {
        list: jest.fn(async () => []),
        findRoleById: jest.fn(async () => role),
        findManagedById: jest.fn(async () => user),
        create: jest.fn(async () => makeUser()),
        update: jest.fn(async () => makeUser()),
        setActive: jest.fn(async () => makeUser()),
        softDelete: jest.fn(async () => makeUser()),
      };
      const audit = { record: jest.fn(async () => undefined) };
      const service = new UserService(repo, { hash: jest.fn(async () => 'hash'), compare: jest.fn(async () => true) }, audit);
      return { repo, audit, service };
    };
    const input = { name: 'Bruno', email: 'bruno@buffet.com', password: 'secret123', roleId: 'role-admin' };

    it('refuses to assign the protected admin role on creation', async () => {
      const { repo, audit, service } = makeRepo(makeUser(), ADMIN_ROLE);

      await expect(service.create(input, 'actor-1')).rejects.toBeInstanceOf(UserManagementError);
      expect(repo.findRoleById).toHaveBeenCalledWith('role-admin');
      expect(repo.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('answers 404 when the role does not exist', async () => {
      const { repo, service } = makeRepo(makeUser(), null);

      await expect(service.create({ ...input, roleId: 'missing' }, 'actor-1')).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('refuses to deactivate the own account', async () => {
      const { repo, service } = makeRepo(makeUser({ id: 'actor-1' }));

      await expect(service.setActive('actor-1', false, 'actor-1')).rejects.toThrow('Você não pode desativar a própria conta');
      expect(repo.setActive).not.toHaveBeenCalled();
    });

    it('refuses to delete the own account', async () => {
      const { repo, service } = makeRepo(makeUser({ id: 'actor-1' }));

      await expect(service.remove('actor-1', 'actor-1')).rejects.toThrow('Você não pode excluir a própria conta');
      expect(repo.softDelete).not.toHaveBeenCalled();
    });

    it('still lets users edit their own name and e-mail', async () => {
      const { repo, service } = makeRepo(makeUser({ id: 'actor-1' }));

      await service.update('actor-1', { name: 'Novo nome' }, 'actor-1');

      expect(repo.update).toHaveBeenCalledWith('actor-1', { name: 'Novo nome', email: undefined });
    });

    it.each([
      ['update', (service: UserService) => service.update('missing', { name: 'X' }, 'actor-1')],
      ['setActive', (service: UserService) => service.setActive('missing', false, 'actor-1')],
      ['remove', (service: UserService) => service.remove('missing', 'actor-1')],
    ])('answers 404 on %s when the user does not exist', async (_name, action) => {
      const { service } = makeRepo(null);

      await expect(action(service)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
