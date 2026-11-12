import { describe, expect, it, jest } from '@jest/globals';

import { PrismaUserRepository } from './PrismaUserRepository.js';

const buildPrisma = () => {
  const userUpdate = jest.fn((args: unknown) => ({ op: 'user.update', args }));
  const refreshUpdateMany = jest.fn((args: unknown) => ({ op: 'refreshToken.updateMany', args }));
  const transaction = jest.fn(async (operations: unknown[]) => operations);
  const prisma = { user: { update: userUpdate }, refreshToken: { updateMany: refreshUpdateMany }, $transaction: transaction };
  return { prisma, userUpdate, refreshUpdateMany, transaction };
};

describe('PrismaUserRepository credentials', () => {
  it('stores a temporary password and revokes every active session in one transaction', async () => {
    const { prisma, userUpdate, refreshUpdateMany, transaction } = buildPrisma();
    const repository = new PrismaUserRepository(prisma as any);
    const expiresAt = new Date('2026-10-28T12:00:00.000Z');

    await repository.setTemporaryPassword('user-2', 'hashed-temp', expiresAt);

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { passwordHash: 'hashed-temp', mustChangePassword: true, tempPasswordExpiresAt: expiresAt },
    });
    expect(refreshUpdateMany).toHaveBeenCalledWith({ where: { userId: 'user-2', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0][0]).toHaveLength(2);
  });

  it('stores the new password, clears the pending change and revokes the old sessions in one transaction', async () => {
    const { prisma, userUpdate, refreshUpdateMany, transaction } = buildPrisma();
    const repository = new PrismaUserRepository(prisma as any);

    await repository.changePassword('user-2', 'hashed-new');

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { passwordHash: 'hashed-new', mustChangePassword: false, tempPasswordExpiresAt: null },
    });
    expect(refreshUpdateMany).toHaveBeenCalledWith({ where: { userId: 'user-2', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});

describe('PrismaUserRepository roles', () => {
  // ADR 0018: a criação de usuário consulta o papel para recusar o admin protegido.
  it('finds an active role with only its id and protection flag', async () => {
    const findFirst = jest.fn(async () => ({ id: 'role-1', isProtected: true }));
    const repository = new PrismaUserRepository({ role: { findFirst } } as any);

    await expect(repository.findRoleById('role-1')).resolves.toEqual({ id: 'role-1', isProtected: true });
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'role-1', deletedAt: null }, select: { id: true, isProtected: true } });
  });
});
