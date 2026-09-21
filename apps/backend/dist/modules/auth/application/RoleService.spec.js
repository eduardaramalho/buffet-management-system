import { describe, expect, it, jest } from '@jest/globals';
import { RoleService, RoleError } from './RoleService.js';
const role = {
    id: 'role-1',
    name: 'Gestor',
    description: 'Gestão operacional',
    deletedAt: null,
    permissions: [{ id: 'permission-1', key: 'users:list', description: 'Listar usuários' }],
};
const repository = () => ({
    list: jest.fn(async () => [role]),
    findById: jest.fn()
        .mockResolvedValueOnce(role)
        .mockResolvedValueOnce(null),
    create: jest.fn(async () => role),
    update: jest.fn(async () => role),
    softDelete: jest.fn(async () => ({ ...role, deletedAt: new Date() })),
    listPermissions: jest.fn(async () => role.permissions),
    assignPermission: jest.fn(async () => undefined),
    revokePermission: jest.fn(async () => undefined),
    countActiveUsers: jest.fn(async () => 0),
});
describe('RoleService', () => {
    it('lists and gets roles', async () => {
        const roles = repository();
        const service = new RoleService(roles, { record: jest.fn(async () => undefined) });
        await expect(service.list()).resolves.toEqual([role]);
        await expect(service.get('role-1')).resolves.toEqual(role);
        await expect(service.get('missing')).rejects.toThrow('Papel não encontrado');
    });
    it('creates and updates a role and records audits', async () => {
        const roles = repository();
        const audit = { record: jest.fn(async () => undefined) };
        const service = new RoleService(roles, audit);
        await service.create({ name: 'Gestor', description: 'Gestão operacional' }, 'actor-1');
        await service.update('role-1', { name: 'Gestor atualizado' }, 'actor-1');
        expect(roles.create).toHaveBeenCalledWith({ name: 'Gestor', description: 'Gestão operacional' });
        expect(roles.update).toHaveBeenCalledWith('role-1', { name: 'Gestor atualizado', description: undefined });
        expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'ROLE_CREATED', entity: 'Role', userId: 'actor-1' }));
        expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'ROLE_UPDATED', entityId: 'role-1' }));
    });
    it('blocks deleting a role linked to active users', async () => {
        const roles = repository();
        roles.countActiveUsers = jest.fn(async () => 1);
        const service = new RoleService(roles, { record: jest.fn(async () => undefined) });
        await expect(service.remove('role-1', 'actor-1')).rejects.toBeInstanceOf(RoleError);
        expect(roles.softDelete).not.toHaveBeenCalled();
    });
    it('soft deletes an unused role and audits the operation', async () => {
        const roles = repository();
        const audit = { record: jest.fn(async () => undefined) };
        const service = new RoleService(roles, audit);
        await service.remove('role-1', 'actor-1');
        expect(roles.softDelete).toHaveBeenCalledWith('role-1');
        expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'ROLE_DELETED', entityId: 'role-1' }));
    });
    it('lists, assigns, and revokes permissions with audits for changes', async () => {
        const roles = repository();
        const audit = { record: jest.fn(async () => undefined) };
        const service = new RoleService(roles, audit);
        await expect(service.listPermissions()).resolves.toEqual(role.permissions);
        await service.assignPermission('role-1', 'permission-1', 'actor-1');
        await service.revokePermission('role-1', 'permission-1', 'actor-1');
        expect(roles.assignPermission).toHaveBeenCalledWith('role-1', 'permission-1');
        expect(roles.revokePermission).toHaveBeenCalledWith('role-1', 'permission-1');
        expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'ROLE_PERMISSION_ASSIGNED' }));
        expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'ROLE_PERMISSION_REVOKED' }));
    });
});
