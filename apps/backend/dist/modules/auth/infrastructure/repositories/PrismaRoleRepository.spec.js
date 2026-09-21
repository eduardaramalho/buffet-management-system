import { describe, expect, it, jest } from '@jest/globals';
import { PrismaRoleRepository } from './PrismaRoleRepository.js';
const role = {
    id: 'role-1',
    name: 'Gestor',
    description: 'Gestão operacional',
    deletedAt: null,
    permissions: [],
};
describe('PrismaRoleRepository', () => {
    it('lists active roles with permissions and excludes soft-deleted roles', async () => {
        const findMany = jest.fn(async () => [role]);
        const repository = new PrismaRoleRepository({ role: { findMany } });
        await expect(repository.list()).resolves.toEqual([role]);
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { deletedAt: null },
            include: expect.any(Object),
            orderBy: { name: 'asc' },
        }));
    });
    it('reads a role by id and creates and updates role data', async () => {
        const findFirst = jest.fn(async () => role);
        const create = jest.fn(async () => role);
        const update = jest.fn(async () => role);
        const repository = new PrismaRoleRepository({ role: { findFirst, create, update } });
        await repository.findById('role-1');
        await repository.create({ name: 'Gestor', description: 'Descrição' });
        await repository.update('role-1', { name: 'Gestor 2', description: undefined });
        expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'role-1', deletedAt: null } }));
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: { name: 'Gestor', description: 'Descrição' } }));
        expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'role-1' }, data: { name: 'Gestor 2', description: undefined } }));
    });
    it('soft deletes a role and counts only active users', async () => {
        const update = jest.fn(async () => ({ ...role, deletedAt: new Date() }));
        const count = jest.fn(async () => 2);
        const repository = new PrismaRoleRepository({ role: { update }, userRole: { count } });
        await repository.softDelete('role-1');
        await expect(repository.countActiveUsers('role-1')).resolves.toBe(2);
        expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'role-1' }, data: { deletedAt: expect.any(Date) } }));
        expect(count).toHaveBeenCalledWith({ where: { roleId: 'role-1', user: { isActive: true, deletedAt: null } } });
    });
    it('lists permissions and manages role-permission links', async () => {
        const findMany = jest.fn(async () => role.permissions);
        const upsert = jest.fn(async () => undefined);
        const deleteMany = jest.fn(async () => ({ count: 1 }));
        const repository = new PrismaRoleRepository({
            permission: { findMany },
            rolePermission: { upsert, deleteMany },
        });
        await repository.listPermissions();
        await repository.assignPermission('role-1', 'permission-1');
        await repository.revokePermission('role-1', 'permission-1');
        expect(findMany).toHaveBeenCalledWith({ orderBy: { key: 'asc' } });
        expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { roleId_permissionId: { roleId: 'role-1', permissionId: 'permission-1' } } }));
        expect(deleteMany).toHaveBeenCalledWith({ where: { roleId: 'role-1', permissionId: 'permission-1' } });
    });
});
